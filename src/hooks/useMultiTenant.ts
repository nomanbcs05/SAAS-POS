import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

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
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setSessionLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as Profile;
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
      // Priority 1: Use the tenant linked in the profile
      if (profile?.tenant_id) {
        const { data, error } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profile.tenant_id)
          .single();

        if (!error && data) return data as Tenant;
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
            // Force a reload of the profile in the query cache
            window.location.reload(); 
          }
        }
        
        return firstTenant as Tenant;
      }

      return null;
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
