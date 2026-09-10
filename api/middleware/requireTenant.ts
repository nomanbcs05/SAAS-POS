import { supabaseServer } from '../v2/staff/_db';

export interface TenantContextRequest {
  tenantId: string;
  user?: any;
  profile?: any;
}

/**
 * Extracts and strictly validates tenant_id from incoming request.
 * Throws an error if tenant_id is missing or if authenticated user doesn't belong to the tenant.
 */
export async function assertTenant(req: any): Promise<{ tenantId: string; user?: any; profile?: any }> {
  // 1. Check custom headers
  let tenantId = req.headers?.['x-tenant-id'] || 
                 req.headers?.['x-restaurant-id'] || 
                 (typeof req.headers?.get === 'function' ? (req.headers.get('x-tenant-id') || req.headers.get('x-restaurant-id')) : null);

  // 2. Check query params
  if (!tenantId) {
    if (req.query?.tenant_id) {
      tenantId = req.query.tenant_id;
    } else if (req.query?.restaurant_id) {
      tenantId = req.query.restaurant_id;
    } else if (req.url) {
      try {
        const url = new URL(req.url, 'http://localhost');
        tenantId = url.searchParams.get('tenant_id') || url.searchParams.get('restaurant_id');
      } catch {
        // ignore parse error
      }
    }
  }

  // 3. Check body if present
  if (!tenantId && req.body) {
    const body = typeof req.body === 'string' ? (()=>{ try { return JSON.parse(req.body); } catch { return {}; } })() : req.body;
    tenantId = body?.tenant_id || body?.restaurant_id;
  }

  // 4. Check Authorization Bearer Token
  let authUser: any = null;
  let authProfile: any = null;
  const authHeader = req.headers?.['authorization'] || 
                     (typeof req.headers?.get === 'function' ? req.headers.get('authorization') : null);

  if (authHeader && String(authHeader).startsWith('Bearer ')) {
    const token = String(authHeader).split(' ')[1];
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    if (!error && user) {
      authUser = user;
      const { data: profile } = await supabaseServer
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        authProfile = profile;
        // If tenantId was not in headers/query/body, use authenticated user's profile tenant
        if (!tenantId) {
          tenantId = profile.tenant_id || profile.restaurant_id;
        } else if (profile.tenant_id && profile.tenant_id !== tenantId && profile.role !== 'super-admin') {
          // Cross-tenant verification: User cannot query a tenant they do not belong to
          throw new Error(`CRITICAL: Cross-Tenant Access Denied. User tenant (${profile.tenant_id}) does not match requested tenant (${tenantId}).`);
        }
      }
    }
  }

  if (!tenantId || String(tenantId).trim() === '') {
    throw new Error('CRITICAL: Missing tenant_id from request. Access denied.');
  }

  return {
    tenantId: String(tenantId).trim(),
    user: authUser,
    profile: authProfile,
  };
}

/**
 * Middleware: requireTenant()
 * Throws error or sends 400/401 HTTP response if tenant_id is missing from request.
 */
export async function requireTenant(req: any, res?: any, next?: () => void) {
  try {
    const { tenantId, user, profile } = await assertTenant(req);
    req.tenantId = tenantId;
    req.user = user;
    req.profile = profile;
    if (typeof next === 'function') {
      return next();
    }
    return { success: true, tenantId, user, profile };
  } catch (err: any) {
    console.error('[requireTenant Middleware Blocked Request]:', err.message);
    if (res && typeof res.status === 'function') {
      return res.status(400).json({
        success: false,
        error: err.message || 'CRITICAL: tenant_id is required',
      });
    }
    throw err;
  }
}
