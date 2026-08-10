import { supabase } from '@/integrations/supabase/client';
import * as offline from '@/services/offlineStore';
import { isDesktop } from '@/lib/env';

export type ModuleKey =
  | 'dashboard'
  | 'genx'
  | 'ongoing-orders'
  | 'orders'
  | 'completed-orders'
  | 'products'
  | 'customers'
  | 'credit'
  | 'staff-management'
  | 'inventory'
  | 'reports'
  | 'settings';

export const ALL_MODULES: { key: ModuleKey; name: string; label: string; route: string; category: 'pos' | 'management' }[] = [
  { key: 'dashboard', name: 'Dashboard', label: 'Dashboard', route: '/', category: 'pos' },
  { key: 'genx', name: 'GenX', label: 'GenX Module', route: '/genx', category: 'pos' },
  { key: 'ongoing-orders', name: 'Running Orders', label: 'Running / Ongoing Orders', route: '/ongoing-orders', category: 'pos' },
  { key: 'orders', name: 'Orders', label: 'All Orders', route: '/orders', category: 'pos' },
  { key: 'completed-orders', name: 'Completed Orders', label: 'Completed Orders', route: '/completed-orders', category: 'pos' },
  { key: 'products', name: 'Products', label: 'Products / Menu Management', route: '/products', category: 'management' },
  { key: 'customers', name: 'Customers', label: 'Customer Management', route: '/customers', category: 'management' },
  { key: 'credit', name: 'Credit Ledger', label: 'Customer Credit / Udhaar', route: '/credit', category: 'management' },
  { key: 'staff-management', name: 'Staff Management', label: 'Staff & Payroll', route: '/staff-management', category: 'management' },
  { key: 'inventory', name: 'Inventory', label: 'Inventory Management', route: '/inventory', category: 'management' },
  { key: 'reports', name: 'Reports', label: 'Reports & Analytics', route: '/reports', category: 'management' },
  { key: 'settings', name: 'Settings', label: 'System Settings', route: '/settings', category: 'management' },
];

export interface CashierAccount {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  full_access: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashierPermission {
  id?: string;
  cashier_id: string;
  module_key: ModuleKey;
  allowed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CashierWithPermissions extends CashierAccount {
  permissions: Record<ModuleKey, boolean>;
}

const CASHIER_SESSION_KEY = 'pos_cashier_session';
const CASHIER_PROFILE_KEY = 'pos_cashier_profile';
const CASHIER_PERMISSIONS_KEY = 'pos_cashier_permissions';
const OFFLINE_CASHIERS_KEY = 'pos_offline_cashiers';
const OFFLINE_CASHIER_PERMS_KEY = 'pos_offline_cashier_perms';

const shouldUseLocal = () => isDesktop() || !offline.isOnline();

const isSchemaMissing = (error: any): boolean => {
  if (!error) return false;
  const status = Number(error.status ?? 0);
  const code = String(error.code ?? '');
  const msg = String(error.message ?? error.details ?? '').toLowerCase();
  return (
    status === 404 ||
    status === 400 ||
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST116' ||
    code === 'PGRST200' ||
    code === 'PGRST204' ||
    msg.includes('not found') ||
    msg.includes('could not find') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('relation') ||
    msg.includes('column')
  );
};

const simpleHash = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const chr = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `h_${Math.abs(hash)}_${pin.length}`;
};

const verifyPin = (pin: string, hash: string): boolean => {
  return simpleHash(pin) === hash;
};

const getOfflineCashiers = (): (CashierAccount & { pin_hash: string })[] => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_CASHIERS_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveOfflineCashiers = (cashiers: any[]) => {
  localStorage.setItem(OFFLINE_CASHIERS_KEY, JSON.stringify(cashiers));
};

const getOfflinePermissions = (): Record<string, Record<ModuleKey, boolean>> => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_CASHIER_PERMS_KEY) || '{}');
  } catch {
    return {};
  }
};

const saveOfflinePermissions = (perms: Record<string, Record<ModuleKey, boolean>>) => {
  localStorage.setItem(OFFLINE_CASHIER_PERMS_KEY, JSON.stringify(perms));
};

const defaultPermissions = (): Record<ModuleKey, boolean> => {
  const perms: Record<string, boolean> = {};
  ALL_MODULES.forEach(m => {
    perms[m.key] = m.category === 'pos';
  });
  return perms as Record<ModuleKey, boolean>;
};

export const cashierApi = {
  account: {
    getAll: async (tenantId?: string): Promise<CashierWithPermissions[]> => {
      const buildFromLocal = (): CashierWithPermissions[] => {
        const cashiers = getOfflineCashiers();
        const allPerms = getOfflinePermissions();
        return cashiers
          .filter(c => !tenantId || c.tenant_id === tenantId)
          .map(c => {
            const { pin_hash, ...rest } = c;
            return {
              ...rest,
              permissions: c.full_access
                ? ALL_MODULES.reduce((acc, m) => ({ ...acc, [m.key]: true }), {} as Record<ModuleKey, boolean>)
                : (allPerms[c.id] || defaultPermissions()),
            };
          });
      };

      if (shouldUseLocal()) return buildFromLocal();

      try {
        let q = supabase.from('cashier_accounts').select('*, cashier_permissions(*)');
        if (tenantId) q = q.eq('tenant_id', tenantId);
        const { data, error } = await q.order('name');

        if (error) {
          if (isSchemaMissing(error)) return buildFromLocal();
          throw error;
        }

        return (data ?? []).map((row: any) => {
          const rawPerms: CashierPermission[] = row.cashier_permissions ?? [];
          const permMap: Record<ModuleKey, boolean> = ALL_MODULES.reduce((acc, m) => {
            acc[m.key] = false;
            return acc;
          }, {} as Record<ModuleKey, boolean>);
          rawPerms.forEach(p => {
            permMap[p.module_key as ModuleKey] = p.allowed;
          });
          const { cashier_permissions, ...rest } = row;
          return {
            ...rest,
            permissions: row.full_access
              ? ALL_MODULES.reduce((acc, m) => ({ ...acc, [m.key]: true }), {} as Record<ModuleKey, boolean>)
              : permMap,
          } as CashierWithPermissions;
        });
      } catch (err: any) {
        if (isSchemaMissing(err)) return buildFromLocal();
        throw err;
      }
    },

    create: async (payload: {
      tenant_id: string;
      name: string;
      pin: string;
      is_active?: boolean;
      full_access?: boolean;
      permissions?: Partial<Record<ModuleKey, boolean>>;
    }): Promise<CashierWithPermissions> => {
      const pin_hash = simpleHash(payload.pin);
      const perms = payload.permissions ?? defaultPermissions();

      const createLocal = (): CashierWithPermissions => {
        const cashiers = getOfflineCashiers();
        const allPerms = getOfflinePermissions();
        if (cashiers.some(c => c.tenant_id === payload.tenant_id && c.name.toLowerCase() === payload.name.toLowerCase())) {
          throw new Error(`Cashier "${payload.name}" already exists in this restaurant`);
        }
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const entry: CashierAccount & { pin_hash: string } = {
          id,
          tenant_id: payload.tenant_id,
          name: payload.name,
          pin_hash,
          is_active: payload.is_active !== false,
          full_access: !!payload.full_access,
          created_at: now,
          updated_at: now,
        };
        cashiers.push(entry);
        saveOfflineCashiers(cashiers);
        allPerms[id] = entry.full_access
          ? ALL_MODULES.reduce((acc, m) => ({ ...acc, [m.key]: true }), {} as Record<ModuleKey, boolean>)
          : { ...defaultPermissions(), ...perms };
        saveOfflinePermissions(allPerms);
        const { pin_hash: _ph, ...rest } = entry;
        return { ...rest, permissions: allPerms[id] };
      };

      if (shouldUseLocal()) return createLocal();

      try {
        const { data, error } = await supabase
          .from('cashier_accounts')
          .insert({
            tenant_id: payload.tenant_id,
            name: payload.name,
            pin_hash,
            is_active: payload.is_active !== false,
            full_access: !!payload.full_access,
          })
          .select()
          .single();

        if (error) {
          if (isSchemaMissing(error)) return createLocal();
          if (String(error.message).includes('duplicate') || String(error.code) === '23505') {
            throw new Error(`Cashier "${payload.name}" already exists in this restaurant`);
          }
          throw error;
        }

        if (!payload.full_access) {
          const rows: any[] = ALL_MODULES.map(m => ({
            cashier_id: data.id,
            module_key: m.key,
            allowed: perms[m.key] ?? false,
          }));
          if (rows.length) {
            const { error: pError } = await supabase.from('cashier_permissions').insert(rows);
            if (pError && !isSchemaMissing(pError)) console.warn('Perm insert failed', pError);
          }
        }

        return {
          ...data,
          permissions: data.full_access
            ? ALL_MODULES.reduce((acc, m) => ({ ...acc, [m.key]: true }), {} as Record<ModuleKey, boolean>)
            : { ...defaultPermissions(), ...perms },
        } as CashierWithPermissions;
      } catch (err: any) {
        if (isSchemaMissing(err)) return createLocal();
        throw err;
      }
    },

    update: async (
      id: string,
      payload: Partial<{
        name: string;
        is_active: boolean;
        full_access: boolean;
        permissions: Partial<Record<ModuleKey, boolean>>;
      }>
    ): Promise<CashierWithPermissions> => {
      const updateLocal = (): CashierWithPermissions => {
        const cashiers = getOfflineCashiers();
        const allPerms = getOfflinePermissions();
        const idx = cashiers.findIndex(c => c.id === id);
        if (idx === -1) throw new Error('Cashier not found');
        cashiers[idx] = {
          ...cashiers[idx],
          name: payload.name ?? cashiers[idx].name,
          is_active: payload.is_active ?? cashiers[idx].is_active,
          full_access: payload.full_access ?? cashiers[idx].full_access,
          updated_at: new Date().toISOString(),
        };
        saveOfflineCashiers(cashiers);
        if (payload.permissions && !cashiers[idx].full_access) {
          allPerms[id] = { ...(allPerms[id] || defaultPermissions()), ...payload.permissions };
          saveOfflinePermissions(allPerms);
        }
        if (cashiers[idx].full_access) {
          allPerms[id] = ALL_MODULES.reduce((acc, m) => ({ ...acc, [m.key]: true }), {} as Record<ModuleKey, boolean>);
          saveOfflinePermissions(allPerms);
        }
        const { pin_hash, ...rest } = cashiers[idx];
        return { ...rest, permissions: allPerms[id] || defaultPermissions() };
      };

      if (shouldUseLocal()) return updateLocal();

      try {
        const updatePayload: any = { updated_at: new Date().toISOString() };
        if (payload.name !== undefined) updatePayload.name = payload.name;
        if (payload.is_active !== undefined) updatePayload.is_active = payload.is_active;
        if (payload.full_access !== undefined) updatePayload.full_access = payload.full_access;

        const { data, error } = await supabase
          .from('cashier_accounts')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          if (isSchemaMissing(error)) return updateLocal();
          if (String(error.message).includes('duplicate') || String(error.code) === '23505') {
            throw new Error(`Cashier name is already in use`);
          }
          throw error;
        }

        if (payload.permissions && !data.full_access) {
          const upserts = Object.entries(payload.permissions).map(([module_key, allowed]) => ({
            cashier_id: id,
            module_key,
            allowed: !!allowed,
          }));
          if (upserts.length) {
            const { error: pError } = await supabase
              .from('cashier_permissions')
              .upsert(upserts, { onConflict: 'cashier_id,module_key' });
            if (pError && !isSchemaMissing(pError)) console.warn('Perm upsert failed', pError);
          }
        }

        const perms: Record<ModuleKey, boolean> = data.full_access
          ? ALL_MODULES.reduce((acc, m) => ({ ...acc, [m.key]: true }), {} as Record<ModuleKey, boolean>)
          : { ...defaultPermissions(), ...(payload.permissions || {}) };

        return { ...data, permissions: perms } as CashierWithPermissions;
      } catch (err: any) {
        if (isSchemaMissing(err)) return updateLocal();
        throw err;
      }
    },

    changePin: async (id: string, newPin: string): Promise<void> => {
      const pin_hash = simpleHash(newPin);

      const localChange = () => {
        const cashiers = getOfflineCashiers();
        const idx = cashiers.findIndex(c => c.id === id);
        if (idx === -1) throw new Error('Cashier not found');
        cashiers[idx].pin_hash = pin_hash;
        cashiers[idx].updated_at = new Date().toISOString();
        saveOfflineCashiers(cashiers);
      };

      if (shouldUseLocal()) return localChange();

      try {
        const { error } = await supabase
          .from('cashier_accounts')
          .update({ pin_hash, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) {
          if (isSchemaMissing(error)) return localChange();
          throw error;
        }
      } catch (err: any) {
        if (isSchemaMissing(err)) return localChange();
        throw err;
      }
    },

    delete: async (id: string): Promise<void> => {
      const localDelete = () => {
        const cashiers = getOfflineCashiers();
        saveOfflineCashiers(cashiers.filter(c => c.id !== id));
        const allPerms = getOfflinePermissions();
        delete allPerms[id];
        saveOfflinePermissions(allPerms);
      };

      if (shouldUseLocal()) return localDelete();

      try {
        const { error } = await supabase.from('cashier_accounts').delete().eq('id', id);
        if (error) {
          if (isSchemaMissing(error)) return localDelete();
          throw error;
        }
      } catch (err: any) {
        if (isSchemaMissing(err)) return localDelete();
        throw err;
      }
    },
  },

  auth: {
    login: async (
      tenantId: string,
      name: string,
      pin: string
    ): Promise<{ cashier: CashierAccount; permissions: Record<ModuleKey, boolean>; token: string }> => {
      const localLogin = () => {
        const cashiers = getOfflineCashiers();
        const c = cashiers.find(
          x => x.tenant_id === tenantId && x.name.toLowerCase() === name.toLowerCase()
        );
        if (!c) throw new Error('Cashier account not found');
        if (!c.is_active) throw new Error('This cashier account is inactive');
        if (!verifyPin(pin, c.pin_hash)) throw new Error('Invalid 4-digit PIN');
        const allPerms = getOfflinePermissions();
        const perms = c.full_access
          ? ALL_MODULES.reduce((acc, m) => ({ ...acc, [m.key]: true }), {} as Record<ModuleKey, boolean>)
          : (allPerms[c.id] || defaultPermissions());
        const token = 'local_' + btoa(c.id + ':' + Date.now()).replace(/=/g, '');
        return { cashier: c, permissions: perms, token };
      };

      if (shouldUseLocal()) return localLogin();

      try {
        const { data, error } = await supabase
          .from('cashier_accounts')
          .select('*, cashier_permissions(*)')
          .eq('tenant_id', tenantId)
          .ilike('name', name)
          .maybeSingle();

        if (error && !isSchemaMissing(error)) throw error;

        if (!data) {
          console.warn('[Cashier Login] DB returned no row. tenantId=', tenantId, 'name=', name, 'error=', error);
          if (isSchemaMissing(error || {})) return localLogin();
          const local = getOfflineCashiers().find(
            x => x.tenant_id === tenantId && x.name.toLowerCase() === name.toLowerCase()
          );
          if (local) {
            console.warn('[Cashier Login] Falling back to offline cache (RLS may be blocking).');
            return localLogin();
          }
          throw new Error('Cashier account not found');
        }

        if (!data.is_active) throw new Error('This cashier account is inactive');
        if (!verifyPin(pin, data.pin_hash)) throw new Error('Invalid 4-digit PIN');

        const rawPerms: CashierPermission[] = data.cashier_permissions ?? [];
        const permMap: Record<ModuleKey, boolean> = ALL_MODULES.reduce((acc, m) => {
          acc[m.key] = false;
          return acc;
        }, {} as Record<ModuleKey, boolean>);
        rawPerms.forEach(p => {
          permMap[p.module_key as ModuleKey] = p.allowed;
        });
        const perms = data.full_access
          ? ALL_MODULES.reduce((acc, m) => ({ ...acc, [m.key]: true }), {} as Record<ModuleKey, boolean>)
          : permMap;

        const token = 'sb_' + btoa(data.id + ':' + Date.now()).replace(/=/g, '');
        const { cashier_permissions, pin_hash: _ph, ...cashierOnly } = data;

        return { cashier: cashierOnly, permissions: perms, token };
      } catch (err: any) {
        if (isSchemaMissing(err)) return localLogin();
        throw err;
      }
    },

    setSession: (cashier: CashierAccount, permissions: Record<ModuleKey, boolean>, token: string) => {
      const session = {
        user: { id: cashier.id, role: 'cashier', name: cashier.name },
        cashier_id: cashier.id,
        tenant_id: cashier.tenant_id,
        token,
        expires_at: Date.now() + 1000 * 60 * 60 * 12,
      };
      localStorage.setItem(CASHIER_SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(CASHIER_PROFILE_KEY, JSON.stringify(cashier));
      localStorage.setItem(CASHIER_PERMISSIONS_KEY, JSON.stringify(permissions));
      offline.cacheSession(session as any);
      offline.cacheProfile({
        id: cashier.id,
        full_name: cashier.name,
        role: 'cashier',
        tenant_id: cashier.tenant_id,
      });
      localStorage.setItem('active_staff_name', cashier.name);
      window.dispatchEvent(new CustomEvent('cashier-permissions-changed', { detail: { cashier, permissions } }));
    },

    getSession: () => {
      try {
        const raw = localStorage.getItem(CASHIER_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.expires_at && parsed.expires_at < Date.now()) {
          cashierApi.clearSession();
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    },

    getProfile: (): CashierAccount | null => {
      try {
        const raw = localStorage.getItem(CASHIER_PROFILE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    getPermissions: (): Record<ModuleKey, boolean> | null => {
      try {
        const raw = localStorage.getItem(CASHIER_PERMISSIONS_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    refreshPermissions: async (tenantId: string, cashierId: string) => {
      try {
        const all = await cashierApi.account.getAll(tenantId);
        const match = all.find(c => c.id === cashierId);
        if (match) {
          localStorage.setItem(CASHIER_PERMISSIONS_KEY, JSON.stringify(match.permissions));
          window.dispatchEvent(new CustomEvent('cashier-permissions-changed', {
            detail: { cashier: match, permissions: match.permissions },
          }));
        }
      } catch (err) {
        console.warn('[Cashier] Could not refresh permissions', err);
      }
    },

    clearSession: () => {
      localStorage.removeItem(CASHIER_SESSION_KEY);
      localStorage.removeItem(CASHIER_PROFILE_KEY);
      localStorage.removeItem(CASHIER_PERMISSIONS_KEY);
    },

    canAccessRoute: (route: string): boolean => {
      const perms = cashierApi.auth.getPermissions();
      if (!perms) return true;
      const mod = ALL_MODULES.find(m => m.route === route || (route !== '/' && route.startsWith(m.route + '/')));
      if (!mod) return true;
      return perms[mod.key] === true;
    },

    isCashierSession: (): boolean => {
      return !!cashierApi.auth.getSession();
    },
  },
};
