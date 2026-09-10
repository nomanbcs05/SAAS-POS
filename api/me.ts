import { supabaseServer } from './v2/staff/_db';

/**
 * /api/me
 * Returns authenticated user profile and isolated tenant details.
 * Every single query MUST include WHERE tenant_id = [current_logged_in_tenant_id] / id = profile.tenant_id
 */
export async function handleMe(req: any) {
  try {
    const authHeader = req.headers?.['authorization'] || 
                       (typeof req.headers?.get === 'function' ? req.headers.get('authorization') : null);

    if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
      return { status: 401, body: { success: false, error: 'Unauthorized: Missing or invalid Authorization Bearer token' } };
    }

    const token = String(authHeader).split(' ')[1];
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

    if (authError || !user) {
      return { status: 401, body: { success: false, error: 'Unauthorized: Invalid session' } };
    }

    // 1. Fetch user profile
    const { data: profile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { status: 404, body: { success: false, error: 'User profile not found' } };
    }

    let tenantId = profile.tenant_id || profile.restaurant_id;

    // If profile doesn't have tenant_id directly, check if user is tenant owner
    if (!tenantId) {
      const { data: ownedTenant } = await supabaseServer
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (ownedTenant?.id) {
        tenantId = ownedTenant.id;
      }
    }

    if (!tenantId) {
      return { status: 403, body: { success: false, error: 'No associated tenant found for user' } };
    }

    // 2. Fetch tenant strictly WHERE id = tenantId
    const { data: tenant, error: tenantError } = await supabaseServer
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return { status: 404, body: { success: false, error: 'Tenant record not found' } };
    }

    return {
      status: 200,
      body: {
        success: true,
        user: {
          id: profile.id,
          email: profile.email || user.email,
          full_name: profile.full_name,
          role: profile.role,
          tenant_id: tenantId,
        },
        tenant: {
          id: tenant.id,
          restaurant_name: tenant.restaurant_name,
          logo_url: tenant.logo_url || null,
          address: tenant.address || null,
          city: tenant.city || null,
          phone: tenant.phone || null,
          tax_rate: tenant.tax_rate ?? 0,
          tax_name: tenant.tax_name || 'GST',
          receipt_footer: tenant.receipt_footer || null,
          bill_footer: tenant.bill_footer || null,
          tax_id: tenant.tax_id || null,
          website: tenant.website || null,
          plan_type: tenant.plan_type,
          billing_status: tenant.billing_status,
        }
      }
    };
  } catch (err: any) {
    console.error('[API /api/me Error]:', err);
    return { status: 500, body: { success: false, error: err.message || 'Internal server error' } };
  }
}

// Serverless Handler (Vercel / Next Pages router)
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }
  const result = await handleMe(req);
  return res.status(result.status).json(result.body);
}

// Next App Router
export async function GET(request: Request) {
  const result = await handleMe(request);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
