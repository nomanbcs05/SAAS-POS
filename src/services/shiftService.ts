import { supabase } from '@/integrations/supabase/client';
import { resetDailyCounter, isOnline } from './offlineStore';

export interface ShiftSession {
  id: string;
  cashier_name: string;
  cashier_id?: string;
  opened_at: string;
  closed_at: string | null;
  starting_amount: number;
  ending_amount: number | null;
  status: 'open' | 'closed';
  notes?: string | null;
}

const STORAGE_KEY = 'pos_active_shifts';

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

// ---------------------------------------------------------------------------
// Standalone helpers (declared before const shiftService) to avoid TDZ
// when object-literal methods reference sibling namespaces on shiftService.
// ---------------------------------------------------------------------------
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

const getActiveShifts = (): ShiftSession[] => {
  const shifts = getStoredShifts();
  return shifts.filter((s) => s.status === 'open');
};

const syncActiveShiftsFromCloud = async (): Promise<ShiftSession[]> => {
  if (!isOnline()) return getActiveShifts();

  try {
    const { data, error } = await Promise.race([
      supabase
        .from('daily_registers')
        .select('*')
        .eq('status', 'open')
        .order('opened_at', { ascending: false }),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
    ]);

    if (!error && Array.isArray(data)) {
      const cloudShifts: ShiftSession[] = data.map((r: any) => {
        let cName = (r.cashier_name || '').trim();
        if (!cName && r.notes) {
          const match = r.notes.match(/Cashier:\s*(.*)/i);
          if (match && match[1]) {
            cName = match[1].trim();
          }
        }
        if (!cName) cName = 'CASHIER';

        return {
          id: r.id,
          cashier_name: cName,
          cashier_id: r.cashier_id || undefined,
          opened_at: r.opened_at,
          closed_at: r.closed_at || null,
          starting_amount: Number(r.starting_amount) || 0,
          ending_amount: r.ending_amount != null ? Number(r.ending_amount) : null,
          status: (r.status as 'open' | 'closed') || 'open',
          notes: r.notes || null,
        };
      });

      const stored = getStoredShifts();
      const nonOpenStored = stored.filter(s => s.status !== 'open');
      const mergedMap = new Map<string, ShiftSession>();
      
      nonOpenStored.forEach(s => mergedMap.set(s.id, s));
      cloudShifts.forEach(s => mergedMap.set(s.id, s));

      const merged = Array.from(mergedMap.values());
      saveShifts(merged);
      return cloudShifts;
    }
  } catch (err) {
    console.warn('Failed to sync active shifts from Supabase:', err);
  }

  return getActiveShifts();
};

const getAllShiftsFromCloud = async (): Promise<ShiftSession[]> => {
  if (!isOnline()) return getStoredShifts();

  try {
    const { data, error } = await supabase
      .from('daily_registers')
      .select('*')
      .order('opened_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const cloudShifts: ShiftSession[] = data.map((r: any) => {
        let cName = (r.cashier_name || '').trim();
        if (!cName && r.notes) {
          const match = r.notes.match(/Cashier:\s*(.*)/i);
          if (match && match[1]) {
            cName = match[1].trim();
          }
        }
        if (!cName) cName = 'CASHIER';

        return {
          id: r.id,
          cashier_name: cName,
          cashier_id: r.cashier_id || undefined,
          opened_at: r.opened_at,
          closed_at: r.closed_at || null,
          starting_amount: Number(r.starting_amount) || 0,
          ending_amount: r.ending_amount != null ? Number(r.ending_amount) : null,
          status: (r.status as 'open' | 'closed') || 'open',
          notes: r.notes || null,
        };
      });

      saveShifts(cloudShifts);
      return cloudShifts;
    }
  } catch (err) {
    console.warn('Failed to fetch historical shifts from Supabase:', err);
  }

  return getStoredShifts();
};

// Initial background sync
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncActiveShiftsFromCloud();
  }, 500);
}

const getCurrentCashierOpenShift = (): ShiftSession | null => {
  const active = getActiveShifts();
  if (active.length === 0) return null;

  const currentName = getCurrentCashierName().toLowerCase();
  const found = active.find(
    (s) => s.cashier_name.toLowerCase() === currentName
  );
  if (found) return found;

  return null;
};

export const shiftService = {
  getStoredShifts,

  saveShifts,

  getActiveShifts,

  syncActiveShiftsFromCloud,

  getAllShiftsFromCloud,

  getCurrentCashierOpenShift,

  openShift: async (startingAmount: number, cashierName?: string): Promise<ShiftSession> => {
    const name = cashierName || getCurrentCashierName();
    const newShift: ShiftSession = {
      id: crypto.randomUUID(),
      cashier_name: name,
      opened_at: new Date().toISOString(),
      closed_at: null,
      starting_amount: Number(startingAmount) || 0,
      ending_amount: null,
      status: 'open',
      notes: `Cashier: ${name}`,
    };

    const shifts = getStoredShifts();
    shifts.push(newShift);
    saveShifts(shifts);
    localStorage.setItem('pos_current_shift_id', newShift.id);

    if (isOnline()) {
      try {
        await supabase.from('daily_registers').insert({
          id: newShift.id,
          opened_at: newShift.opened_at,
          starting_amount: newShift.starting_amount,
          status: 'open',
          notes: `Cashier: ${name}`,
        } as any);
      } catch (err) {
        console.warn('Failed to sync open shift to Supabase:', err);
      }
    }

    window.dispatchEvent(new Event('shift_changed'));
    return newShift;
  },

  closeShift: async (id: string, endingAmount?: number, notes?: string): Promise<ShiftSession | null> => {
    const shifts = getStoredShifts();
    const targetShift = shifts.find((s) => s.id === id);
    const cashierName = targetShift?.cashier_name || getCurrentCashierName();

    const updatedShifts = shifts.map((s) => {
      if (s.id === id || s.cashier_name.toLowerCase() === cashierName.toLowerCase()) {
        return {
          ...s,
          status: 'closed' as const,
          closed_at: new Date().toISOString(),
          ending_amount: endingAmount ?? s.starting_amount,
          notes: notes || s.notes || 'Shift closed',
        };
      }
      return s;
    });

    saveShifts(updatedShifts);
    localStorage.removeItem('pos_current_shift_id');
    window.dispatchEvent(new Event('shift_changed'));

    if (isOnline()) {
      try {
        await supabase
          .from('daily_registers')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            ending_amount: endingAmount ?? targetShift?.starting_amount ?? 0,
            notes: notes || 'Shift closed by cashier',
          } as any)
          .eq('id', id);

        // Also close any remaining open registers for this cashier
        await supabase
          .from('daily_registers')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            notes: 'Auto-closed on session end',
          } as any)
          .eq('status', 'open')
          .ilike('notes', `%${cashierName}%`);
      } catch (err) {
        console.warn('Failed to sync closed shift to Supabase:', err);
      }
    }

    return updatedShifts.find((s) => s.id === id) || null;
  },

  closeAllOpenShifts: async (): Promise<void> => {
    const shifts = getStoredShifts();
    const closedShifts = shifts.map(s => ({
      ...s,
      status: 'closed' as const,
      closed_at: s.closed_at || new Date().toISOString(),
      ending_amount: s.ending_amount ?? s.starting_amount,
      notes: s.notes || 'Cleaned / closed shift',
    }));
    saveShifts(closedShifts);
    localStorage.removeItem('pos_current_shift_id');
    window.dispatchEvent(new Event('shift_changed'));

    if (isOnline()) {
      try {
        await supabase
          .from('daily_registers')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            notes: 'Batch closed by user action',
          } as any)
          .eq('status', 'open');
      } catch (err) {
        console.warn('Failed to batch close open shifts in Supabase:', err);
      }
    }
  },
};
