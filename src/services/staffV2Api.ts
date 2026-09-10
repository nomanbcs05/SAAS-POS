import { supabase } from '@/integrations/supabase/client';
import { isDesktop } from '@/lib/env';
import * as offline from '@/services/offlineStore';

export interface EmployeeV2 {
  id: string;
  name: string;
  role: 'cashier' | 'waiter' | 'chef' | 'cleaner' | 'manager' | string;
  phone?: string;
  email?: string;
  pin?: string;
  cnic?: string;
  bank_account?: string;
  salary_type: 'monthly' | 'daily' | 'hourly';
  salary_amount: number;
  joining_date: string;
  is_active: boolean;
  restaurant_id?: string | null;
  created_at?: string;
}

export interface AttendanceLogV2 {
  id?: string;
  restaurant_id?: string | null;
  employee_id: string;
  date: string;
  status: 'present' | 'absent' | 'halfday' | 'leave';
  check_in?: string | null;
  check_out?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface SalaryAdvanceV2 {
  id?: string;
  restaurant_id?: string | null;
  employee_id: string;
  date: string;
  amount: number;
  reason?: string;
  deducted_in_month: string;
  created_by?: string | null;
  created_at?: string;
}

export interface PayrollItemV2 {
  employee_id: string;
  name: string;
  role: string;
  cnic?: string;
  bank_account?: string;
  salary_type: 'monthly' | 'daily' | 'hourly';
  base_salary: number;
  per_day_rate: number;
  present_days: number;
  absent_days: number;
  halfday_days?: number;
  leave_days?: number;
  bonus: number;
  advances: number;
  deductions: number;
  net_salary: number;
  is_voucher_generated?: boolean;
  voucher_no?: string | null;
  voucher_status?: string | null;
  pdf_url?: string | null;
}

export interface SalaryVoucherV2 {
  id: string;
  restaurant_id: string;
  employee_id: string;
  employee_name: string;
  employee_role: string;
  cnic?: string;
  bank_account?: string;
  month: string;
  net_salary: number;
  voucher_no: string;
  pdf_url?: string | null;
  status: 'generated' | 'paid';
  paid_date?: string | null;
  created_at?: string;
}

// Check feature flag from tenant settings or env
export const isStaffV2Enabled = (tenant?: any): boolean => {
  if (import.meta.env.VITE_STAFF_V2_ENABLED === 'true') return true;
  if (typeof window !== 'undefined' && localStorage.getItem('staff_management_v2') === 'true') return true;
  if (tenant?.staff_management_v2 === true) return true;
  return true; // Enabled by default for PRO mode rollout
};

const getAuthHeaders = (restaurantId?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (restaurantId) {
    headers['x-restaurant-id'] = restaurantId;
  }
  return headers;
};

export const staffV2Api = {
  // ---------------------------------------------------------------------------
  // Staff / Employees CRUD
  // ---------------------------------------------------------------------------
  staff: {
    getAll: async (restaurantId?: string): Promise<EmployeeV2[]> => {
      // 1. Try employees table
      try {
        let q = supabase.from('employees' as any).select('*');
        if (restaurantId) q = q.or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`);
        const { data, error } = await q.order('name');
        if (!error && data && data.length > 0) {
          return data as unknown as EmployeeV2[];
        }
      } catch { /* fallback */ }

      // 2. Fallback to staff table
      try {
        let q = supabase.from('staff' as any).select('*');
        if (restaurantId) q = q.or(`tenant_id.eq.${restaurantId},tenant_id.is.null`);
        const { data, error } = await q.order('name');
        if (!error && data) {
          return (data as any[]).map(s => ({
            id: s.id,
            name: s.name,
            role: s.role,
            phone: s.phone || '',
            email: s.email || '',
            pin: s.pin || '',
            cnic: s.cnic || '',
            bank_account: s.bank_account || '',
            salary_type: s.salary_type || 'monthly',
            salary_amount: Number(s.salary_amount || 0),
            joining_date: s.joining_date || new Date().toISOString().split('T')[0],
            is_active: s.is_active !== false,
            restaurant_id: s.tenant_id || restaurantId,
          }));
        }
      } catch { /* fallback */ }

      // 3. Fallback to local storage
      const localUsers: any[] = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
      return localUsers.map(u => ({
        id: u.id,
        name: u.full_name || u.name,
        role: u.role || 'cashier',
        phone: u.phone || '',
        email: u.email || '',
        pin: u.pin || '',
        cnic: u.cnic || '',
        bank_account: u.bank_account || '',
        salary_type: u.salary_type || 'monthly',
        salary_amount: Number(u.salary_amount || 0),
        joining_date: u.joining_date || new Date().toISOString().split('T')[0],
        is_active: u.is_active !== false,
        restaurant_id: u.tenant_id || restaurantId,
      }));
    },

    create: async (payload: Omit<EmployeeV2, 'id' | 'created_at'>): Promise<EmployeeV2> => {
      // 1. Try employees table
      try {
        const { data, error } = await supabase.from('employees' as any).insert(payload).select().single();
        if (!error && data) return data as unknown as EmployeeV2;
      } catch { /* fallback */ }

      // 2. Try staff table
      try {
        const staffPayload = {
          name: payload.name,
          role: payload.role,
          phone: payload.phone,
          email: payload.email,
          pin: payload.pin,
          cnic: payload.cnic,
          bank_account: payload.bank_account,
          salary_type: payload.salary_type,
          salary_amount: payload.salary_amount,
          joining_date: payload.joining_date,
          is_active: payload.is_active,
          tenant_id: payload.restaurant_id,
        };
        const { data, error } = await supabase.from('staff' as any).insert(staffPayload).select().single();
        if (!error && data) {
          return {
            ...payload,
            id: (data as any).id,
          };
        }
      } catch { /* fallback */ }

      // 3. Local fallback
      const users: any[] = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
      const id = crypto.randomUUID();
      users.push({ ...payload, id, full_name: payload.name });
      localStorage.setItem('pos_local_users', JSON.stringify(users));
      return { id, ...payload };
    },

    update: async (id: string, payload: Partial<EmployeeV2>): Promise<EmployeeV2> => {
      // 1. Try employees table
      try {
        const { data, error } = await supabase.from('employees' as any).update(payload).eq('id', id).select().single();
        if (!error && data) return data as unknown as EmployeeV2;
      } catch { /* fallback */ }

      // 2. Try staff table
      try {
        const staffPayload: any = { ...payload };
        if (payload.restaurant_id) staffPayload.tenant_id = payload.restaurant_id;
        const { data, error } = await supabase.from('staff' as any).update(staffPayload).eq('id', id).select().single();
        if (!error && data) return { ...payload, id } as EmployeeV2;
      } catch { /* fallback */ }

      // 3. Local fallback
      const users: any[] = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
      const idx = users.findIndex(u => u.id === id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...payload, full_name: payload.name || users[idx].full_name };
        localStorage.setItem('pos_local_users', JSON.stringify(users));
      }
      return { id, ...payload } as EmployeeV2;
    },

    delete: async (id: string): Promise<void> => {
      try { await supabase.from('employees' as any).delete().eq('id', id); } catch {}
      try { await supabase.from('staff' as any).delete().eq('id', id); } catch {}
      const users: any[] = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
      localStorage.setItem('pos_local_users', JSON.stringify(users.filter(u => u.id !== id)));
    }
  },

  // ---------------------------------------------------------------------------
  // Part B.1 & B.2: Attendance
  // ---------------------------------------------------------------------------
  attendance: {
    // API B.1: Mark Attendance (POST /api/v2/staff/attendance/mark)
    mark: async (
      data: { employee_id: string; date: string; status: 'present' | 'absent' | 'halfday' | 'leave'; check_in?: string; check_out?: string },
      restaurantId?: string
    ) => {
      try {
        const res = await fetch('/api/v2/staff/attendance/mark', {
          method: 'POST',
          headers: getAuthHeaders(restaurantId),
          body: JSON.stringify({ ...data, restaurant_id: restaurantId }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch { /* network / static mode fallback */ }

      // Direct Supabase fallback
      if (restaurantId) {
        const { data: dbData, error } = await supabase
          .from('attendance_logs' as any)
          .upsert({
            restaurant_id: restaurantId,
            employee_id: data.employee_id,
            date: data.date,
            status: data.status,
            check_in: data.check_in || null,
            check_out: data.check_out || null,
          }, {
            onConflict: 'restaurant_id,employee_id,date'
          })
          .select()
          .single();

        if (!error && dbData) return dbData;
      }

      // Legacy staff_attendance fallback
      const statusMap = data.status === 'halfday' ? 'half_day' : data.status;
      await supabase.from('staff_attendance' as any).upsert({
        staff_id: data.employee_id,
        date: data.date,
        status: statusMap,
        tenant_id: restaurantId,
      }, {
        onConflict: 'staff_id,date'
      });

      return data;
    },

    // API B.2: Monthly Report (GET /api/v2/staff/attendance/monthly)
    getMonthly: async (month: string, restaurantId?: string, employeeId?: string) => {
      try {
        const queryParams = new URLSearchParams({ month });
        if (employeeId) queryParams.append('employee_id', employeeId);
        if (restaurantId) queryParams.append('restaurant_id', restaurantId);

        const res = await fetch(`/api/v2/staff/attendance/monthly?${queryParams.toString()}`, {
          headers: getAuthHeaders(restaurantId),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json;
        }
      } catch { /* fallback */ }

      // Direct Supabase fallback
      let q = supabase
        .from('attendance_logs' as any)
        .select('*')
        .gte('date', `${month}-01`)
        .lte('date', `${month}-31`);

      if (restaurantId) q = q.eq('restaurant_id', restaurantId);
      if (employeeId) q = q.eq('employee_id', employeeId);

      const { data: logs } = await q;

      const summary: Record<string, { present: number; absent: number; halfday: number; leave: number; total: number }> = {};
      (logs || []).forEach((log: any) => {
        const emp = log.employee_id;
        if (!summary[emp]) summary[emp] = { present: 0, absent: 0, halfday: 0, leave: 0, total: 0 };
        summary[emp].total += 1;
        if (log.status === 'present') summary[emp].present += 1;
        else if (log.status === 'absent') summary[emp].absent += 1;
        else if (log.status === 'halfday') summary[emp].halfday += 1;
        else if (log.status === 'leave') summary[emp].leave += 1;
      });

      return {
        success: true,
        month,
        summary: employeeId ? (summary[employeeId] || { present: 0, absent: 0, halfday: 0, leave: 0, total: 0 }) : summary,
        logs: logs || []
      };
    }
  },

  // ---------------------------------------------------------------------------
  // Part B.3: Salary Advances
  // ---------------------------------------------------------------------------
  advances: {
    add: async (
      payload: { employee_id: string; amount: number; reason?: string; date?: string; deducted_in_month: string },
      restaurantId?: string
    ) => {
      try {
        const res = await fetch('/api/v2/staff/advance/add', {
          method: 'POST',
          headers: getAuthHeaders(restaurantId),
          body: JSON.stringify({ ...payload, restaurant_id: restaurantId }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json.data;
        }
      } catch { /* fallback */ }

      // Direct Supabase fallback
      const formattedMonth = payload.deducted_in_month.length === 7 ? `${payload.deducted_in_month}-01` : payload.deducted_in_month;
      const { data, error } = await supabase
        .from('salary_advances' as any)
        .insert({
          restaurant_id: restaurantId,
          employee_id: payload.employee_id,
          amount: payload.amount,
          reason: payload.reason || 'Salary Advance',
          date: payload.date || new Date().toISOString().split('T')[0],
          deducted_in_month: formattedMonth,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    getByMonth: async (month: string, restaurantId?: string): Promise<SalaryAdvanceV2[]> => {
      const startDate = `${month}-01`;
      const endDate = `${month}-31`;
      const { data } = await supabase
        .from('salary_advances' as any)
        .select('*')
        .gte('deducted_in_month', startDate)
        .lte('deducted_in_month', endDate);

      return (data || []) as unknown as SalaryAdvanceV2[];
    }
  },

  // ---------------------------------------------------------------------------
  // Part B.4: Payroll Calculation
  // ---------------------------------------------------------------------------
  payroll: {
    calculate: async (month: string, restaurantId?: string): Promise<PayrollItemV2[]> => {
      try {
        const queryParams = new URLSearchParams({ month });
        if (restaurantId) queryParams.append('restaurant_id', restaurantId);

        const res = await fetch(`/api/v2/staff/payroll/calculate?${queryParams.toString()}`, {
          headers: getAuthHeaders(restaurantId),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.payroll)) return json.payroll;
        }
      } catch { /* fallback */ }

      // Direct calculation fallback using standard formula: PerDay = Base / 30
      const staffList = await staffV2Api.staff.getAll(restaurantId);
      const activeStaff = staffList.filter(s => s.is_active);

      const startDate = `${month}-01`;
      const endDate = `${month}-31`;

      const { data: attLogs } = await supabase
        .from('attendance_logs' as any)
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      const { data: advancesList } = await supabase
        .from('salary_advances' as any)
        .select('*')
        .gte('deducted_in_month', startDate)
        .lte('deducted_in_month', endDate);

      const { data: vouchersList } = await supabase
        .from('salary_vouchers' as any)
        .select('*')
        .eq('month', `${month}-01`);

      const voucherMap = new Map((vouchersList || []).map((v: any) => [v.employee_id, v]));

      return activeStaff.map(emp => {
        const empLogs = (attLogs || []).filter((l: any) => l.employee_id === emp.id);
        let present = 0, absent = 0, halfday = 0, leave = 0;
        empLogs.forEach((l: any) => {
          if (l.status === 'present') present += 1;
          else if (l.status === 'absent') absent += 1;
          else if (l.status === 'halfday') halfday += 1;
          else if (l.status === 'leave') leave += 1;
        });

        const calculatedPresent = present + leave + (halfday * 0.5);
        const calculatedAbsent = absent + (halfday * 0.5);

        const empAdvances = (advancesList || [])
          .filter((a: any) => a.employee_id === emp.id)
          .reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);

        const baseSalary = Number(emp.salary_amount || 0);
        const perDayRate = baseSalary / 30; // Standard Per Day Salary: base_salary / 30
        const absentDeductions = calculatedAbsent * perDayRate;

        let netSalary = 0;
        if (emp.salary_type === 'daily') {
          netSalary = (calculatedPresent * baseSalary) - empAdvances;
        } else {
          netSalary = baseSalary - empAdvances - absentDeductions;
        }
        netSalary = Math.max(0, Math.round(netSalary * 100) / 100);

        const voucher = voucherMap.get(emp.id);

        return {
          employee_id: emp.id,
          name: emp.name,
          role: emp.role,
          cnic: emp.cnic || '',
          bank_account: emp.bank_account || '',
          salary_type: emp.salary_type || 'monthly',
          base_salary: baseSalary,
          per_day_rate: Math.round(perDayRate * 100) / 100,
          present_days: calculatedPresent,
          absent_days: calculatedAbsent,
          halfday_days: halfday,
          leave_days: leave,
          bonus: 0,
          advances: empAdvances,
          deductions: Math.round(absentDeductions * 100) / 100,
          net_salary: netSalary,
          is_voucher_generated: !!voucher,
          voucher_no: voucher?.voucher_no || null,
          voucher_status: voucher?.status || null,
          pdf_url: voucher?.pdf_url || null,
        };
      });
    }
  },

  // ---------------------------------------------------------------------------
  // Part B.5 & B.6: Salary Vouchers
  // ---------------------------------------------------------------------------
  vouchers: {
    // API B.5: Generate Voucher (POST /api/v2/staff/voucher/generate)
    generate: async (payload: {
      employee_id: string;
      month: string;
      base_salary: number;
      present_days: number;
      absent_days: number;
      bonus: number;
      advances: number;
      deductions: number;
      net_salary: number;
    }, restaurantId?: string) => {
      try {
        const res = await fetch('/api/v2/staff/voucher/generate', {
          method: 'POST',
          headers: getAuthHeaders(restaurantId),
          body: JSON.stringify({ ...payload, restaurant_id: restaurantId }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) return json;
        }
      } catch { /* fallback */ }

      // Direct fallback
      const cleanMonth = payload.month.replace('-', '');
      const empSuffix = payload.employee_id.replace(/-/g, '').slice(0, 4).toUpperCase();
      const voucher_no = `VCH-${cleanMonth}-${empSuffix}`;

      const { data, error } = await supabase
        .from('salary_vouchers' as any)
        .upsert({
          restaurant_id: restaurantId,
          employee_id: payload.employee_id,
          month: `${payload.month}-01`,
          net_salary: payload.net_salary,
          voucher_no,
          status: 'generated',
        }, {
          onConflict: 'restaurant_id,voucher_no'
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, voucher: data, voucher_no, pdf_url: null };
    },

    // API B.6: List Vouchers (GET /api/v2/staff/vouchers?month=)
    getByMonth: async (month: string, restaurantId?: string): Promise<SalaryVoucherV2[]> => {
      try {
        const queryParams = new URLSearchParams({ month });
        if (restaurantId) queryParams.append('restaurant_id', restaurantId);

        const res = await fetch(`/api/v2/staff/vouchers?${queryParams.toString()}`, {
          headers: getAuthHeaders(restaurantId),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.vouchers)) return json.vouchers;
        }
      } catch { /* fallback */ }

      // Direct Supabase fallback
      const monthDate = `${month}-01`;
      let q = supabase
        .from('salary_vouchers' as any)
        .select('*')
        .eq('month', monthDate)
        .order('created_at', { ascending: false });

      if (restaurantId) q = q.eq('restaurant_id', restaurantId);
      const { data: vouchers } = await q;

      const staffList = await staffV2Api.staff.getAll(restaurantId);
      const staffMap = new Map(staffList.map(s => [s.id, s]));

      return (vouchers || []).map((v: any) => {
        const staff = staffMap.get(v.employee_id);
        return {
          ...v,
          employee_name: staff?.name || 'Staff Member',
          employee_role: staff?.role || 'Staff',
          cnic: staff?.cnic || '',
          bank_account: staff?.bank_account || '',
        };
      });
    },

    updateStatus: async (id: string, status: 'paid' | 'generated', restaurantId?: string) => {
      const { error } = await supabase
        .from('salary_vouchers' as any)
        .update({
          status,
          paid_date: status === 'paid' ? new Date().toISOString() : null,
        })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    }
  }
};
