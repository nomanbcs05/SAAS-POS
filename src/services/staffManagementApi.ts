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
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'half_day' | 'leave';
  check_in?: string;
  check_out?: string;
  tenant_id?: string | null;
  created_at?: string;
}

export interface StaffPayroll {
  id?: string;
  staff_id: string;
  month: string; // YYYY-MM
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
  staff_name?: string; // joined helper
  staff_role?: string; // joined helper
}

// Local Storage Keys
const OFFLINE_KEYS = {
  STAFF_ATTENDANCE: 'pos_offline_staff_attendance',
  STAFF_PAYROLL: 'pos_offline_staff_payroll',
  PAYROLL_VOUCHERS: 'pos_offline_payroll_vouchers',
};

// Rate limiting toast notifications
let lastToastTime = 0;
const warnMissingTables = (tableName: string, details?: string) => {
  const now = Date.now();
  if (now - lastToastTime > 15000) { // Show at most once every 15 seconds
    toast.warning(`Running in local storage mode for "${tableName}".`, {
      description: details || "Please check your Supabase schema and run the migration SQL script."
    });
    lastToastTime = now;
  }
  console.warn(`[StaffManagement] Supabase table "${tableName}" error. Falling back to offline local storage:`, details);
};

// Check if error warrants falling back to local storage
const shouldFallbackToOffline = (error: any): boolean => {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  const code = String(error.code || '');
  const status = Number(error.status || 0);
  
  return (
    status === 404 || 
    status === 400 || // Bad Request (stale schema cache / mismatch)
    code === '42P01' || // Undefined table
    code === '42703' || // Undefined column
    code === 'PGRST116' ||
    code === 'PGRST200' ||
    message.includes('not found') || 
    message.includes('does not exist') || 
    message.includes('relation') ||
    message.includes('column')
  );
};

export const staffManagementApi = {
  // Staff CRUD Operations
  staff: {
    getAll: async (tenantId?: string): Promise<Staff[]> => {
      const getLocal = () => {
        const localUsers = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        return localUsers.map((u: any) => ({
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
        })) as Staff[];
      };

      if (isDesktop() || !offline.isOnline()) {
        return getLocal();
      }

      try {
        let query = supabase.from('staff').select('*');
        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }
        
        const { data, error } = await query.order('name');
        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('staff', error.message);
            return getLocal();
          }
          throw error;
        }
        return (data || []) as unknown as Staff[];
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('staff', (err as any).message);
          return getLocal();
        }
        throw err;
      }
    },

    create: async (staffData: Omit<Staff, 'id' | 'created_at'>): Promise<Staff> => {
      const saveLocal = () => {
        const localUsers = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        const newId = crypto.randomUUID();
        const newStaff = {
          ...staffData,
          id: newId,
          full_name: staffData.name,
          email: staffData.email || `${staffData.name.toLowerCase().replace(/\s+/g, '')}@offline.pos`,
          password: 'password123',
          is_active: true,
          created_at: new Date().toISOString(),
        };
        localUsers.push(newStaff);
        localStorage.setItem('pos_local_users', JSON.stringify(localUsers));
        return {
          id: newId,
          name: staffData.name,
          role: staffData.role,
          phone: staffData.phone,
          email: staffData.email,
          salary_type: staffData.salary_type,
          salary_amount: staffData.salary_amount,
          joining_date: staffData.joining_date,
          is_active: true,
          tenant_id: staffData.tenant_id,
        };
      };

      if (isDesktop() || !offline.isOnline()) {
        return saveLocal();
      }

      try {
        const { data, error } = await supabase
          .from('staff')
          .insert(staffData)
          .select()
          .single();
        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('staff', error.message);
            return saveLocal();
          }
          throw error;
        }
        return data as unknown as Staff;
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('staff', (err as any).message);
          return saveLocal();
        }
        throw err;
      }
    },

    update: async (id: string, staffData: Partial<Staff>): Promise<Staff> => {
      const updateLocal = () => {
        const localUsers = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        const idx = localUsers.findIndex((u: any) => u.id === id);
        if (idx === -1) throw new Error('Staff member not found');
        
        const updated = {
          ...localUsers[idx],
          ...staffData,
          full_name: staffData.name || localUsers[idx].full_name || localUsers[idx].name,
        };
        localUsers[idx] = updated;
        localStorage.setItem('pos_local_users', JSON.stringify(localUsers));
        
        return {
          id,
          name: updated.full_name,
          role: updated.role,
          phone: updated.phone,
          email: updated.email,
          salary_type: updated.salary_type,
          salary_amount: Number(updated.salary_amount),
          joining_date: updated.joining_date,
          is_active: updated.is_active,
          tenant_id: updated.tenant_id,
        };
      };

      if (isDesktop() || !offline.isOnline()) {
        return updateLocal();
      }

      try {
        const { data, error } = await supabase
          .from('staff')
          .update(staffData)
          .eq('id', id)
          .select()
          .single();
        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('staff', error.message);
            return updateLocal();
          }
          throw error;
        }
        return data as unknown as Staff;
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('staff', (err as any).message);
          return updateLocal();
        }
        throw err;
      }
    },

    delete: async (id: string): Promise<void> => {
      const deleteLocal = () => {
        const localUsers = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        const filtered = localUsers.filter((u: any) => u.id !== id);
        localStorage.setItem('pos_local_users', JSON.stringify(filtered));
      };

      if (isDesktop() || !offline.isOnline()) {
        return deleteLocal();
      }

      try {
        const { error } = await supabase
          .from('staff')
          .delete()
          .eq('id', id);
        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('staff', error.message);
            return deleteLocal();
          }
          throw error;
        }
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('staff', (err as any).message);
          return deleteLocal();
        }
        throw err;
      }
    }
  },

  // Attendance Operations
  attendance: {
    getByDate: async (date: string, tenantId?: string): Promise<StaffAttendance[]> => {
      const getLocal = () => {
        const list = JSON.parse(localStorage.getItem(OFFLINE_KEYS.STAFF_ATTENDANCE) || '[]');
        return list.filter((a: any) => a.date === date) as StaffAttendance[];
      };

      if (isDesktop() || !offline.isOnline()) {
        return getLocal();
      }

      try {
        let query = supabase.from('staff_attendance').select('*').eq('date', date);
        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }
        
        const { data, error } = await query;
        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('staff_attendance', error.message);
            return getLocal();
          }
          throw error;
        }
        return (data || []) as unknown as StaffAttendance[];
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('staff_attendance', (err as any).message);
          return getLocal();
        }
        throw err;
      }
    },

    getByMonth: async (month: string, tenantId?: string): Promise<StaffAttendance[]> => {
      const getLocal = () => {
        const list = JSON.parse(localStorage.getItem(OFFLINE_KEYS.STAFF_ATTENDANCE) || '[]');
        return list.filter((a: any) => a.date.startsWith(month)) as StaffAttendance[];
      };

      if (isDesktop() || !offline.isOnline()) {
        return getLocal();
      }

      try {
        let query = supabase
          .from('staff_attendance')
          .select('*')
          .gte('date', `${month}-01`)
          .lte('date', `${month}-31`);
        
        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }
        
        const { data, error } = await query;
        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('staff_attendance', error.message);
            return getLocal();
          }
          throw error;
        }
        return (data || []) as unknown as StaffAttendance[];
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('staff_attendance', (err as any).message);
          return getLocal();
        }
        throw err;
      }
    },

    saveDaily: async (records: StaffAttendance[]): Promise<StaffAttendance[]> => {
      const saveLocal = () => {
        const list = JSON.parse(localStorage.getItem(OFFLINE_KEYS.STAFF_ATTENDANCE) || '[]');
        const staffIds = records.map(r => r.staff_id);
        const date = records[0]?.date;
        let filtered = list.filter((a: any) => !(a.date === date && staffIds.includes(a.staff_id)));
        
        const newRecords = records.map(r => ({
          ...r,
          id: r.id || crypto.randomUUID(),
          created_at: new Date().toISOString()
        }));
        
        filtered.push(...newRecords);
        localStorage.setItem(OFFLINE_KEYS.STAFF_ATTENDANCE, JSON.stringify(filtered));
        return newRecords as StaffAttendance[];
      };

      if (isDesktop() || !offline.isOnline()) {
        return saveLocal();
      }

      try {
        const { data, error } = await supabase
          .from('staff_attendance')
          .upsert(records, { onConflict: 'staff_id,date' })
          .select();
        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('staff_attendance', error.message);
            return saveLocal();
          }
          throw error;
        }
        return data as unknown as StaffAttendance[];
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('staff_attendance', (err as any).message);
          return saveLocal();
        }
        throw err;
      }
    }
  },

  // Payroll Operations
  payroll: {
    getByMonth: async (month: string, tenantId?: string): Promise<StaffPayroll[]> => {
      const getLocal = () => {
        const list = JSON.parse(localStorage.getItem(OFFLINE_KEYS.STAFF_PAYROLL) || '[]');
        return list.filter((p: any) => p.month === month) as StaffPayroll[];
      };

      if (isDesktop() || !offline.isOnline()) {
        return getLocal();
      }

      try {
        let query = supabase.from('staff_payroll').select('*').eq('month', month);
        if (tenantId) {
          query = query.eq('tenant_id', tenantId);
        }
        
        const { data, error } = await query;
        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('staff_payroll', error.message);
            return getLocal();
          }
          throw error;
        }
        return (data || []) as unknown as StaffPayroll[];
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('staff_payroll', (err as any).message);
          return getLocal();
        }
        throw err;
      }
    },

    save: async (records: StaffPayroll[]): Promise<StaffPayroll[]> => {
      const saveLocal = () => {
        const list = JSON.parse(localStorage.getItem(OFFLINE_KEYS.STAFF_PAYROLL) || '[]');
        const staffIds = records.map(r => r.staff_id);
        const month = records[0]?.month;
        let filtered = list.filter((p: any) => !(p.month === month && staffIds.includes(p.staff_id)));
        
        const newRecords = records.map(r => ({
          ...r,
          id: r.id || crypto.randomUUID(),
          created_at: new Date().toISOString()
        }));
        
        filtered.push(...newRecords);
        localStorage.setItem(OFFLINE_KEYS.STAFF_PAYROLL, JSON.stringify(filtered));
        return newRecords as StaffPayroll[];
      };

      if (isDesktop() || !offline.isOnline()) {
        return saveLocal();
      }

      try {
        const { data, error } = await supabase
          .from('staff_payroll')
          .upsert(records, { onConflict: 'staff_id,month' })
          .select();
        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('staff_payroll', error.message);
            return saveLocal();
          }
          throw error;
        }
        return data as unknown as StaffPayroll[];
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('staff_payroll', (err as any).message);
          return saveLocal();
        }
        throw err;
      }
    },

    calculate: async (month: string, tenantId?: string): Promise<StaffPayroll[]> => {
      const staffList = await staffManagementApi.staff.getAll(tenantId);
      const activeStaff = staffList.filter(s => s.is_active);
      
      const attendance = await staffManagementApi.attendance.getByMonth(month, tenantId);
      
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr);
      const monthIdx = parseInt(monthStr) - 1;
      const totalDays = new Date(year, monthIdx + 1, 0).getDate();
      
      const existingPayrolls = await staffManagementApi.payroll.getByMonth(month, tenantId);
      const existingMap = new Map<string, StaffPayroll>();
      existingPayrolls.forEach(p => existingMap.set(p.staff_id, p));

      const calculatedPayrolls: StaffPayroll[] = activeStaff.map(s => {
        const staffAtt = attendance.filter(a => a.staff_id === s.id);
        
        let presentDays = 0;
        let absentDays = 0;
        
        staffAtt.forEach(a => {
          if (a.status === 'present' || a.status === 'leave') {
            presentDays += 1;
          } else if (a.status === 'half_day') {
            presentDays += 0.5;
            absentDays += 0.5;
          } else if (a.status === 'absent') {
            absentDays += 1;
          }
        });

        const existing = existingMap.get(s.id);
        const bonus = existing ? Number(existing.bonus || 0) : 0;
        const advances = existing ? Number(existing.advances || 0) : 0;
        const base_salary = Number(s.salary_amount || 0);

        let deductions = existing ? Number(existing.deductions || 0) : 0;
        let net_salary = 0;

        if (s.salary_type === 'monthly') {
          const dailyRate = base_salary / (totalDays || 30);
          if (!existing) {
            deductions = absentDays * dailyRate;
          }
          net_salary = base_salary - deductions + bonus - advances;
        } else {
          net_salary = (presentDays * base_salary) + bonus - advances;
        }

        net_salary = Math.round(net_salary * 100) / 100;
        deductions = Math.round(deductions * 100) / 100;

        return {
          id: existing?.id,
          staff_id: s.id,
          month,
          base_salary,
          present_days: Math.round(presentDays * 2) / 2,
          absent_days: Math.round(absentDays * 2) / 2,
          bonus,
          advances,
          deductions,
          net_salary,
          tenant_id: s.tenant_id || tenantId,
        };
      });

      return calculatedPayrolls;
    }
  },

  // Voucher Operations
  vouchers: {
    getByMonth: async (month: string, tenantId?: string): Promise<PayrollVoucher[]> => {
      const getLocal = async () => {
        const vouchers = JSON.parse(localStorage.getItem(OFFLINE_KEYS.PAYROLL_VOUCHERS) || '[]');
        const filtered = vouchers.filter((v: any) => v.month === month);
        
        const staff = await staffManagementApi.staff.getAll(tenantId);
        return filtered.map((v: any) => {
          const s = staff.find(st => st.id === v.staff_id);
          return {
            ...v,
            staff_name: s ? s.name : 'Unknown',
            staff_role: s ? s.role : 'Unknown'
          };
        });
      };

      if (isDesktop() || !offline.isOnline()) {
        return getLocal();
      }

      try {
        const { data, error } = await supabase
          .from('payroll_vouchers')
          .select(`
            *,
            staff:staff_id (
              name,
              role
            )
          `)
          .eq('month', month)
          .order('created_at', { ascending: false });

        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('payroll_vouchers', error.message);
            return getLocal();
          }
          throw error;
        }
        
        return (data || []).map((v: any) => ({
          id: v.id,
          voucher_id: v.voucher_id,
          staff_id: v.staff_id,
          payroll_id: v.payroll_id,
          month: v.month,
          net_salary: Number(v.net_salary),
          payment_status: v.payment_status,
          payment_date: v.payment_date,
          tenant_id: v.tenant_id,
          created_at: v.created_at,
          staff_name: v.staff?.name || 'Unknown',
          staff_role: v.staff?.role || 'Unknown'
        })) as PayrollVoucher[];
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('payroll_vouchers', (err as any).message);
          return getLocal();
        }
        throw err;
      }
    },

    createVouchers: async (vouchers: Omit<PayrollVoucher, 'id' | 'created_at' | 'staff_name' | 'staff_role'>[]): Promise<PayrollVoucher[]> => {
      const saveLocal = async () => {
        const list = JSON.parse(localStorage.getItem(OFFLINE_KEYS.PAYROLL_VOUCHERS) || '[]');
        const newVouchers = vouchers.map(v => ({
          ...v,
          id: crypto.randomUUID(),
          payment_date: v.payment_status === 'Paid' ? new Date().toISOString() : null,
          created_at: new Date().toISOString()
        }));
        
        list.push(...newVouchers);
        localStorage.setItem(OFFLINE_KEYS.PAYROLL_VOUCHERS, JSON.stringify(list));
        
        const staff = await staffManagementApi.staff.getAll(vouchers[0]?.tenant_id || undefined);
        return newVouchers.map((v: any) => {
          const s = staff.find(st => st.id === v.staff_id);
          return {
            ...v,
            staff_name: s ? s.name : 'Unknown',
            staff_role: s ? s.role : 'Unknown'
          };
        });
      };

      if (isDesktop() || !offline.isOnline()) {
        return saveLocal();
      }

      try {
        const { data, error } = await supabase
          .from('payroll_vouchers')
          .insert(vouchers.map(v => ({
            ...v,
            payment_date: v.payment_status === 'Paid' ? new Date().toISOString() : null
          })))
          .select();

        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('payroll_vouchers', error.message);
            return saveLocal();
          }
          throw error;
        }
        
        const result = data as any[];
        const staff = await staffManagementApi.staff.getAll(vouchers[0]?.tenant_id || undefined);
        return result.map(v => {
          const s = staff.find(st => st.id === v.staff_id);
          return {
            ...v,
            net_salary: Number(v.net_salary),
            staff_name: s ? s.name : 'Unknown',
            staff_role: s ? s.role : 'Unknown'
          };
        });
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('payroll_vouchers', (err as any).message);
          return saveLocal();
        }
        throw err;
      }
    },

    updateStatus: async (id: string, status: 'Paid' | 'Pending'): Promise<void> => {
      const updateLocal = () => {
        const list = JSON.parse(localStorage.getItem(OFFLINE_KEYS.PAYROLL_VOUCHERS) || '[]');
        const idx = list.findIndex((v: any) => v.id === id);
        if (idx !== -1) {
          list[idx].payment_status = status;
          list[idx].payment_date = status === 'Paid' ? new Date().toISOString() : null;
          localStorage.setItem(OFFLINE_KEYS.PAYROLL_VOUCHERS, JSON.stringify(list));
        }
      };

      if (isDesktop() || !offline.isOnline()) {
        return updateLocal();
      }

      try {
        const { error } = await supabase
          .from('payroll_vouchers')
          .update({
            payment_status: status,
            payment_date: status === 'Paid' ? new Date().toISOString() : null
          })
          .eq('id', id);
          
        if (error) {
          if (shouldFallbackToOffline(error)) {
            warnMissingTables('payroll_vouchers', error.message);
            return updateLocal();
          }
          throw error;
        }
      } catch (err) {
        if (shouldFallbackToOffline(err)) {
          warnMissingTables('payroll_vouchers', (err as any).message);
          return updateLocal();
        }
        throw err;
      }
    }
  }
};
