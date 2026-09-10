import { z } from 'zod';
import { supabaseServer, getRestaurantIdFromRequest } from '../_db';

const CalculatePayrollSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
});

export async function handleCalculatePayroll(queryParams: any, req: any) {
  const restaurantId = await getRestaurantIdFromRequest(req);
  if (!restaurantId) {
    return { status: 401, body: { success: false, error: 'Unauthorized: Restaurant session missing or invalid' } };
  }

  const parseResult = CalculatePayrollSchema.safeParse(queryParams);
  if (!parseResult.success) {
    return { status: 400, body: { success: false, error: parseResult.error.errors[0]?.message || 'Invalid month parameter' } };
  }

  const { month } = parseResult.data;
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  // 1. Fetch active employees (checking employees table, fallback to staff table)
  let employees: any[] = [];
  const { data: empData, error: empErr } = await supabaseServer
    .from('employees')
    .select('*')
    .or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`)
    .eq('is_active', true);

  if (!empErr && empData && empData.length > 0) {
    employees = empData;
  } else {
    // Fallback check on 'staff' table
    const { data: staffData } = await supabaseServer
      .from('staff')
      .select('*')
      .or(`tenant_id.eq.${restaurantId},tenant_id.is.null`)
      .eq('is_active', true);
    employees = (staffData || []).map((s: any) => ({
      id: s.id,
      restaurant_id: s.tenant_id || restaurantId,
      name: s.name,
      role: s.role,
      phone: s.phone,
      email: s.email,
      cnic: s.cnic || '',
      bank_account: s.bank_account || '',
      salary_type: s.salary_type || 'monthly',
      salary_amount: Number(s.salary_amount || 0),
      joining_date: s.joining_date,
      is_active: s.is_active !== false,
    }));
  }

  // 2. Fetch attendance logs for the month
  const { data: attendanceLogs } = await supabaseServer
    .from('attendance_logs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('date', startDate)
    .lte('date', endDate);

  // 3. Fetch advances to be deducted in this month
  const { data: advancesList } = await supabaseServer
    .from('salary_advances')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('deducted_in_month', startDate)
    .lte('deducted_in_month', endDate);

  // 4. Fetch existing saved payroll history for this month
  const { data: savedPayrolls } = await supabaseServer
    .from('payroll_history')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('month', `${month}-01`);

  // 5. Fetch generated salary vouchers for this month
  const { data: generatedVouchers } = await supabaseServer
    .from('salary_vouchers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('month', `${month}-01`);

  const savedPayrollMap = new Map((savedPayrolls || []).map((p: any) => [p.employee_id, p]));
  const voucherMap = new Map((generatedVouchers || []).map((v: any) => [v.employee_id, v]));

  // 6. Calculate Net Salary for each employee
  const payrollTable = employees.map((emp: any) => {
    const empLogs = (attendanceLogs || []).filter((l: any) => l.employee_id === emp.id);
    let presentCount = 0;
    let absentCount = 0;
    let halfdayCount = 0;
    let leaveCount = 0;

    empLogs.forEach((log: any) => {
      if (log.status === 'present') presentCount += 1;
      else if (log.status === 'absent') absentCount += 1;
      else if (log.status === 'halfday') halfdayCount += 1;
      else if (log.status === 'leave') leaveCount += 1;
    });

    const calculatedPresentDays = presentCount + leaveCount + (halfdayCount * 0.5);
    const calculatedAbsentDays = absentCount + (halfdayCount * 0.5);

    // Sum advances for this employee in requested month
    const empAdvances = (advancesList || [])
      .filter((a: any) => a.employee_id === emp.id)
      .reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);

    const baseSalary = Number(emp.salary_amount || 0);
    const saved = savedPayrollMap.get(emp.id);

    // Formula per requirement: PerDay = base_salary / 30
    const perDayRate = baseSalary / 30;
    const absentDeduction = calculatedAbsentDays * perDayRate;

    const bonus = saved ? Number(saved.bonus || 0) : 0;
    const otherDeductions = saved ? Number(saved.deductions || 0) : Math.round(absentDeduction * 100) / 100;
    const totalAdvances = saved && saved.advances !== undefined ? Number(saved.advances) : empAdvances;

    // Logic: Net = Base + Bonus - Advances - (Absent * PerDay)
    let netSalary = 0;
    if (emp.salary_type === 'daily') {
      netSalary = (calculatedPresentDays * baseSalary) + bonus - totalAdvances;
    } else {
      netSalary = baseSalary + bonus - totalAdvances - otherDeductions;
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
      present_days: calculatedPresentDays,
      absent_days: calculatedAbsentDays,
      halfday_days: halfdayCount,
      leave_days: leaveCount,
      bonus,
      advances: totalAdvances,
      deductions: otherDeductions,
      net_salary: netSalary,
      is_voucher_generated: !!voucher,
      voucher_no: voucher?.voucher_no || null,
      voucher_status: voucher?.status || null,
      pdf_url: voucher?.pdf_url || null,
    };
  });

  return {
    status: 200,
    body: {
      success: true,
      month,
      payroll: payrollTable
    }
  };
}

// Next.js Pages Router / Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }

  const result = await handleCalculatePayroll(req.query, req);
  return res.status(result.status).json(result.body);
}

// Next.js App Router export
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryParams = {
      month: url.searchParams.get('month') || new Date().toISOString().slice(0, 7),
    };
    const result = await handleCalculatePayroll(queryParams, request);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
