import { createClient } from '@supabase/supabase-js';

// Environment variables for Supabase connection
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jrzpsrmticjbpobloqej.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_mJIXausOFKI23F2ICqzV5w_HTBC1TBv';

export const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

/**
 * Extracts and verifies restaurant_id (tenant_id) from the incoming request.
 * Checks authorization token, x-restaurant-id header, query parameter, or payload body.
 */
export async function getRestaurantIdFromRequest(req: any): Promise<string | null> {
  try {
    // 1. Check custom headers
    const headerRestId = req.headers?.['x-restaurant-id'] || req.headers?.['x-tenant-id'] || 
      (typeof req.headers?.get === 'function' ? (req.headers.get('x-restaurant-id') || req.headers.get('x-tenant-id')) : null);
    if (headerRestId) {
      return String(headerRestId).trim();
    }

    // 2. Check Authorization Bearer Token
    const authHeader = req.headers?.['authorization'] || 
      (typeof req.headers?.get === 'function' ? req.headers.get('authorization') : null);
      
    if (authHeader && String(authHeader).startsWith('Bearer ')) {
      const token = String(authHeader).split(' ')[1];
      const { data: { user }, error } = await supabaseServer.auth.getUser(token);
      if (!error && user) {
        // Query user's profile to get associated tenant_id
        const { data: profile } = await supabaseServer
          .from('profiles')
          .select('tenant_id, restaurant_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.tenant_id || profile?.restaurant_id) {
          return profile.tenant_id || profile.restaurant_id;
        }

        // Query owned tenant if owner
        const { data: tenant } = await supabaseServer
          .from('tenants')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (tenant?.id) {
          return tenant.id;
        }
      }
    }

    // 3. Check query param if GET
    const url = req.url ? new URL(req.url, 'http://localhost') : null;
    const queryRestId = url?.searchParams.get('restaurant_id') || req.query?.restaurant_id;
    if (queryRestId) {
      return String(queryRestId).trim();
    }

    // 4. Check JSON body if parsed
    if (req.body && typeof req.body === 'object' && req.body.restaurant_id) {
      return String(req.body.restaurant_id).trim();
    }

    return null;
  } catch (err) {
    console.error('[Auth Helper] Error extracting restaurant_id:', err);
    return null;
  }
}
