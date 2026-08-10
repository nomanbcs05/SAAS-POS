-- Cashier Accounts & Permissions System Migration
-- Creates tables for cashier login (name + 4-digit PIN) and granular module permissions

-- ---------------------------------------------------------------------------
-- 1. Cashier Accounts Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cashier_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  full_access BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- ---------------------------------------------------------------------------
-- 2. Cashier Permissions Table
-- Each row = one module permission for one cashier
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cashier_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES cashier_accounts(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cashier_id, module_key)
);

-- ---------------------------------------------------------------------------
-- 3. Indices for performance
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_cashier_accounts_tenant ON cashier_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cashier_accounts_active ON cashier_accounts(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cashier_permissions_cashier ON cashier_permissions(cashier_id);

-- ---------------------------------------------------------------------------
-- 4. RLS Policies
-- ---------------------------------------------------------------------------
ALTER TABLE cashier_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_permissions ENABLE ROW LEVEL SECURITY;

-- Admin (profile role admin/super-admin) linked to tenant can read/write cashiers
CREATE POLICY "Admin can read cashier accounts of their tenant"
  ON cashier_accounts FOR SELECT
  USING (
    tenant_id IN (
      SELECT COALESCE(
        (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
        (SELECT id FROM tenants WHERE owner_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
    )
  );

CREATE POLICY "Admin can insert cashier accounts in their tenant"
  ON cashier_accounts FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT COALESCE(
        (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
        (SELECT id FROM tenants WHERE owner_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
    )
  );

CREATE POLICY "Admin can update cashier accounts of their tenant"
  ON cashier_accounts FOR UPDATE
  USING (
    tenant_id IN (
      SELECT COALESCE(
        (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
        (SELECT id FROM tenants WHERE owner_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
    )
  );

CREATE POLICY "Admin can delete cashier accounts of their tenant"
  ON cashier_accounts FOR DELETE
  USING (
    tenant_id IN (
      SELECT COALESCE(
        (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
        (SELECT id FROM tenants WHERE owner_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
    )
  );

-- Permissions policies (same admin access pattern)
CREATE POLICY "Admin can read cashier permissions"
  ON cashier_permissions FOR SELECT
  USING (
    cashier_id IN (
      SELECT id FROM cashier_accounts WHERE tenant_id IN (
        SELECT COALESCE(
          (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
          (SELECT id FROM tenants WHERE owner_id = auth.uid())
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
    )
  );

CREATE POLICY "Admin can insert cashier permissions"
  ON cashier_permissions FOR INSERT
  WITH CHECK (
    cashier_id IN (
      SELECT id FROM cashier_accounts WHERE tenant_id IN (
        SELECT COALESCE(
          (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
          (SELECT id FROM tenants WHERE owner_id = auth.uid())
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
    )
  );

CREATE POLICY "Admin can update cashier permissions"
  ON cashier_permissions FOR UPDATE
  USING (
    cashier_id IN (
      SELECT id FROM cashier_accounts WHERE tenant_id IN (
        SELECT COALESCE(
          (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
          (SELECT id FROM tenants WHERE owner_id = auth.uid())
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
    )
  );

CREATE POLICY "Admin can delete cashier permissions"
  ON cashier_permissions FOR DELETE
  USING (
    cashier_id IN (
      SELECT id FROM cashier_accounts WHERE tenant_id IN (
        SELECT COALESCE(
          (SELECT tenant_id FROM profiles WHERE id = auth.uid()),
          (SELECT id FROM tenants WHERE owner_id = auth.uid())
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'super-admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Trigger to maintain updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cashier_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cashier_accounts_updated_at ON cashier_accounts;
CREATE TRIGGER trg_cashier_accounts_updated_at
BEFORE UPDATE ON cashier_accounts
FOR EACH ROW EXECUTE FUNCTION cashier_set_updated_at();

DROP TRIGGER IF EXISTS trg_cashier_permissions_updated_at ON cashier_permissions;
CREATE TRIGGER trg_cashier_permissions_updated_at
BEFORE UPDATE ON cashier_permissions
FOR EACH ROW EXECUTE FUNCTION cashier_set_updated_at();
