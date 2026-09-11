import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jrzpsrmticjbpobloqej.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_mJIXausOFKI23F2ICqzV5w_HTBC1TBv';

const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

/**
 * POST /api/auth/logout
 * Payload: { session_id }
 * Logout only kills current session_id. Other devices stay logged in.
 */
export async function handleLogout(req: any) {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    } else if (!body && typeof req.text === 'function') {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    }

    const sessionId = body?.session_id || 
      req.headers?.['x-session-id'] || 
      (req.url ? new URL(req.url, 'http://localhost').searchParams.get('session_id') : null);

    if (!sessionId) {
      return {
        status: 400,
        body: { success: false, error: 'session_id is required' }
      };
    }

    const now = new Date().toISOString();

    // Mark ONLY current session_id as logged_out
    const { error } = await supabaseServer
      .from('user_sessions')
      .update({ status: 'logged_out', updated_at: now })
      .eq('session_id', sessionId);

    if (error) {
      console.warn('[Logout API] Supabase update error:', error);
    }

    return {
      status: 200,
      body: {
        success: true,
        message: 'Session terminated. Other devices remain active.',
        session_id: sessionId
      }
    };
  } catch (err: any) {
    console.error('[API /api/auth/logout Error]:', err);
    return {
      status: 500,
      body: { success: false, error: err.message || 'Logout error' }
    };
  }
}

export default async function handler(req: any, res: any) {
  const result = await handleLogout(req);
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result.body));
}
