import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as offline from '@/services/offlineStore';
import { isDesktop } from '@/lib/env';
import { cashierApi, ModuleKey } from '@/services/cashierApi';
import { useTenantContext } from '@/contexts/TenantContext';

const isAbortError = (error: any) => {
  return error?.name === 'AbortError' ||
         error?.message?.includes('signal is aborted') ||
         error?.message?.includes('AbortError');
};

export interface Profile {
  id: string;
  full_name: string | null;
  role: 'admin' | 'cashier' | 'super-admin';
  email?: string;
  tenant_id?: string | null;
  isCashierAccount?: boolean;
}

export interface Tenant {
  id: string;
  restaurant_name: string;
  logo_url?: string;
  address?: string;
  city?: string;
  phone?: string;
  receipt_footer?: string;
  bill_footer?: string;
  plan_type?: string;
  billing_status?: string;
  default_cashier_name?: string;
  tax_rate?: number;
  tax_name?: string;
  multi_printer_kot_enabled?: boolean;
}

export const useMultiTenant = () => {
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [cashierPermissions, setCashierPermissions] = useState<Record<ModuleKey, boolean> | null>(null);
  const [isCashierLogin, setIsCashierLogin] = useState(false);

  useEffect(() => {
    const cashierSession = cashierApi.auth.getSession();
    if (cashierSession) {
      console.log('[useMultiTenant] Using cashier session');
      setSession(cashierSession);
      setIsCashierLogin(true);
      setCashierPermissions(cashierApi.auth.getPermissions());
      setSessionLoading(false);
      return;
    }

    if (isDesktop()) {
      const cached = offline.getCachedSession();
      if (cached) {
        console.log('[Desktop] Using cached session');
        setSession(cached);
        setSessionLoading(false);
        return;
      }
    }

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (session) {
        offline.cacheSession(session);
        setSession(session);
      } else if (!offline.isOnline()) {
        const cached = offline.getCachedSession();
        if (cached) {
          console.warn('[Offline] Using cached session');
          setSession(cached);
        }
      }
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        offline.cacheSession(session);
      }
      setSession(session);
      setSessionLoading(false);
    });

    const handleCashierPermissionsChange = (e: any) => {
      setCashierPermissions(e.detail?.permissions || null);
    };
    window.addEventListener('cashier-permissions-changed', handleCashierPermissionsChange as any);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('cashier-permissions-changed', handleCashierPermissionsChange as any);
    };
  }, []);

  const userId = session?.user?.id || null;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', userId, isCashierLogin],
    queryFn: async () => {
      if (!userId) return null;

      if (isCashierLogin) {
        const cp = cashierApi.auth.getProfile();
        if (cp) {
          return {
            id: cp.id,
            full_name: cp.name,
            role: 'cashier' as const,
            tenant_id: cp.tenant_id,
            isCashierAccount: true,
          } as Profile;
        }
        return null;
      }

      if (isDesktop()) {
        return offline.getCachedProfile() as Profile | null;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) throw error;
        offline.cacheProfile(data);
        return data as Profile;
      } catch (err) {
        if (isAbortError(err)) {
          console.warn('[Query] Aborted, returning cached or null');
          return offline.getCachedProfile() as Profile | null;
        }
        if (!offline.isOnline()) {
          console.warn('[Offline] Using cached profile');
          return offline.getCachedProfile() as Profile | null;
        }
        console.error('Error fetching profile:', err);
        return null;
      }
    },
    enabled: !!userId,
    retry: (failureCount, error) => {
      if (isAbortError(error)) return false;
      return failureCount < 3;
    },
  });

  const { data: ownedTenants, isLoading: ownedTenantsLoading } = useQuery({
    queryKey: ['owned-tenants', userId, isCashierLogin],
    queryFn: async () => {
      if (!userId) return [];

      if (isCashierLogin) {
        const cp = cashierApi.auth.getProfile();
        const cached = offline.getCachedTenant();
        if (cp?.tenant_id && cached && (cached as any).id === cp.tenant_id) {
          return [cached as Tenant];
        }
        if (cached) return [cached as Tenant];
        return [];
      }

      if (isDesktop()) {
        const cached = offline.getCachedTenant();
        return cached ? [cached as Tenant] : [];
      }

      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('owner_id', userId);

      if (error) {
        if (isAbortError(error)) {
          console.warn('[Query] Aborted, returning empty');
          return [];
        }
        console.error('Error fetching owned tenants:', error);
        return [];
      }
      return data as Tenant[];
    },
    enabled: !!userId,
    retry: (failureCount, error) => {
      if (isAbortError(error)) return false;
      return failureCount < 3;
    },
  });

  let tenantContext: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    tenantContext = useTenantContext();
  } catch {
    // safe if used outside TenantProvider
  }

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant', profile?.tenant_id, ownedTenants, isCashierLogin],
    queryFn: async () => {
      // 1. Check in-memory TenantContext keyed strictly by tenant_${profile.tenant_id}
      if (profile?.tenant_id && tenantContext?.tenants?.[`tenant_${profile.tenant_id}`]) {
        return tenantContext.tenants[`tenant_${profile.tenant_id}`] as Tenant;
      }
      if (tenantContext?.activeTenant && (!profile?.tenant_id || tenantContext.activeTenant.id === profile.tenant_id)) {
        return tenantContext.activeTenant as Tenant;
      }

      try {
        if (profile?.tenant_id) {
          const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', profile.tenant_id)
            .single();

          if (!error && data) {
            tenantContext?.setTenantData?.(data);
            return data as Tenant;
          }
        }

        if (ownedTenants && ownedTenants.length > 0) {
          const firstTenant = ownedTenants[0];

          if (userId && !profile?.tenant_id) {
            console.log('Repairing profile link to tenant:', firstTenant.id);
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ tenant_id: firstTenant.id })
              .eq('id', userId);

            if (!updateError) {
              toast.success(`Restored settings for ${firstTenant.restaurant_name}`);
              window.location.reload();
            }
          }

          tenantContext?.setTenantData?.(firstTenant);
          return firstTenant as Tenant;
        }

        return null;
      } catch (err) {
        if (isAbortError(err)) {
          console.warn('[Query] Aborted, returning null');
          return null;
        }
        throw err;
      }
    },
    enabled: !!userId && (!profileLoading || !!profile),
    retry: (failureCount, error) => {
      if (isAbortError(error)) return false;
      return failureCount < 3;
    },
  });

  const defaultTenant = null;
  const currentTenant = tenant || (ownedTenants && ownedTenants.length > 0 ? ownedTenants[0] : null);

  const getCashierName = () => {
    if (isCashierLogin) {
      return profile?.full_name || 'Cashier';
    }
    if (!currentTenant?.id) return 'Cashier';
    if (currentTenant.default_cashier_name) {
      return currentTenant.default_cashier_name;
    }
    const saved = localStorage.getItem(`cashier_name_${currentTenant.id}`);
    if (saved) return saved;
    const active = localStorage.getItem('active_staff_name');
    if (active) return active;
    return profile?.full_name || 'Cashier';
  };

  const canAccess = (moduleKey: ModuleKey | string): boolean => {
    // Admin/Owner always has full access — role itself grants unrestricted access
    if (!isCashierLogin) return true;
    // Cashier: check permissions table
    const perms = cashierPermissions || cashierApi.auth.getPermissions();
    if (!perms) return false;
    return perms[moduleKey as ModuleKey] === true;
  };

  // True if current user is the restaurant owner / admin (not a cashier)
  const isOwner = !isCashierLogin && (
    profile?.role === 'admin' || profile?.role === 'super-admin'
  );

  return {
    session,
    profile,
    tenant: currentTenant,
    cashierName: getCashierName(),
    ownedTenants: ownedTenants || [],
    isLoading: sessionLoading || profileLoading || tenantLoading || ownedTenantsLoading,
    isAdmin: profile?.role === 'admin' || profile?.role === 'super-admin',
    isOwner,
    isCashierLogin,
    cashierPermissions,
    canAccess,
  };
};
