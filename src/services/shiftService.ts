import { supabase } from '@/integrations/supabase/client';
import { isOnline } from './offlineStore';

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
  const staff = localStorage.getItem('active_staff_name');
  if (staff && staff.trim()) return staff;

  const role = localStorage.getItem('active_role');
  if (role) return role.toUpperCase();

  const profileRaw = localStorage.getItem('pos_offline_profile');
  if (profileRaw) {
    try {
      const p = JSON.parse(profileRaw);
      if (p.full_name) return p.full_name;
    } catch {
      // ignore
    }
  }

  return 'CASHIER';
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

const getCurrentCashierOpenShift = (): ShiftSession | null => {
  const active = getActiveShifts();
  if (active.length === 0) return null;

  const currentName = getCurrentCashierName();
  const found = active.find(
    (s) => s.cashier_name.toLowerCase() === currentName.toLowerCase()
  );
  if (found) return found;

  return active[active.length - 1] || null;
};

export const shiftService = {
  getStoredShifts,

  saveShifts,

  getActiveShifts,

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
      notes: 'Shift started',
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

    return newShift;
  },

  closeShift: async (id: string, endingAmount?: number): Promise<ShiftSession | null> => {
    const shifts = getStoredShifts();
    const index = shifts.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const shift = shifts[index];
    const updated: ShiftSession = {
      ...shift,
      status: 'closed',
      closed_at: new Date().toISOString(),
      ending_amount: endingAmount ?? shift.starting_amount,
    };

    shifts[index] = updated;
    saveShifts(shifts);

    const currentShiftId = localStorage.getItem('pos_current_shift_id');
    if (currentShiftId === id) {
      localStorage.removeItem('pos_current_shift_id');
    }

    if (isOnline()) {
      try {
        await supabase
          .from('daily_registers')
          .update({
            status: 'closed',
            closed_at: updated.closed_at,
            ending_amount: updated.ending_amount,
          } as any)
          .eq('id', id);
      } catch (err) {
        console.warn('Failed to sync closed shift to Supabase:', err);
      }
    }

    return updated;
  },
};
