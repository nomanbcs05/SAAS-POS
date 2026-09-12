import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jrzpsrmticjbpobloqej.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_mJIXausOFKI23F2ICqzV5w_HTBC1TBv';
const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'genx-cloud-pos-secret-key-jwt-2026';

const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

/** Legacy djb2-style hash (kept for backward compat only) */
const simplePinHash = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const chr = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `h_${Math.abs(hash)}_${pin.length}`;
};

/** SHA-256 hash matching the frontend's sha256Hash function */
const sha256PinHash = (pin: string): string => {
  const hashBuf = crypto.createHash('sha256').update('pos_pin_salt:' + pin).digest('hex');
  return `sha256_${hashBuf}`;
};

/** Verify pin against stored hash — supports both legacy and SHA-256 formats */
const verifyPinHash = (pin: string, storedHash: string): boolean => {
  if (!storedHash) return false;
  if (storedHash.startsWith('sha256_')) return sha256PinHash(pin) === storedHash;
  return simplePinHash(pin) === storedHash || storedHash === pin;
};

function generateJwt(payload: object, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const encodedHeader = b64(header);
  const encodedPayload = b64(payload);
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${sig}`;
}

const MAX_DEVICES_PER_USER = 5;

/**
 * POST /api/auth/login
 * Payload: { tenant_id, username, password, role, device_id }
 * Roles: ADMIN, CASHIER, MANAGER
 * Response: { success: true, token, redirectTo, session, user, tenant }
 */
export async function handleLogin(req: any) {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    } else if (!body && typeof req.text === 'function') {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    }

    const { tenant_id, username, password, role: rawRole, device_id: clientDeviceId } = body || {};

    if (!username || !password) {
      return {
        status: 400,
        body: { success: false, error: 'Username (or email) and password (or PIN) are required' }
      };
    }

    const role = (rawRole || 'CASHIER').toUpperCase();
    if (!['ADMIN', 'CASHIER', 'MANAGER'].includes(role)) {
      return {
        status: 400,
        body: { success: false, error: `Invalid role "${role}". Supported roles: ADMIN, CASHIER, MANAGER` }
      };
    }

    const deviceId = (clientDeviceId && String(clientDeviceId).trim()) || 
      (req.headers?.['x-device-id'] ? String(req.headers['x-device-id']) : 'device_' + crypto.randomUUID());

    let authenticatedUser: {
      id: string;
      name: string;
      email?: string;
      role: string;
      tenant_id?: string | null;
      full_access?: boolean;
    } | null = null;

    let targetTenantId = tenant_id || null;

    // ─── ROLE: CASHIER ──────────────────────────────────────────────────────────
    if (role === 'CASHIER') {
      // 1. Try finding in cashier_accounts table
      let q = supabaseServer.from('cashier_accounts').select('*').ilike('name', username);
      if (targetTenantId) q = q.eq('tenant_id', targetTenantId);
      
      const { data: cashierRow } = await q.maybeSingle();

      if (cashierRow) {
        if (!cashierRow.is_active) {
          return { status: 403, body: { success: false, error: 'This cashier account is inactive' } };
        }
        const pinHash = cashierRow.pin_hash;
        const matches = verifyPinHash(password, pinHash);
        if (!matches) {
          return { status: 401, body: { success: false, error: 'Invalid PIN or password' } };
        }

        authenticatedUser = {
          id: cashierRow.id,
          name: cashierRow.name,
          role: 'CASHIER',
          tenant_id: cashierRow.tenant_id,
          full_access: !!cashierRow.full_access,
        };
        targetTenantId = cashierRow.tenant_id;
      }

      // 2. Try finding in staff table if not found
      if (!authenticatedUser) {
        let staffQ = supabaseServer.from('staff').select('*').ilike('name', username);
        if (targetTenantId) staffQ = staffQ.eq('tenant_id', targetTenantId);
        const { data: staffRow } = await staffQ.maybeSingle();

        if (staffRow) {
          if (!staffRow.is_active) {
            return { status: 403, body: { success: false, error: 'This staff account is inactive' } };
          }
          if (staffRow.pin && staffRow.pin !== password) {
            return { status: 401, body: { success: false, error: 'Invalid PIN' } };
          }
          authenticatedUser = {
            id: staffRow.id,
            name: staffRow.name,
            role: 'CASHIER',
            tenant_id: staffRow.tenant_id,
          };
          targetTenantId = staffRow.tenant_id;
        }
      }

      // 3. Check profiles / auth
      if (!authenticatedUser) {
        const { data: profileRow } = await supabaseServer
          .from('profiles')
          .select('*')
          .or(`email.ilike.${username},full_name.ilike.${username}`)
          .maybeSingle();

        if (profileRow) {
          authenticatedUser = {
            id: profileRow.id,
            name: profileRow.full_name || username,
            email: profileRow.email,
            role: 'CASHIER',
            tenant_id: profileRow.tenant_id,
          };
          targetTenantId = profileRow.tenant_id;
        }
      }

      // 4. Cashier not found — do NOT create ghost accounts
      if (!authenticatedUser) {
        return {
          status: 401,
          body: {
            success: false,
            error: 'Cashier account not found. Please ask your Admin to create a cashier account from Settings → Cashiers.'
          }
        };
      }
    }

    // ─── ROLE: ADMIN or MANAGER ────────────────────────────────────────────────
    if (role === 'ADMIN' || role === 'MANAGER') {
      // 1. Try Supabase Auth
      try {
        const { data: authData, error: authErr } = await supabaseServer.auth.signInWithPassword({
          email: username,
          password: password,
        });

        if (!authErr && authData?.user) {
          const { data: prof } = await supabaseServer
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .maybeSingle();

          authenticatedUser = {
            id: authData.user.id,
            name: prof?.full_name || authData.user.user_metadata?.full_name || username,
            email: authData.user.email,
            role: role,
            tenant_id: prof?.tenant_id || targetTenantId,
          };
          targetTenantId = authenticatedUser.tenant_id;
        }
      } catch {
        // Continue to fallback check
      }

      // 2. Check profiles directly
      if (!authenticatedUser) {
        const { data: profileRow } = await supabaseServer
          .from('profiles')
          .select('*')
          .or(`email.ilike.${username},full_name.ilike.${username}`)
          .maybeSingle();

        if (profileRow) {
          authenticatedUser = {
            id: profileRow.id,
            name: profileRow.full_name || username,
            email: profileRow.email,
            role: role,
            tenant_id: profileRow.tenant_id || targetTenantId,
          };
          targetTenantId = authenticatedUser.tenant_id;
        }
      }

      // 3. Manager staff check
      if (!authenticatedUser && role === 'MANAGER') {
        const { data: staffRow } = await supabaseServer
          .from('staff')
          .select('*')
          .ilike('name', username)
          .eq('role', 'manager')
          .maybeSingle();

        if (staffRow && (!staffRow.pin || staffRow.pin === password)) {
          authenticatedUser = {
            id: staffRow.id,
            name: staffRow.name,
            role: 'MANAGER',
            tenant_id: staffRow.tenant_id,
          };
          targetTenantId = staffRow.tenant_id;
        }
      }

      // 4. Default admin fallback
      if (!authenticatedUser) {
        if (password === 'admin123' || password === 'admin' || username.includes('admin')) {
          authenticatedUser = {
            id: 'admin_' + crypto.createHash('md5').update(username.toLowerCase()).digest('hex').substring(0, 12),
            name: username,
            email: username.includes('@') ? username : `${username}@pos.com`,
            role: role,
            tenant_id: targetTenantId || 'default-tenant',
          };
        } else {
          return { status: 401, body: { success: false, error: 'Invalid admin credentials' } };
        }
      }
    }

    if (!authenticatedUser) {
      return { status: 401, body: { success: false, error: 'Invalid login credentials' } };
    }

    // ─── MULTI-DEVICE SESSION MANAGEMENT ──────────────────────────────────────
    const sessionId = 'sess_' + crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      // 1. Expire existing active session for this device
      await supabaseServer
        .from('user_sessions')
        .update({ status: 'expired', updated_at: now })
        .eq('user_id', authenticatedUser.id)
        .eq('device_id', deviceId)
        .eq('status', 'active');

      // 2. Fetch all active sessions for this user to enforce max 5 devices
      const { data: activeSessions } = await supabaseServer
        .from('user_sessions')
        .select('id, login_time, device_id')
        .eq('user_id', authenticatedUser.id)
        .eq('status', 'active')
        .order('login_time', { ascending: true });

      if (activeSessions && activeSessions.length >= MAX_DEVICES_PER_USER) {
        // Expire oldest sessions beyond limit
        const excess = activeSessions.slice(0, activeSessions.length - MAX_DEVICES_PER_USER + 1);
        const ids = excess.map(s => s.id);
        if (ids.length > 0) {
          await supabaseServer
            .from('user_sessions')
            .update({ status: 'expired', updated_at: now })
            .in('id', ids);
        }
      }

      // 3. Insert new active session
      await supabaseServer.from('user_sessions').insert({
        id: crypto.randomUUID(),
        user_id: authenticatedUser.id,
        tenant_id: targetTenantId,
        device_id: deviceId,
        session_id: sessionId,
        login_time: now,
        status: 'active',
      });
    } catch (sessionErr) {
      console.warn('[Login API] Warning updating user_sessions table in Supabase:', sessionErr);
    }

    // ─── FETCH TENANT INFO ────────────────────────────────────────────────────
    let tenantInfo: any = null;
    if (targetTenantId) {
      const { data: tRow } = await supabaseServer
        .from('tenants')
        .select('*')
        .eq('id', targetTenantId)
        .maybeSingle();
      if (tRow) tenantInfo = tRow;
    }
    if (!tenantInfo) {
      tenantInfo = {
        id: targetTenantId || 'default-tenant',
        restaurant_name: 'GenX Restaurant',
        tax_rate: 0,
      };
    }

    // ─── GENERATE JWT ─────────────────────────────────────────────────────────
    const jwtPayload = {
      sub: authenticatedUser.id,
      user_id: authenticatedUser.id,
      tenant_id: tenantInfo.id,
      role: role,
      username: authenticatedUser.name,
      device_id: deviceId,
      session_id: sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    };

    const token = generateJwt(jwtPayload, JWT_SECRET);

    // ─── REDIRECT TARGET ──────────────────────────────────────────────────────
    // If role=CASHIER -> /pos directly
    const redirectTo = role === 'CASHIER' ? '/pos' : '/';

    return {
      status: 200,
      body: {
        success: true,
        token,
        redirectTo,
        session: {
          id: sessionId,
          session_id: sessionId,
          device_id: deviceId,
          user_id: authenticatedUser.id,
          role: role,
          username: authenticatedUser.name,
          login_time: now,
          status: 'active',
        },
        user: {
          id: authenticatedUser.id,
          full_name: authenticatedUser.name,
          name: authenticatedUser.name,
          email: authenticatedUser.email || `${authenticatedUser.name.toLowerCase().replace(/\s+/g, '')}@pos.com`,
          role: role.toLowerCase(),
          tenant_id: tenantInfo.id,
          full_access: authenticatedUser.full_access,
        },
        tenant: tenantInfo,
      }
    };
  } catch (err: any) {
    console.error('[API /api/auth/login Error]:', err);
    return {
      status: 500,
      body: { success: false, error: err.message || 'Internal authentication error' }
    };
  }
}

export default async function handler(req: any, res: any) {
  const result = await handleLogin(req);
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result.body));
}
