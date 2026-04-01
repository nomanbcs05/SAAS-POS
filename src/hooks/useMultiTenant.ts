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

      if (error) return null;
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

      if (error) return [];
      return data as Tenant[];
    },
    enabled: !!session?.user?.id,
  });

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return null;
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profile.tenant_id)
        .single();

      if (error) return null;
      return data as Tenant;
    },
    enabled: !!profile?.tenant_id,
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
