-- ============================================================================
-- GENX CLOUD POS - MULTI-PRINTER KOT ROUTING MIGRATION (SECURITY HARDENED)
-- Database: PostgreSQL / Supabase
-- Version: 2.2.0
-- Safe, Non-Destructive, Additive, Strictly Tenant-Isolated Migration
-- ============================================================================

-- Step 1: Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Add multi_printer_kot_enabled feature flag to 'tenants' table
-- Defaults to FALSE so all 20+ live production tenants remain 100% disabled
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS multi_printer_kot_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 3: Create 'tenant_printers' table
-- Stores physical and virtual printers configured per restaurant tenant
CREATE TABLE IF NOT EXISTS public.tenant_printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    printer_type VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (printer_type IN ('system', 'usb', 'network', 'bluetooth')),
    device_name TEXT,
    ip_address TEXT,
    port INTEGER DEFAULT 9100,
    bluetooth_identifier TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Composite unique constraint required for composite foreign key from routes
    CONSTRAINT uq_tenant_printer_tenant_id_id UNIQUE (tenant_id, id)
);

-- Performance and constraint indexes for tenant_printers
CREATE INDEX IF NOT EXISTS idx_tenant_printers_tenant_id ON public.tenant_printers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_printers_is_active ON public.tenant_printers(tenant_id, is_active);

-- Partial unique index: Guarantees at most ONE printer per tenant has is_default = TRUE at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_printers_one_default 
ON public.tenant_printers (tenant_id) 
WHERE is_default = TRUE;

-- Step 4: Create 'printer_category_routes' table
-- Maps normalized category names to one or more destination printers
-- Supports: ONE CATEGORY -> MULTIPLE PRINTERS & ONE PRINTER -> MULTIPLE CATEGORIES
CREATE TABLE IF NOT EXISTS public.printer_category_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL, -- Canonical normalized category name (e.g. 'karahi', 'beverages')
    printer_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Composite Foreign Key: Guarantees at relational level that printer_id MUST belong to the same tenant_id
    CONSTRAINT fk_printer_routes_tenant_printer FOREIGN KEY (tenant_id, printer_id) 
        REFERENCES public.tenant_printers (tenant_id, id) ON DELETE CASCADE,
    -- Uniqueness constraint: Prevents duplicate mapping of the exact SAME (tenant, category, printer)
    CONSTRAINT uq_tenant_category_printer UNIQUE (tenant_id, category_name, printer_id)
);

-- Performance indexes for printer_category_routes
CREATE INDEX IF NOT EXISTS idx_printer_routes_tenant_id ON public.printer_category_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_printer_routes_printer_id ON public.printer_category_routes(printer_id);
CREATE INDEX IF NOT EXISTS idx_printer_routes_category_name ON public.printer_category_routes(tenant_id, category_name);

-- Step 5: Enable Row Level Security (RLS)
ALTER TABLE public.tenant_printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_category_routes ENABLE ROW LEVEL SECURITY;

-- Step 6: Strict Tenant-Isolated RLS Policies
-- Enforces: User can ONLY read, insert, update, delete rows matching their authenticated tenant_id

-- Helper expression for tenant check:
-- (tenant_id = public.get_auth_tenant_id() OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()) OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin')

-- ─── TENANT PRINTERS POLICIES ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read/write tenant_printers" ON public.tenant_printers;
DROP POLICY IF EXISTS "Tenants can select own printers" ON public.tenant_printers;
DROP POLICY IF EXISTS "Tenants can insert own printers" ON public.tenant_printers;
DROP POLICY IF EXISTS "Tenants can update own printers" ON public.tenant_printers;
DROP POLICY IF EXISTS "Tenants can delete own printers" ON public.tenant_printers;

CREATE POLICY "Tenants can select own printers" ON public.tenant_printers
FOR SELECT USING (
    tenant_id = public.get_auth_tenant_id() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin'
);

CREATE POLICY "Tenants can insert own printers" ON public.tenant_printers
FOR INSERT WITH CHECK (
    tenant_id = public.get_auth_tenant_id() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin'
);

CREATE POLICY "Tenants can update own printers" ON public.tenant_printers
FOR UPDATE USING (
    tenant_id = public.get_auth_tenant_id() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin'
) WITH CHECK (
    tenant_id = public.get_auth_tenant_id() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin'
);

CREATE POLICY "Tenants can delete own printers" ON public.tenant_printers
FOR DELETE USING (
    tenant_id = public.get_auth_tenant_id() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin'
);

-- ─── PRINTER CATEGORY ROUTES POLICIES ───────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read/write printer_category_routes" ON public.printer_category_routes;
DROP POLICY IF EXISTS "Tenants can select own printer routes" ON public.printer_category_routes;
DROP POLICY IF EXISTS "Tenants can insert own printer routes" ON public.printer_category_routes;
DROP POLICY IF EXISTS "Tenants can update own printer routes" ON public.printer_category_routes;
DROP POLICY IF EXISTS "Tenants can delete own printer routes" ON public.printer_category_routes;

CREATE POLICY "Tenants can select own printer routes" ON public.printer_category_routes
FOR SELECT USING (
    tenant_id = public.get_auth_tenant_id() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin'
);

CREATE POLICY "Tenants can insert own printer routes" ON public.printer_category_routes
FOR INSERT WITH CHECK (
    tenant_id = public.get_auth_tenant_id() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin'
);

CREATE POLICY "Tenants can update own printer routes" ON public.printer_category_routes
FOR UPDATE USING (
    tenant_id = public.get_auth_tenant_id() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin'
) WITH CHECK (
    tenant_id = public.get_auth_tenant_id() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin'
);

CREATE POLICY "Tenants can delete own printer routes" ON public.printer_category_routes
FOR DELETE USING (
    tenant_id = public.get_auth_tenant_id() 
    OR tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin'
);

-- Step 7: Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_printer_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_printers_updated_at ON public.tenant_printers;
CREATE TRIGGER trg_tenant_printers_updated_at
    BEFORE UPDATE ON public.tenant_printers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_printer_updated_at_column();

DROP TRIGGER IF EXISTS trg_printer_category_routes_updated_at ON public.printer_category_routes;
CREATE TRIGGER trg_printer_category_routes_updated_at
    BEFORE UPDATE ON public.printer_category_routes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_printer_updated_at_column();
