import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TenantData {
  id: string;
  restaurant_name: string;
  logo_url?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  receipt_footer?: string | null;
  bill_footer?: string | null;
  tax_rate?: number;
  tax_name?: string;
  tax_id?: string | null;
  website?: string | null;
  default_cashier_name?: string;
  enabled_payment_methods?: string[];
  plan_type?: string;
  billing_status?: string;
}

export interface TenantContextType {
  tenants: Record<string, TenantData>; // Keyed by tenant_${tenant_id}
  activeTenantId: string | null;
  activeTenant: TenantData | null;
  isLoading: boolean;
  fetchTenantFromMe: () => Promise<TenantData | null>;
  fetchFreshTenantSettings: (tenantId?: string | null) => Promise<TenantData | null>;
  setTenantData: (tenant: TenantData) => void;
  forceLogout: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // In-memory tenant store keyed strictly by tenant_${tenant_id}
  const [tenants, setTenants] = useState<Record<string, TenantData>>({});
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const activeTenantKey = activeTenantId ? `tenant_${activeTenantId}` : null;
  const activeTenant = activeTenantKey ? (tenants[activeTenantKey] || null) : null;

  const setTenantData = useCallback((tenant: TenantData) => {
    if (!tenant?.id) return;
    const key = `tenant_${tenant.id}`;
    setTenants(prev => ({
      ...prev,
      [key]: tenant,
    }));
    setActiveTenantId(tenant.id);
  }, []);

  /**
   * On Login / Session change:
   * Fetches tenant data from API /api/me and stores in React Context with key tenant_${tenant_id}
   */
  const fetchTenantFromMe = useCallback(async (): Promise<TenantData | null> => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let tenantResult: TenantData | null = null;

      // 1. Attempt API /api/me call
      if (token) {
        try {
          const res = await fetch('/api/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.tenant) {
              tenantResult = data.tenant;
            }
          }
        } catch {
          // Fallback to direct client query below
        }
      }

      // 2. Direct Supabase Fallback (enforcing WHERE id = profile.tenant_id)
      if (!tenantResult && session?.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id, restaurant_id')
          .eq('id', session.user.id)
          .maybeSingle();

        const tid = profile?.tenant_id || profile?.restaurant_id;
        if (tid) {
          const { data: tenantRow } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tid)
            .single();

          if (tenantRow) {
            tenantResult = tenantRow as TenantData;
          }
        }
      }

      if (tenantResult && tenantResult.id) {
        setTenantData(tenantResult);
        return tenantResult;
      }

      return null;
    } catch (err) {
      console.error('[TenantContext] Error fetching /api/me:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [setTenantData]);

  /**
   * On Print:
   * Re-fetch /api/restaurant/settings with tenant_id to guarantee fresh branding
   */
  const fetchFreshTenantSettings = useCallback(async (tenantId?: string | null): Promise<TenantData | null> => {
    const tid = tenantId || activeTenantId;
    if (!tid) {
      throw new Error('CRITICAL: Cannot fetch settings without tenant_id. Aborting Print.');
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let freshTenant: TenantData | null = null;

      try {
        const headers: Record<string, string> = {
          'x-tenant-id': tid,
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/restaurant/settings?tenant_id=${encodeURIComponent(tid)}`, {
          headers,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.settings) {
            freshTenant = data.settings;
          }
        }
      } catch {
        // Fallback to direct Supabase query
      }

      // Client-side fallback if serverless offline
      if (!freshTenant) {
        const { data: tenantRow } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', tid)
          .single();

        if (tenantRow) {
          freshTenant = tenantRow as TenantData;
        }
      }

      if (freshTenant) {
        setTenantData(freshTenant);
        return freshTenant;
      }

      throw new Error(`CRITICAL: Unable to fetch fresh settings for tenant ${tid}`);
    } catch (err: any) {
      console.error('[TenantContext] Failed to re-fetch settings on print:', err);
      throw err;
    }
  }, [activeTenantId, setTenantData]);

  /**
   * On Logout:
   * Force clear all cache, context, and reload page: window.location.reload()
   */
  const forceLogout = useCallback(async () => {
    try {
      // 1. Clear in-memory state
      setTenants({});
      setActiveTenantId(null);

      // 2. Kill ONLY current device session_id (keeping other devices logged in!)
      const currentSessionId = typeof window !== 'undefined' ? localStorage.getItem('pos_session_id') : null;
      if (currentSessionId) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: currentSessionId })
          });
        } catch {
          // ignore offline
        }
      }

      // 3. Clear only current device session keys, PRESERVING pos_device_id and pos_offline_tenant
      if (typeof window !== 'undefined') {
        try {
          const deviceId = localStorage.getItem('pos_device_id');
          const cachedTenant = localStorage.getItem('pos_offline_tenant');

          localStorage.removeItem('pos_session_id');
          localStorage.removeItem('pos_cashier_session');
          localStorage.removeItem('pos_cashier_profile');
          localStorage.removeItem('pos_cashier_permissions');
          localStorage.removeItem('pos_offline_session');
          localStorage.removeItem('pos_offline_profile');
          localStorage.removeItem('pos_local_user');
          localStorage.removeItem('active_staff_name');
          localStorage.removeItem('active_role');
          localStorage.removeItem('pos_current_shift_id');
          localStorage.removeItem('pos_current_device_shift_id');
          sessionStorage.clear();

          if (deviceId) {
            localStorage.setItem('pos_device_id', deviceId);
          }
          if (cachedTenant) {
            localStorage.setItem('pos_offline_tenant', cachedTenant);
          }
        } catch {
          // ignore
        }

        // 4. Navigate to auth screen
        window.location.href = '#/auth';
        window.location.reload();
      }
    } catch (err) {
      console.error('[TenantContext] Error during forceLogout:', err);
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTenantFromMe();
  }, [fetchTenantFromMe]);

  return (
    <TenantContext.Provider
      value={{
        tenants,
        activeTenantId,
        activeTenant,
        isLoading,
        fetchTenantFromMe,
        fetchFreshTenantSettings,
        setTenantData,
        forceLogout,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenantContext = (): TenantContextType => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within a TenantProvider');
  }
  return context;
};
