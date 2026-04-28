import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as offline from '@/services/offlineStore';
import { isDesktop } from '@/lib/env';

export interface Profile {
  id: string;
  full_name: string | null;
  role: 'admin' | 'cashier' | 'super-admin';
  email?: string;
  tenant_id?: string | null;
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

  useEffect(() => {
    // Immediate bypass for desktop app
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
        // Offline fallback: use cached session
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

    return () => subscription.unsubscribe();
  }, []);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      
      // Force offline for desktop
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
        if (!offline.isOnline()) {
          console.warn('[Offline] Using cached profile');
          return offline.getCachedProfile() as Profile | null;
        }
        console.error('Error fetching profile:', err);
        return null;
      }
    },
    enabled: !!session?.user?.id,
  });

  const { data: ownedTenants, isLoading: ownedTenantsLoading } = useQuery({
    queryKey: ['owned-tenants', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('owner_id', session.user.id);

      if (error) {
        console.error('Error fetching owned tenants:', error);
        return [];
      }
      return data as Tenant[];
    },
    enabled: !!session?.user?.id,
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant', profile?.tenant_id, ownedTenants],
    queryFn: async () => {
      // Force offline for desktop
      if (isDesktop()) {
        return offline.getCachedTenant() as Tenant | null;
      }

      try {
        // Priority 1: Use the tenant linked in the profile
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

        // Priority 2: Use the first owned tenant if profile link is missing
        if (ownedTenants && ownedTenants.length > 0) {
          const firstTenant = ownedTenants[0];
          
          // Repair: Update profile to link to this tenant automatically
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
        if (!offline.isOnline()) {
          console.warn('[Offline] Using cached tenant');
          return offline.getCachedTenant() as Tenant | null;
        }
        throw err;
      }
    },
    enabled: !!session?.user?.id && (!profileLoading || !!profile),
  });

  // Default fallback for single-tenant mode or when tenant data is loading
  const defaultTenant = null;

  const currentTenant = tenant || (ownedTenants && ownedTenants.length > 0 ? ownedTenants[0] : null);

  const getCashierName = () => {
    if (!currentTenant?.id) return 'Cashier';
    
    // Priority 1: Tenant's default cashier name (from settings)
    if (currentTenant.default_cashier_name) {
      return currentTenant.default_cashier_name;
    }
    
    // Priority 2: Session-specific cashier name
    const saved = localStorage.getItem(`cashier_name_${currentTenant.id}`);
    if (saved) return saved;
    
    const active = localStorage.getItem('active_staff_name');
    if (active) return active;
    
    return profile?.full_name || 'Cashier';
  };

  return {
    session,
    profile,
    tenant: currentTenant,
    cashierName: getCashierName(),
    ownedTenants: ownedTenants || [],
    isLoading: sessionLoading || profileLoading || tenantLoading || ownedTenantsLoading,
    isAdmin: profile?.role === 'admin' || profile?.role === 'super-admin',
  };
};
