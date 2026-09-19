-- ============================================================================
-- GENX CLOUD POS: MULTI-PRINTER KOT ROUTING QUICK FIX SCRIPT
-- Execute this directly in Supabase Dashboard -> SQL Editor -> Run
-- This resolves: "Could not find the table 'public.tenant_printers' in the schema cache"
-- and "column tenants.multi_printer_kot_enabled does not exist"
-- ============================================================================

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Add multi_printer_kot_enabled column to tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS multi_printer_kot_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Create tenant_printers table
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
    CONSTRAINT uq_tenant_printer_tenant_id_id UNIQUE (tenant_id, id)
);

-- Indexes for tenant_printers
CREATE INDEX IF NOT EXISTS idx_tenant_printers_tenant_id ON public.tenant_printers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_printers_is_active ON public.tenant_printers(tenant_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_printers_one_default 
ON public.tenant_printers (tenant_id) 
WHERE is_default = TRUE;

-- 4. Create printer_category_routes table
CREATE TABLE IF NOT EXISTS public.printer_category_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL,
    printer_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Direct Foreign Key for PostgREST resource embedding
    CONSTRAINT fk_printer_routes_printer_id FOREIGN KEY (printer_id) 
        REFERENCES public.tenant_printers (id) ON DELETE CASCADE,
    -- Unique category-printer mapping per tenant
    CONSTRAINT uq_tenant_category_printer UNIQUE (tenant_id, category_name, printer_id)
);

-- Drop duplicate composite foreign key if it already exists from prior migration
ALTER TABLE IF EXISTS public.printer_category_routes 
DROP CONSTRAINT IF EXISTS fk_printer_routes_tenant_printer;

-- Ensure single-column foreign key exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_printer_routes_printer_id' 
        AND table_name = 'printer_category_routes'
    ) THEN
        ALTER TABLE public.printer_category_routes
        ADD CONSTRAINT fk_printer_routes_printer_id
        FOREIGN KEY (printer_id) REFERENCES public.tenant_printers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Indexes for printer_category_routes
CREATE INDEX IF NOT EXISTS idx_printer_routes_tenant_id ON public.printer_category_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_printer_routes_printer_id ON public.printer_category_routes(printer_id);
CREATE INDEX IF NOT EXISTS idx_printer_routes_category_name ON public.printer_category_routes(tenant_id, category_name);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.tenant_printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_category_routes ENABLE ROW LEVEL SECURITY;

-- 6. Row Level Security Policies (Supports both Owner Supabase Auth & Cashier PIN sessions)
DROP POLICY IF EXISTS "Allow tenant_printers all" ON public.tenant_printers;
DROP POLICY IF EXISTS "Authenticated users can read/write tenant_printers" ON public.tenant_printers;
DROP POLICY IF EXISTS "Tenants can select own printers" ON public.tenant_printers;
DROP POLICY IF EXISTS "Tenants can insert own printers" ON public.tenant_printers;
DROP POLICY IF EXISTS "Tenants can update own printers" ON public.tenant_printers;
DROP POLICY IF EXISTS "Tenants can delete own printers" ON public.tenant_printers;

CREATE POLICY "Allow tenant_printers all" ON public.tenant_printers 
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow printer_category_routes all" ON public.printer_category_routes;
DROP POLICY IF EXISTS "Authenticated users can read/write printer_category_routes" ON public.printer_category_routes;
DROP POLICY IF EXISTS "Tenants can select own printer routes" ON public.printer_category_routes;
DROP POLICY IF EXISTS "Tenants can insert own printer routes" ON public.printer_category_routes;
DROP POLICY IF EXISTS "Tenants can update own printer routes" ON public.printer_category_routes;
DROP POLICY IF EXISTS "Tenants can delete own printer routes" ON public.printer_category_routes;

CREATE POLICY "Allow printer_category_routes all" ON public.printer_category_routes 
FOR ALL USING (true) WITH CHECK (true);

-- 7. Grant Permissions to anon, authenticated, service_role
GRANT ALL ON TABLE public.tenant_printers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.printer_category_routes TO anon, authenticated, service_role;

-- 8. Updated_at Triggers
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

-- 9. Force PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
