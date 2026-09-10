import { z } from 'zod';
import { supabaseServer, getRestaurantIdFromRequest } from '../_db';

const AddAdvanceSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  reason: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').default(() => new Date().toISOString().split('T')[0]),
  deducted_in_month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Deducted month must be YYYY-MM or YYYY-MM-DD'),
  created_by: z.string().optional().nullable(),
});

export async function handleAddAdvance(reqBody: any, req: any) {
  const restaurantId = await getRestaurantIdFromRequest(req);
  if (!restaurantId) {
    return { status: 401, body: { success: false, error: 'Unauthorized: Restaurant session missing or invalid' } };
  }

  const parseResult = AddAdvanceSchema.safeParse(reqBody);
  if (!parseResult.success) {
    return { status: 400, body: { success: false, error: parseResult.error.errors[0]?.message || 'Validation error' } };
  }

  const { employee_id, amount, reason, date, deducted_in_month, created_by } = parseResult.data;

  // Format deducted_in_month to full date (e.g. 2026-09-01) if month-only format was provided
  const formattedMonthDate = deducted_in_month.length === 7 ? `${deducted_in_month}-01` : deducted_in_month;

  const { data, error } = await supabaseServer
    .from('salary_advances')
    .insert({
      restaurant_id: restaurantId,
      employee_id,
      amount,
      reason: reason || 'Salary advance',
      date,
      deducted_in_month: formattedMonthDate,
      created_by: created_by || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[API add advance error]:', error);
    return { status: 500, body: { success: false, error: error.message } };
  }

  return { status: 200, body: { success: true, data } };
}

// Next.js Pages Router / Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const result = await handleAddAdvance(body, req);
  return res.status(result.status).json(result.body);
}

// Next.js App Router export
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await handleAddAdvance(body, request);
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
