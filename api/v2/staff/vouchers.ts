import { z } from 'zod';
import { supabaseServer, getRestaurantIdFromRequest } from './_db';

const VouchersQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
});

export async function handleGetVouchers(queryParams: any, req: any) {
  const restaurantId = await getRestaurantIdFromRequest(req);
  if (!restaurantId) {
    return { status: 401, body: { success: false, error: 'Unauthorized: Restaurant session missing or invalid' } };
  }

  const parseResult = VouchersQuerySchema.safeParse(queryParams);
  if (!parseResult.success) {
    return { status: 400, body: { success: false, error: parseResult.error.errors[0]?.message || 'Invalid month parameter' } };
  }

  const { month } = parseResult.data;
  const monthDate = `${month}-01`;

  // Fetch vouchers for the month
  const { data: vouchers, error } = await supabaseServer
    .from('salary_vouchers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('month', monthDate)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API get vouchers error]:', error);
    return { status: 500, body: { success: false, error: error.message } };
  }

  // Fetch employee details to attach names & roles
  let employees: any[] = [];
  const { data: empList } = await supabaseServer
    .from('employees')
    .select('id, name, role, cnic, bank_account')
    .or(`restaurant_id.eq.${restaurantId},restaurant_id.is.null`);

  if (empList && empList.length > 0) {
    employees = empList;
  } else {
    const { data: staffList } = await supabaseServer
      .from('staff')
      .select('id, name, role, cnic, bank_account')
      .or(`tenant_id.eq.${restaurantId},tenant_id.is.null`);
    employees = staffList || [];
  }

  const empMap = new Map(employees.map(e => [e.id, e]));

  const enrichedVouchers = (vouchers || []).map((v: any) => {
    const emp = empMap.get(v.employee_id);
    return {
      ...v,
      employee_name: emp?.name || 'Staff Member',
      employee_role: emp?.role || 'Staff',
      cnic: emp?.cnic || '',
      bank_account: emp?.bank_account || '',
    };
  });

  return {
    status: 200,
    body: {
      success: true,
      month,
      vouchers: enrichedVouchers
    }
  };
}

// Next.js Pages Router / Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  if (req.method === 'PATCH' || req.method === 'POST') {
    // Optional status update handler (e.g. mark paid)
    const restaurantId = await getRestaurantIdFromRequest(req);
    if (!restaurantId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { id, status } = body;
    if (!id || !status) return res.status(400).json({ success: false, error: 'Voucher ID and status required' });

    const { error: updateErr } = await supabaseServer
      .from('salary_vouchers')
      .update({
        status,
        paid_date: status === 'paid' ? new Date().toISOString() : null
      })
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (updateErr) return res.status(500).json({ success: false, error: updateErr.message });
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }

  const result = await handleGetVouchers(req.query, req);
  return res.status(result.status).json(result.body);
}

// Next.js App Router export
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryParams = {
      month: url.searchParams.get('month') || new Date().toISOString().slice(0, 7),
    };
    const result = await handleGetVouchers(queryParams, request);
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
