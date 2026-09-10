import { supabaseServer } from '../v2/staff/_db';
import { assertTenant } from '../middleware/requireTenant';

/**
 * /api/restaurant/settings
 * Fetches fresh tenant/restaurant settings strictly isolated by tenant_id.
 * Query MUST include WHERE id = [current_tenant_id].
 */
export async function handleGetSettings(req: any) {
  try {
    const { tenantId } = await assertTenant(req);

    // Strict tenant query: WHERE id = tenantId
    const { data: tenant, error } = await supabaseServer
      .from('tenants')
      .select(`
        id,
        restaurant_name,
        logo_url,
        address,
        city,
        phone,
        tax_rate,
        tax_name,
        receipt_footer,
        bill_footer,
        tax_id,
        website,
        default_cashier_name,
        enabled_payment_methods,
        plan_type,
        billing_status
      `)
      .eq('id', tenantId)
      .single();

    if (error || !tenant) {
      return {
        status: 404,
        body: {
          success: false,
          error: `Tenant settings not found for tenant_id: ${tenantId}`,
        },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        tenant_id: tenant.id,
        settings: {
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
          default_cashier_name: tenant.default_cashier_name || 'Cashier',
          enabled_payment_methods: tenant.enabled_payment_methods || ['cash', 'card', 'wallet'],
          plan_type: tenant.plan_type,
          billing_status: tenant.billing_status,
        },
      },
    };
  } catch (err: any) {
    console.error('[API /api/restaurant/settings Error]:', err.message);
    const statusCode = err.message?.includes('CRITICAL') ? 400 : 500;
    return {
      status: statusCode,
      body: {
        success: false,
        error: err.message || 'Failed to fetch restaurant settings',
      },
    };
  }
}

// Serverless Handler (Vercel / Next Pages router)
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }
  const result = await handleGetSettings(req);
  return res.status(result.status).json(result.body);
}

// Next App Router
export async function GET(request: Request) {
  const result = await handleGetSettings(request);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
