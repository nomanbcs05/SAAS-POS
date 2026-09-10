import { z } from 'zod';
import { supabaseServer, getRestaurantIdFromRequest } from '../_db';

const MarkAttendanceSchema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  status: z.enum(['present', 'absent', 'halfday', 'leave']),
  check_in: z.string().optional().nullable(),
  check_out: z.string().optional().nullable(),
  created_by: z.string().optional().nullable(),
});

export async function handleMarkAttendance(reqBody: any, req: any) {
  const restaurantId = await getRestaurantIdFromRequest(req);
  if (!restaurantId) {
    return { status: 401, body: { success: false, error: 'Unauthorized: Restaurant session missing or invalid' } };
  }

  const parseResult = MarkAttendanceSchema.safeParse(reqBody);
  if (!parseResult.success) {
    return { status: 400, body: { success: false, error: parseResult.error.errors[0]?.message || 'Validation error' } };
  }

  const { employee_id, date, status, check_in, check_out, created_by } = parseResult.data;

  // Upsert into attendance_logs using conflict key (restaurant_id, employee_id, date)
  const { data, error } = await supabaseServer
    .from('attendance_logs')
    .upsert({
      restaurant_id: restaurantId,
      employee_id,
      date,
      status,
      check_in: check_in || null,
      check_out: check_out || null,
      created_by: created_by || null,
    }, {
      onConflict: 'restaurant_id,employee_id,date'
    })
    .select()
    .single();

  if (error) {
    console.error('[API mark attendance error]:', error);
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
  const result = await handleMarkAttendance(body, req);
  return res.status(result.status).json(result.body);
}

// Next.js App Router export
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await handleMarkAttendance(body, request);
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
