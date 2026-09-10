import { z } from 'zod';
import { supabaseServer, getRestaurantIdFromRequest } from '../_db';
import { generateAndUploadVoucherPDF } from '../_pdf';

const GenerateVoucherSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
  base_salary: z.number().nonnegative(),
  present_days: z.number().nonnegative(),
  absent_days: z.number().nonnegative(),
  bonus: z.number().default(0),
  advances: z.number().default(0),
  deductions: z.number().default(0),
  net_salary: z.number().nonnegative(),
});

export async function handleGenerateVoucher(reqBody: any, req: any) {
  const restaurantId = await getRestaurantIdFromRequest(req);
  if (!restaurantId) {
    return { status: 401, body: { success: false, error: 'Unauthorized: Restaurant session missing or invalid' } };
  }

  const parseResult = GenerateVoucherSchema.safeParse(reqBody);
  if (!parseResult.success) {
    return { status: 400, body: { success: false, error: parseResult.error.errors[0]?.message || 'Validation error' } };
  }

  const { employee_id, month, base_salary, present_days, absent_days, bonus, advances, deductions, net_salary } = parseResult.data;
  const monthDate = `${month}-01`;

  // 1. Fetch restaurant / tenant info
  const { data: tenant } = await supabaseServer
    .from('tenants')
    .select('restaurant_name')
    .eq('id', restaurantId)
    .maybeSingle();

  const restaurantName = tenant?.restaurant_name || 'GENX POS RESTAURANT';

  // 2. Fetch employee details
  let employeeName = 'Employee';
  let employeeRole = 'Staff';
  let cnic = '';
  let bankAccount = '';

  const { data: emp } = await supabaseServer
    .from('employees')
    .select('*')
    .eq('id', employee_id)
    .maybeSingle();

  if (emp) {
    employeeName = emp.name;
    employeeRole = emp.role;
    cnic = emp.cnic || '';
    bankAccount = emp.bank_account || '';
  } else {
    // Check staff table
    const { data: staff } = await supabaseServer
      .from('staff')
      .select('*')
      .eq('id', employee_id)
      .maybeSingle();
    if (staff) {
      employeeName = staff.name;
      employeeRole = staff.role;
      cnic = staff.cnic || '';
      bankAccount = staff.bank_account || '';
    }
  }

  // 3. Generate unique voucher number: e.g. VCH-YYYYMM-XXXX
  const cleanMonth = month.replace('-', '');
  const empSuffix = employee_id.replace(/-/g, '').slice(0, 4).toUpperCase();
  const voucher_no = `VCH-${cleanMonth}-${empSuffix}`;

  // 4. Save/upsert to payroll_history
  await supabaseServer
    .from('payroll_history')
    .upsert({
      restaurant_id: restaurantId,
      employee_id,
      month: monthDate,
      base_salary,
      present_days,
      absent_days,
      bonus,
      advances,
      deductions,
      net_salary,
    }, {
      onConflict: 'restaurant_id,employee_id,month'
    });

  // 5. Generate PDF and upload to Vercel Blob / Supabase Storage
  let pdf_url = '';
  try {
    pdf_url = await generateAndUploadVoucherPDF({
      voucher_no,
      restaurant_name: restaurantName,
      employee_name: employeeName,
      employee_role: employeeRole,
      cnic,
      bank_account: bankAccount,
      month,
      base_salary,
      present_days,
      absent_days,
      bonus,
      advances,
      deductions,
      net_salary,
      created_at: new Date().toISOString(),
    }, restaurantId);
  } catch (pdfErr) {
    console.error('[PDF Generation error]:', pdfErr);
  }

  // 6. Save/upsert into salary_vouchers
  const { data: voucherData, error: voucherErr } = await supabaseServer
    .from('salary_vouchers')
    .upsert({
      restaurant_id: restaurantId,
      employee_id,
      month: monthDate,
      net_salary,
      voucher_no,
      pdf_url: pdf_url || null,
      status: 'generated',
    }, {
      onConflict: 'restaurant_id,voucher_no'
    })
    .select()
    .single();

  if (voucherErr) {
    console.error('[API voucher insert error]:', voucherErr);
    return { status: 500, body: { success: false, error: voucherErr.message } };
  }

  return {
    status: 200,
    body: {
      success: true,
      voucher: voucherData,
      pdf_url: voucherData?.pdf_url || pdf_url,
      voucher_no
    }
  };
}

// Next.js Pages Router / Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const result = await handleGenerateVoucher(body, req);
  return res.status(result.status).json(result.body);
}

// Next.js App Router export
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await handleGenerateVoucher(body, request);
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
