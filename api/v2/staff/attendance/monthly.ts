import { z } from 'zod';
import { supabaseServer, getRestaurantIdFromRequest } from '../_db';

const MonthlyQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
  employee_id: z.string().optional().nullable(),
});

export async function handleGetMonthlyAttendance(queryParams: any, req: any) {
  const restaurantId = await getRestaurantIdFromRequest(req);
  if (!restaurantId) {
    return { status: 401, body: { success: false, error: 'Unauthorized: Restaurant session missing or invalid' } };
  }

  const parseResult = MonthlyQuerySchema.safeParse(queryParams);
  if (!parseResult.success) {
    return { status: 400, body: { success: false, error: parseResult.error.errors[0]?.message || 'Invalid month parameter' } };
  }

  const { month, employee_id } = parseResult.data;
  const startDate = `${month}-01`;
  const endDate = `${month}-31`;

  let query = supabaseServer
    .from('attendance_logs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (employee_id) {
    query = query.eq('employee_id', employee_id);
  }

  const { data: logs, error } = await query;

  if (error) {
    console.error('[API monthly attendance error]:', error);
    return { status: 500, body: { success: false, error: error.message } };
  }

  // Calculate summary counts
  const summary: Record<string, { present: number; absent: number; halfday: number; leave: number; total: number }> = {};

  (logs || []).forEach((log: any) => {
    const empId = log.employee_id;
    if (!summary[empId]) {
      summary[empId] = { present: 0, absent: 0, halfday: 0, leave: 0, total: 0 };
    }
    summary[empId].total += 1;
    if (log.status === 'present') summary[empId].present += 1;
    else if (log.status === 'absent') summary[empId].absent += 1;
    else if (log.status === 'halfday') summary[empId].halfday += 1;
    else if (log.status === 'leave') summary[empId].leave += 1;
  });

  return {
    status: 200,
    body: {
      success: true,
      month,
      employee_id: employee_id || null,
      summary: employee_id ? (summary[employee_id] || { present: 0, absent: 0, halfday: 0, leave: 0, total: 0 }) : summary,
      logs: logs || []
    }
  };
}

// Next.js Pages Router / Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }

  const result = await handleGetMonthlyAttendance(req.query, req);
  return res.status(result.status).json(result.body);
}

// Next.js App Router export
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const queryParams = {
      month: url.searchParams.get('month') || new Date().toISOString().slice(0, 7),
      employee_id: url.searchParams.get('employee_id'),
    };
    const result = await handleGetMonthlyAttendance(queryParams, request);
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
