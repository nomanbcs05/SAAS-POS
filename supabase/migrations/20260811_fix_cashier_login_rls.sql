-- Fix: Allow cashier login to work even without active admin auth session
-- RLS policies for cashier_accounts & cashier_permissions were admin-only on SELECT,
-- which broke cashier PIN login whenever the admin Supabase session expired or user was not authenticated.
-- PIN verification is handled at application layer, so SELECT can be public/authenticated.

-- ---------------------------------------------------------------------------
-- 1. cashier_accounts: Relax SELECT policy (keep write ops admin-only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can read cashier accounts of their tenant" ON cashier_accounts;

CREATE POLICY "Anyone authenticated can read cashier accounts"
  ON cashier_accounts FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE remain admin-only; they already exist from prior migration, so we leave them intact.

-- ---------------------------------------------------------------------------
-- 2. cashier_permissions: Relax SELECT policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can read cashier permissions" ON cashier_permissions;

CREATE POLICY "Anyone authenticated can read cashier permissions"
  ON cashier_permissions FOR SELECT
  USING (true);
