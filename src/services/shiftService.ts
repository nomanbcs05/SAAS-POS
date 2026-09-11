import { supabase } from '@/integrations/supabase/client';
import { isOnline } from './offlineStore';
import { getDeviceId } from '@/lib/deviceId';

export interface ShiftSession {
  id: string;
  shift_id: string;
  user_id: string;
  tenant_id?: string | null;
  device_id: string;
  start_time: string;
  end_time: string | null;
  opening_balance: number;
  closing_balance: number | null;
  status: 'open' | 'closed';
  cashier_name: string;
  notes?: string | null;
  // Legacy aliases for backward compatibility
  opened_at?: string;
  closed_at?: string | null;
  starting_amount?: number;
  ending_amount?: number | null;
}

const STORAGE_KEY = 'pos_active_shifts_v2';
const CURRENT_DEVICE_SHIFT_KEY = 'pos_current_device_shift_id';

export const getCurrentCashierName = (): string => {
  if (typeof window === 'undefined') return 'CASHIER';

  // 1. Direct cashier login profile
  const cpRaw = localStorage.getItem('pos_cashier_profile');
  if (cpRaw) {
    try {
      const cp = JSON.parse(cpRaw);
      if (cp.name && cp.name.trim()) return cp.name.trim();
    } catch {}
  }

  // 2. Active staff name
  const staff = localStorage.getItem('active_staff_name');
  if (staff && staff.trim()) return staff.trim();

  // 3. User offline profile full_name
  const profileRaw = localStorage.getItem('pos_offline_profile');
  if (profileRaw) {
    try {
      const p = JSON.parse(profileRaw);
      if (p.full_name && p.full_name.trim()) return p.full_name.trim();
    } catch {}
  }

  const role = localStorage.getItem('active_role');
  if (role && role !== 'admin') return role.toUpperCase();

  return 'ADMIN';
};

export const getCurrentUserId = (): string => {
  if (typeof window === 'undefined') return 'anonymous_user';

  const cpRaw = localStorage.getItem('pos_cashier_profile');
  if (cpRaw) {
    try {
      const cp = JSON.parse(cpRaw);
      if (cp.id) return cp.id;
    } catch {}
  }

  const sessRaw = localStorage.getItem('pos_offline_session');
  if (sessRaw) {
    try {
      const s = JSON.parse(sessRaw);
      if (s.user?.id) return s.user.id;
    } catch {}
  }

  return 'user_' + getCurrentCashierName().toLowerCase().replace(/\s+/g, '_');
};

const getStoredShifts = (): ShiftSession[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveShifts = (shifts: ShiftSession[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
  window.dispatchEvent(new Event('shift_changed'));
};

export const shiftService = {
  getStoredShifts,
  saveShifts,
  getDeviceId,

  /**
   * Get all currently open shifts across devices.
   */
  getActiveShifts: (): ShiftSession[] => {
    return getStoredShifts().filter(s => s.status === 'open');
  },

  /**
   * Get the open shift specifically for the CURRENT device.
   * Ensures shifts are isolated by device_id.
   */
  getCurrentDeviceShift: (): ShiftSession | null => {
    const currentDeviceId = getDeviceId();
    const stored = getStoredShifts();
    const openShift = stored.find(s => s.device_id === currentDeviceId && s.status === 'open');
    return openShift || null;
  },

  /**
   * Legacy alias: returns current device shift
   */
  getCurrentCashierOpenShift: (): ShiftSession | null => {
    return shiftService.getCurrentDeviceShift();
  },

  /**
   * Sync active shifts from Supabase (shifts table + daily_registers)
   */
  syncActiveShiftsFromCloud: async (): Promise<ShiftSession[]> => {
    if (!isOnline()) return shiftService.getActiveShifts();

    const deviceId = getDeviceId();

    try {
      // 1. Try querying the shifts table
      const { data: shiftData, error: shiftError } = await supabase
        .from('shifts' as any)
        .select('*')
        .eq('status', 'open')
        .order('start_time', { ascending: false });

      if (!shiftError && Array.isArray(shiftData) && shiftData.length > 0) {
        const mapped: ShiftSession[] = shiftData.map((r: any) => ({
          id: r.id,
          shift_id: r.shift_id || r.id,
          user_id: r.user_id,
          tenant_id: r.tenant_id,
          device_id: r.device_id,
          start_time: r.start_time,
          end_time: r.end_time || null,
          opening_balance: Number(r.opening_balance) || 0,
          closing_balance: r.closing_balance != null ? Number(r.closing_balance) : null,
          status: (r.status as 'open' | 'closed') || 'open',
          cashier_name: r.cashier_name || 'CASHIER',
          notes: r.notes || null,
          // Compat
          opened_at: r.start_time,
          closed_at: r.end_time || null,
          starting_amount: Number(r.opening_balance) || 0,
          ending_amount: r.closing_balance != null ? Number(r.closing_balance) : null,
        }));

        saveShifts(mapped);
        return mapped;
      }

      // 2. Fallback check for daily_registers
      const { data: regData } = await supabase
        .from('daily_registers')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      if (Array.isArray(regData) && regData.length > 0) {
        const stored = getStoredShifts();
        const nonOpen = stored.filter(s => s.status !== 'open');
        const regMapped: ShiftSession[] = regData.map((r: any) => ({
          id: r.id,
          shift_id: r.id,
          user_id: r.cashier_id || getCurrentUserId(),
          device_id: deviceId,
          start_time: r.opened_at,
          end_time: r.closed_at || null,
          opening_balance: Number(r.starting_amount) || 0,
          closing_balance: r.ending_amount != null ? Number(r.ending_amount) : null,
          status: (r.status as 'open' | 'closed') || 'open',
          cashier_name: (r.cashier_name || 'CASHIER').trim(),
          notes: r.notes || null,
          opened_at: r.opened_at,
          closed_at: r.closed_at || null,
          starting_amount: Number(r.starting_amount) || 0,
          ending_amount: r.ending_amount != null ? Number(r.ending_amount) : null,
        }));

        const merged = [...nonOpen, ...regMapped];
        saveShifts(merged);
        return regMapped;
      }
    } catch (err) {
      console.warn('[shiftService] Failed to sync shifts from cloud:', err);
    }

    return shiftService.getActiveShifts();
  },

  /**
   * Start Shift: Independent of Admin shift!
   * Creates new row in `shifts` table:
   * shift_id, user_id, device_id, start_time, opening_balance
   */
  openShift: async (
    openingBalance: number,
    cashierName?: string,
    userId?: string,
    tenantId?: string
  ): Promise<ShiftSession> => {
    const name = cashierName || getCurrentCashierName();
    const uid = userId || getCurrentUserId();
    const deviceId = getDeviceId();
    const now = new Date().toISOString();
    const shiftUuid = crypto.randomUUID ? crypto.randomUUID() : 'sh_' + Date.now();

    const newShift: ShiftSession = {
      id: shiftUuid,
      shift_id: shiftUuid,
      user_id: uid,
      tenant_id: tenantId || null,
      device_id: deviceId,
      start_time: now,
      end_time: null,
      opening_balance: Number(openingBalance) || 0,
      closing_balance: null,
      status: 'open',
      cashier_name: name,
      notes: `Device: ${deviceId} | Cashier: ${name}`,
      opened_at: now,
      closed_at: null,
      starting_amount: Number(openingBalance) || 0,
      ending_amount: null,
    };

    // Close any previous open shift on THIS device in local storage
    const shifts = getStoredShifts().map(s => {
      if (s.device_id === deviceId && s.status === 'open') {
        return { ...s, status: 'closed' as const, end_time: now, closed_at: now };
      }
      return s;
    });

    shifts.push(newShift);
    saveShifts(shifts);
    localStorage.setItem(CURRENT_DEVICE_SHIFT_KEY, newShift.shift_id);
    localStorage.setItem('pos_current_shift_id', newShift.shift_id);

    // Sync to Supabase cloud
    if (isOnline()) {
      try {
        // Close any prior open shift for this device
        await supabase
          .from('shifts' as any)
          .update({ status: 'closed', end_time: now, updated_at: now })
          .eq('device_id', deviceId)
          .eq('status', 'open');

        // Insert new row into `shifts` table
        await supabase.from('shifts' as any).insert({
          id: newShift.id,
          shift_id: newShift.shift_id,
          user_id: newShift.user_id,
          tenant_id: newShift.tenant_id,
          device_id: newShift.device_id,
          start_time: newShift.start_time,
          opening_balance: newShift.opening_balance,
          status: 'open',
          cashier_name: newShift.cashier_name,
          notes: newShift.notes,
        });

        // Also insert into daily_registers for legacy order reporting compatibility
        await supabase.from('daily_registers').insert({
          id: newShift.id,
          opened_at: newShift.start_time,
          starting_amount: newShift.opening_balance,
          status: 'open',
          notes: `Device: ${deviceId} | Cashier: ${name}`,
        } as any);
      } catch (err) {
        console.warn('[shiftService] Failed to sync new shift to Supabase:', err);
      }
    }

    window.dispatchEvent(new Event('shift_changed'));
    return newShift;
  },

  /**
   * End Shift: ONLY closes that specific device's shift!
   * Other devices remain open.
   */
  closeShift: async (
    targetShiftId?: string,
    closingBalance?: number,
    notes?: string
  ): Promise<ShiftSession | null> => {
    const deviceId = getDeviceId();
    const shifts = getStoredShifts();
    const now = new Date().toISOString();

    // Find shift for this device
    const target = shifts.find(
      s => (targetShiftId ? s.id === targetShiftId || s.shift_id === targetShiftId : s.device_id === deviceId && s.status === 'open')
    );

    const shiftIdToClose = target?.id || targetShiftId;

    // Update ONLY the shift on this device
    const updatedShifts = shifts.map(s => {
      if (s.id === shiftIdToClose || (s.device_id === deviceId && s.status === 'open')) {
        return {
          ...s,
          status: 'closed' as const,
          end_time: now,
          closed_at: now,
          closing_balance: closingBalance ?? s.opening_balance,
          ending_amount: closingBalance ?? s.opening_balance,
          notes: notes || s.notes || 'Shift ended',
        };
      }
      return s;
    });

    saveShifts(updatedShifts);
    localStorage.removeItem(CURRENT_DEVICE_SHIFT_KEY);
    localStorage.removeItem('pos_current_shift_id');
    window.dispatchEvent(new Event('shift_changed'));

    // Sync close to Supabase
    if (isOnline() && shiftIdToClose) {
      try {
        // Close ONLY this specific shift in shifts table
        await supabase
          .from('shifts' as any)
          .update({
            status: 'closed',
            end_time: now,
            closing_balance: closingBalance ?? target?.opening_balance ?? 0,
            notes: notes || 'Shift closed on device ' + deviceId,
            updated_at: now,
          })
          .eq('id', shiftIdToClose);

        // Also update matching daily_registers row
        await supabase
          .from('daily_registers')
          .update({
            status: 'closed',
            closed_at: now,
            ending_amount: closingBalance ?? target?.opening_balance ?? 0,
            notes: notes || 'Shift closed on device ' + deviceId,
          } as any)
          .eq('id', shiftIdToClose);
      } catch (err) {
        console.warn('[shiftService] Failed to sync shift close to Supabase:', err);
      }
    }

    return updatedShifts.find(s => s.id === shiftIdToClose) || null;
  },

  getAllShiftsFromCloud: async (): Promise<ShiftSession[]> => {
    return shiftService.syncActiveShiftsFromCloud();
  },

  closeAllOpenShifts: async (): Promise<void> => {
    const shifts = getStoredShifts();
    const now = new Date().toISOString();
    const closed = shifts.map(s => ({
      ...s,
      status: 'closed' as const,
      end_time: s.end_time || now,
      closed_at: s.closed_at || now,
      closing_balance: s.closing_balance ?? s.opening_balance,
      ending_amount: s.ending_amount ?? s.starting_amount,
    }));
    saveShifts(closed);
    localStorage.removeItem(CURRENT_DEVICE_SHIFT_KEY);
    localStorage.removeItem('pos_current_shift_id');
    window.dispatchEvent(new Event('shift_changed'));
  }
};
