import { supabase } from '@/integrations/supabase/client';
import { isDesktop } from '@/lib/env';
import * as offline from '@/services/offlineStore';
import { toast } from 'sonner';

export interface Staff {
  id: string;
  name: string;
  role: 'cashier' | 'waiter' | 'chef' | 'cleaner' | 'manager';
  phone?: string;
  email?: string;
  salary_type: 'monthly' | 'daily';
  salary_amount: number;
  joining_date: string;
  is_active: boolean;
  tenant_id?: string | null;
  created_at?: string;
}

export interface StaffAttendance {
  id?: string;
  staff_id: string;
  date: string;
  status: 'present' | 'absent' | 'half_day' | 'leave';
  check_in?: string;
  check_out?: string;
  tenant_id?: string | null;
  created_at?: string;
}

export interface StaffPayroll {
  id?: string;
  staff_id: string;
  month: string;
  base_salary: number;
  present_days: number;
  absent_days: number;
  bonus: number;
  advances: number;
  deductions: number;
  net_salary: number;
  tenant_id?: string | null;
  created_at?: string;
}

export interface PayrollVoucher {
  id: string;
  voucher_id: string;
  staff_id: string;
  payroll_id: string;
  month: string;
  net_salary: number;
  payment_status: 'Paid' | 'Pending';
  payment_date?: string | null;
  tenant_id?: string | null;
  created_at?: string;
  staff_name?: string;
  staff_role?: string;
}

// ---------------------------------------------------------------------------
// Module-level flags — once a table is known to be missing we skip Supabase
// for the entire browser session so no more repeated 404 HTTP requests.
// ---------------------------------------------------------------------------
const TABLE_OK: Record<string, boolean> = {
  staff: true,
  staff_attendance: true,
  staff_payroll: true,
  payroll_vouchers: true,
};

const LOCAL_STORAGE_SESSION_KEY = 'pos_staff_tables_missing';

// Persist missing-table flags across page reloads so we don't waste requests
const loadPersistedFlags = () => {
  try {
    const raw = sessionStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (raw) {
      const missing: string[] = JSON.parse(raw);
      missing.forEach(t => { TABLE_OK[t] = false; });
    }
  } catch { /* ignore */ }
};
loadPersistedFlags();

const markTableMissing = (tableName: string) => {
  if (TABLE_OK[tableName] === false) return; // already marked
  TABLE_OK[tableName] = false;

  // Persist so page reloads don't re-fire HTTP 404s
  try {
    const raw = sessionStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    if (!existing.includes(tableName)) {
      existing.push(tableName);
      sessionStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(existing));
    }
  } catch { /* ignore */ }

  console.warn(`[StaffMgmt] Table "${tableName}" not found — switching to local storage mode for this session.`);
  toast.warning(`Database table "${tableName}" not set up yet.`, {
    description: 'Running in local storage mode. Run the migration SQL in Supabase to enable cloud sync.',
    duration: 6000,
  });
};

// Local Storage Keys
const OFFLINE_KEYS = {
  STAFF_ATTENDANCE: 'pos_offline_staff_attendance',
  STAFF_PAYROLL: 'pos_offline_staff_payroll',
  PAYROLL_VOUCHERS: 'pos_offline_payroll_vouchers',
};

// Check if a Supabase error means the table / column is missing
const isSchemaMissing = (error: any): boolean => {
  if (!error) return false;
  const status = Number(error.status ?? 0);
  const code = String(error.code ?? '');
  const msg = String(error.message ?? '').toLowerCase();
  return (
    status === 404 ||
    status === 400 ||
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST116' ||
    code === 'PGRST200' ||
    msg.includes('not found') ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('column')
  );
};

// Returns true if we should use local storage (table missing OR desktop/offline mode)
const useLocal = (tableName: string): boolean =>
  isDesktop() || !offline.isOnline() || TABLE_OK[tableName] === false;

export const staffManagementApi = {
  // ---------------------------------------------------------------------------
  // Staff CRUD
  // ---------------------------------------------------------------------------
  staff: {
    getAll: async (tenantId?: string): Promise<Staff[]> => {
      const getLocal = (): Staff[] => {
        const localUsers: any[] = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        return localUsers.map(u => ({
          id: u.id,
          name: u.full_name || u.name,
          role: u.role || 'cashier',
          phone: u.phone || '',
          email: u.email || '',
          salary_type: u.salary_type || 'monthly',
          salary_amount: Number(u.salary_amount || 0),
          joining_date: u.joining_date || new Date().toISOString().split('T')[0],
          is_active: u.is_active !== false,
          tenant_id: u.tenant_id || tenantId,
        }));
      };

      if (useLocal('staff')) return getLocal();

      try {
        let q = supabase.from('staff').select('*');
        if (tenantId) q = q.eq('tenant_id', tenantId);
        const { data, error } = await q.order('name');
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('staff'); return getLocal(); }
          throw error;
        }
        return (data ?? []) as unknown as Staff[];
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('staff'); return getLocal(); }
        throw err;
      }
    },

    create: async (staffData: Omit<Staff, 'id' | 'created_at'>): Promise<Staff> => {
      const saveLocal = (): Staff => {
        const users: any[] = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        const id = crypto.randomUUID();
        const entry = {
          ...staffData, id,
          full_name: staffData.name,
          email: staffData.email || `${staffData.name.toLowerCase().replace(/\s+/g, '')}@offline.pos`,
          password: 'password123',
          is_active: true,
          created_at: new Date().toISOString(),
        };
        users.push(entry);
        localStorage.setItem('pos_local_users', JSON.stringify(users));
        return { id, ...staffData, is_active: true };
      };

      if (useLocal('staff')) return saveLocal();

      try {
        const { data, error } = await supabase.from('staff').insert(staffData).select().single();
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('staff'); return saveLocal(); }
          throw error;
        }
        return data as unknown as Staff;
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('staff'); return saveLocal(); }
        throw err;
      }
    },

    update: async (id: string, staffData: Partial<Staff>): Promise<Staff> => {
      const updateLocal = (): Staff => {
        const users: any[] = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        const idx = users.findIndex(u => u.id === id);
        if (idx === -1) throw new Error('Staff member not found');
        users[idx] = { ...users[idx], ...staffData, full_name: staffData.name || users[idx].full_name };
        localStorage.setItem('pos_local_users', JSON.stringify(users));
        const u = users[idx];
        return { id, name: u.full_name, role: u.role, phone: u.phone, email: u.email,
          salary_type: u.salary_type, salary_amount: Number(u.salary_amount),
          joining_date: u.joining_date, is_active: u.is_active, tenant_id: u.tenant_id };
      };

      if (useLocal('staff')) return updateLocal();

      try {
        const { data, error } = await supabase.from('staff').update(staffData).eq('id', id).select().single();
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('staff'); return updateLocal(); }
          throw error;
        }
        return data as unknown as Staff;
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('staff'); return updateLocal(); }
        throw err;
      }
    },

    delete: async (id: string): Promise<void> => {
      const deleteLocal = () => {
        const users: any[] = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        localStorage.setItem('pos_local_users', JSON.stringify(users.filter(u => u.id !== id)));
      };

      if (useLocal('staff')) return deleteLocal();

      try {
        const { error } = await supabase.from('staff').delete().eq('id', id);
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('staff'); return deleteLocal(); }
          throw error;
        }
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('staff'); return deleteLocal(); }
        throw err;
      }
    },
  },

  // ---------------------------------------------------------------------------
  // Attendance
  // ---------------------------------------------------------------------------
  attendance: {
    getByDate: async (date: string, tenantId?: string): Promise<StaffAttendance[]> => {
      const getLocal = () => {
        const list: any[] = JSON.parse(localStorage.getItem(OFFLINE_KEYS.STAFF_ATTENDANCE) || '[]');
        return list.filter(a => a.date === date) as StaffAttendance[];
      };

      if (useLocal('staff_attendance')) return getLocal();

      try {
        let q = supabase.from('staff_attendance').select('*').eq('date', date);
        if (tenantId) q = q.eq('tenant_id', tenantId);
        const { data, error } = await q;
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('staff_attendance'); return getLocal(); }
          throw error;
        }
        return (data ?? []) as unknown as StaffAttendance[];
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('staff_attendance'); return getLocal(); }
        throw err;
      }
    },

    getByMonth: async (month: string, tenantId?: string): Promise<StaffAttendance[]> => {
      const getLocal = () => {
        const list: any[] = JSON.parse(localStorage.getItem(OFFLINE_KEYS.STAFF_ATTENDANCE) || '[]');
        return list.filter(a => a.date.startsWith(month)) as StaffAttendance[];
      };

      if (useLocal('staff_attendance')) return getLocal();

      try {
        let q = supabase.from('staff_attendance').select('*')
          .gte('date', `${month}-01`).lte('date', `${month}-31`);
        if (tenantId) q = q.eq('tenant_id', tenantId);
        const { data, error } = await q;
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('staff_attendance'); return getLocal(); }
          throw error;
        }
        return (data ?? []) as unknown as StaffAttendance[];
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('staff_attendance'); return getLocal(); }
        throw err;
      }
    },

    saveDaily: async (records: StaffAttendance[]): Promise<StaffAttendance[]> => {
      const saveLocal = () => {
        const list: any[] = JSON.parse(localStorage.getItem(OFFLINE_KEYS.STAFF_ATTENDANCE) || '[]');
        const ids = records.map(r => r.staff_id);
        const date = records[0]?.date;
        const rest = list.filter(a => !(a.date === date && ids.includes(a.staff_id)));
        const newRecs = records.map(r => ({ ...r, id: r.id || crypto.randomUUID(), created_at: new Date().toISOString() }));
        localStorage.setItem(OFFLINE_KEYS.STAFF_ATTENDANCE, JSON.stringify([...rest, ...newRecs]));
        return newRecs as StaffAttendance[];
      };

      if (useLocal('staff_attendance')) return saveLocal();

      try {
        const { data, error } = await supabase.from('staff_attendance')
          .upsert(records, { onConflict: 'staff_id,date' }).select();
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('staff_attendance'); return saveLocal(); }
          throw error;
        }
        return data as unknown as StaffAttendance[];
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('staff_attendance'); return saveLocal(); }
        throw err;
      }
    },
  },

  // ---------------------------------------------------------------------------
  // Payroll
  // ---------------------------------------------------------------------------
  payroll: {
    getByMonth: async (month: string, tenantId?: string): Promise<StaffPayroll[]> => {
      const getLocal = () => {
        const list: any[] = JSON.parse(localStorage.getItem(OFFLINE_KEYS.STAFF_PAYROLL) || '[]');
        return list.filter(p => p.month === month) as StaffPayroll[];
      };

      if (useLocal('staff_payroll')) return getLocal();

      try {
        let q = supabase.from('staff_payroll').select('*').eq('month', month);
        if (tenantId) q = q.eq('tenant_id', tenantId);
        const { data, error } = await q;
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('staff_payroll'); return getLocal(); }
          throw error;
        }
        return (data ?? []) as unknown as StaffPayroll[];
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('staff_payroll'); return getLocal(); }
        throw err;
      }
    },

    save: async (records: StaffPayroll[]): Promise<StaffPayroll[]> => {
      const saveLocal = () => {
        const list: any[] = JSON.parse(localStorage.getItem(OFFLINE_KEYS.STAFF_PAYROLL) || '[]');
        const ids = records.map(r => r.staff_id);
        const month = records[0]?.month;
        const rest = list.filter(p => !(p.month === month && ids.includes(p.staff_id)));
        const newRecs = records.map(r => ({ ...r, id: r.id || crypto.randomUUID(), created_at: new Date().toISOString() }));
        localStorage.setItem(OFFLINE_KEYS.STAFF_PAYROLL, JSON.stringify([...rest, ...newRecs]));
        return newRecs as StaffPayroll[];
      };

      if (useLocal('staff_payroll')) return saveLocal();

      try {
        const { data, error } = await supabase.from('staff_payroll')
          .upsert(records, { onConflict: 'staff_id,month' }).select();
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('staff_payroll'); return saveLocal(); }
          throw error;
        }
        return data as unknown as StaffPayroll[];
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('staff_payroll'); return saveLocal(); }
        throw err;
      }
    },

    calculate: async (month: string, tenantId?: string): Promise<StaffPayroll[]> => {
      const staffList = await staffManagementApi.staff.getAll(tenantId);
      const activeStaff = staffList.filter(s => s.is_active);
      const attendance = await staffManagementApi.attendance.getByMonth(month, tenantId);

      const [yearStr, monthStr] = month.split('-');
      const totalDays = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();

      const existingPayrolls = await staffManagementApi.payroll.getByMonth(month, tenantId);
      const existingMap = new Map<string, StaffPayroll>(existingPayrolls.map(p => [p.staff_id, p]));

      return activeStaff.map(s => {
        const staffAtt = attendance.filter(a => a.staff_id === s.id);
        let presentDays = 0, absentDays = 0;
        staffAtt.forEach(a => {
          if (a.status === 'present' || a.status === 'leave') presentDays += 1;
          else if (a.status === 'half_day') { presentDays += 0.5; absentDays += 0.5; }
          else if (a.status === 'absent') absentDays += 1;
        });

        const existing = existingMap.get(s.id);
        const base_salary = Number(s.salary_amount || 0);
        const bonus = existing ? Number(existing.bonus || 0) : 0;
        const advances = existing ? Number(existing.advances || 0) : 0;
        let deductions = existing ? Number(existing.deductions || 0) : 0;
        let net_salary = 0;

        if (s.salary_type === 'monthly') {
          if (!existing) deductions = absentDays * (base_salary / (totalDays || 30));
          net_salary = base_salary - deductions + bonus - advances;
        } else {
          net_salary = presentDays * base_salary + bonus - advances;
        }

        return {
          id: existing?.id,
          staff_id: s.id, month, base_salary,
          present_days: Math.round(presentDays * 2) / 2,
          absent_days: Math.round(absentDays * 2) / 2,
          bonus, advances,
          deductions: Math.round(deductions * 100) / 100,
          net_salary: Math.round(net_salary * 100) / 100,
          tenant_id: s.tenant_id || tenantId,
        };
      });
    },
  },

  // ---------------------------------------------------------------------------
  // Vouchers
  // ---------------------------------------------------------------------------
  vouchers: {
    getByMonth: async (month: string, tenantId?: string): Promise<PayrollVoucher[]> => {
      const getLocal = async (): Promise<PayrollVoucher[]> => {
        const vouchers: any[] = JSON.parse(localStorage.getItem(OFFLINE_KEYS.PAYROLL_VOUCHERS) || '[]');
        const filtered = vouchers.filter(v => v.month === month);
        const staff = await staffManagementApi.staff.getAll(tenantId);
        return filtered.map(v => {
          const s = staff.find(st => st.id === v.staff_id);
          return { ...v, staff_name: s?.name || 'Unknown', staff_role: s?.role || 'Unknown' };
        });
      };

      if (useLocal('payroll_vouchers')) return getLocal();

      try {
        const { data, error } = await supabase
          .from('payroll_vouchers')
          .select('*, staff:staff_id(name, role)')
          .eq('month', month)
          .order('created_at', { ascending: false });

        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('payroll_vouchers'); return getLocal(); }
          throw error;
        }

        return (data ?? []).map((v: any) => ({
          id: v.id, voucher_id: v.voucher_id, staff_id: v.staff_id, payroll_id: v.payroll_id,
          month: v.month, net_salary: Number(v.net_salary), payment_status: v.payment_status,
          payment_date: v.payment_date, tenant_id: v.tenant_id, created_at: v.created_at,
          staff_name: v.staff?.name || 'Unknown', staff_role: v.staff?.role || 'Unknown',
        }));
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('payroll_vouchers'); return getLocal(); }
        throw err;
      }
    },

    createVouchers: async (
      vouchers: Omit<PayrollVoucher, 'id' | 'created_at' | 'staff_name' | 'staff_role'>[],
    ): Promise<PayrollVoucher[]> => {
      const saveLocal = async (): Promise<PayrollVoucher[]> => {
        const list: any[] = JSON.parse(localStorage.getItem(OFFLINE_KEYS.PAYROLL_VOUCHERS) || '[]');
        const newVouchers = vouchers.map(v => ({
          ...v, id: crypto.randomUUID(),
          payment_date: v.payment_status === 'Paid' ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
        }));
        localStorage.setItem(OFFLINE_KEYS.PAYROLL_VOUCHERS, JSON.stringify([...list, ...newVouchers]));
        const staff = await staffManagementApi.staff.getAll(vouchers[0]?.tenant_id ?? undefined);
        return newVouchers.map(v => {
          const s = staff.find(st => st.id === v.staff_id);
          return { ...v, staff_name: s?.name || 'Unknown', staff_role: s?.role || 'Unknown' };
        });
      };

      if (useLocal('payroll_vouchers')) return saveLocal();

      try {
        const { data, error } = await supabase.from('payroll_vouchers')
          .insert(vouchers.map(v => ({ ...v, payment_date: v.payment_status === 'Paid' ? new Date().toISOString() : null })))
          .select();
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('payroll_vouchers'); return saveLocal(); }
          throw error;
        }
        const staff = await staffManagementApi.staff.getAll(vouchers[0]?.tenant_id ?? undefined);
        return (data as any[]).map(v => {
          const s = staff.find(st => st.id === v.staff_id);
          return { ...v, net_salary: Number(v.net_salary), staff_name: s?.name || 'Unknown', staff_role: s?.role || 'Unknown' };
        });
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('payroll_vouchers'); return saveLocal(); }
        throw err;
      }
    },

    updateStatus: async (id: string, status: 'Paid' | 'Pending'): Promise<void> => {
      const updateLocal = () => {
        const list: any[] = JSON.parse(localStorage.getItem(OFFLINE_KEYS.PAYROLL_VOUCHERS) || '[]');
        const idx = list.findIndex(v => v.id === id);
        if (idx !== -1) {
          list[idx].payment_status = status;
          list[idx].payment_date = status === 'Paid' ? new Date().toISOString() : null;
          localStorage.setItem(OFFLINE_KEYS.PAYROLL_VOUCHERS, JSON.stringify(list));
        }
      };

      if (useLocal('payroll_vouchers')) return updateLocal();

      try {
        const { error } = await supabase.from('payroll_vouchers').update({
          payment_status: status,
          payment_date: status === 'Paid' ? new Date().toISOString() : null,
        }).eq('id', id);
        if (error) {
          if (isSchemaMissing(error)) { markTableMissing('payroll_vouchers'); return updateLocal(); }
          throw error;
        }
      } catch (err: any) {
        if (isSchemaMissing(err)) { markTableMissing('payroll_vouchers'); return updateLocal(); }
        throw err;
      }
    },
  },
};
