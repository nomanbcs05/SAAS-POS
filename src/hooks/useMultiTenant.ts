import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as offline from '@/services/offlineStore';
import { isDesktop } from '@/lib/env';
import { cashierApi, ModuleKey } from '@/services/cashierApi';

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

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', session?.user?.id, isCashierLogin],
    queryFn: async () => {
      if (!session?.user?.id) return null;

      if (isCashierLogin) {
        const cp = cashierApi.auth.getProfile();
        const perm = cashierApi.auth.getPermissions();
        if (perm) setCashierPermissions(perm);
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
          .eq('id', session.user.id)
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
    enabled: !!session?.user?.id,
    retry: (failureCount, error) => {
      if (isAbortError(error)) return false;
      return failureCount < 3;
    },
  });

  const { data: ownedTenants, isLoading: ownedTenantsLoading } = useQuery({
    queryKey: ['owned-tenants', session?.user?.id, isCashierLogin],
    queryFn: async () => {
      if (!session?.user?.id) return [];

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
        .eq('owner_id', session.user.id);

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
    enabled: !!session?.user?.id,
    retry: (failureCount, error) => {
      if (isAbortError(error)) return false;
      return failureCount < 3;
    },
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant', profile?.tenant_id, ownedTenants, isCashierLogin],
    queryFn: async () => {
      if (isCashierLogin) {
        return offline.getCachedTenant() as Tenant | null;
      }

      if (isDesktop()) {
        return offline.getCachedTenant() as Tenant | null;
      }

      try {
        if (profile?.tenant_id) {
          const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', profile.tenant_id)
            .single();

          if (!error && data) {
            offline.cacheTenant(data);
            return data as Tenant;
          }
        }

        if (ownedTenants && ownedTenants.length > 0) {
          const firstTenant = ownedTenants[0];

          if (session?.user?.id && !profile?.tenant_id) {
            console.log('Repairing profile link to tenant:', firstTenant.id);
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ tenant_id: firstTenant.id })
              .eq('id', session.user.id);

          if (!updateError) {
              toast.success(`Restored settings for ${firstTenant.restaurant_name}`);
              window.location.reload();
            }
          }

          offline.cacheTenant(firstTenant);
          return firstTenant as Tenant;
        }

        return null;
      } catch (err) {
        if (isAbortError(err)) {
          console.warn('[Query] Aborted, returning cached tenant');
          return offline.getCachedTenant() as Tenant | null;
        }
        if (!offline.isOnline()) {
          console.warn('[Offline] Using cached tenant');
          return offline.getCachedTenant() as Tenant | null;
        }
        throw err;
      }
    },
    enabled: !!session?.user?.id && (!profileLoading || !!profile),
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
    if (!isCashierLogin) return true;
    if (!cashierPermissions) return false;
    return cashierPermissions[moduleKey as ModuleKey] === true;
  };

  return {
    session,
    profile,
    tenant: currentTenant,
    cashierName: getCashierName(),
    ownedTenants: ownedTenants || [],
    isLoading: sessionLoading || profileLoading || tenantLoading || ownedTenantsLoading,
    isAdmin: profile?.role === 'admin' || profile?.role === 'super-admin',
    isCashierLogin,
    cashierPermissions,
    canAccess,
  };
};
