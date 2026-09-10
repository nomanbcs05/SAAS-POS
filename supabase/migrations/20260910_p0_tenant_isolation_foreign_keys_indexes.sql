-- ==============================================================================
-- P0 FIX: TENANT ISOLATION - DATABASE LAYER
-- Date: 2026-09-10
-- Enforces Foreign Keys, High-Performance Indexes, and RLS across all tables:
--   - tenants
--   - profiles (users)
--   - orders (invoices)
--   - products
--   - order_items
--   - restaurants
-- ==============================================================================

-- 1. Ensure tenant_id exists on core tables
DO $$ 
BEGIN 
    -- profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.profiles ADD COLUMN tenant_id UUID;
        END IF;
    END IF;

    -- orders (invoices)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.orders ADD COLUMN tenant_id UUID;
        END IF;
    END IF;

    -- products
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.products ADD COLUMN tenant_id UUID;
        END IF;
    END IF;

    -- order_items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.order_items ADD COLUMN tenant_id UUID;
        END IF;
    END IF;

    -- restaurants (if exists as legacy table)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurants') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.restaurants ADD COLUMN tenant_id UUID;
        END IF;
    END IF;
END $$;

-- 2. Add Foreign Key constraints linking to public.tenants(id)
DO $$
BEGIN
    -- profiles -> tenants
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' AND constraint_name = 'fk_profiles_tenant'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT fk_profiles_tenant 
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
    END IF;

    -- orders -> tenants
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' AND constraint_name = 'fk_orders_tenant'
    ) THEN
        ALTER TABLE public.orders 
        ADD CONSTRAINT fk_orders_tenant 
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;

    -- products -> tenants
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' AND constraint_name = 'fk_products_tenant'
    ) THEN
        ALTER TABLE public.products 
        ADD CONSTRAINT fk_products_tenant 
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;

    -- order_items -> tenants
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' AND constraint_name = 'fk_order_items_tenant'
    ) THEN
        ALTER TABLE public.order_items 
        ADD CONSTRAINT fk_order_items_tenant 
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;

    -- restaurants -> tenants (optional legacy link)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurants') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_schema = 'public' AND constraint_name = 'fk_restaurants_tenant'
        ) THEN
            ALTER TABLE public.restaurants 
            ADD CONSTRAINT fk_restaurants_tenant 
            FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- 3. Add High-Performance Indexes for strict tenant-filtered lookups
CREATE INDEX IF NOT EXISTS idx_tenants_id ON public.tenants (id);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON public.tenants (owner_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders (tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON public.orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products (tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON public.order_items (tenant_id);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurants') THEN
        CREATE INDEX IF NOT EXISTS idx_restaurants_tenant_id ON public.restaurants (tenant_id);
    END IF;
END $$;

-- 4. Enforce Row Level Security (RLS) ensuring strict tenant isolation
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's tenant_id securely
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Strict Policies for Orders (Invoices)
DROP POLICY IF EXISTS "Tenant isolation for orders select" ON public.orders;
CREATE POLICY "Tenant isolation for orders select"
ON public.orders FOR SELECT
USING (
    tenant_id IS NOT NULL AND (
        tenant_id = public.get_current_tenant_id() OR
        tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Tenant isolation for orders insert" ON public.orders;
CREATE POLICY "Tenant isolation for orders insert"
ON public.orders FOR INSERT
WITH CHECK (
    tenant_id IS NOT NULL AND (
        tenant_id = public.get_current_tenant_id() OR
        tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    )
);

-- Strict Policies for Products
DROP POLICY IF EXISTS "Tenant isolation for products select" ON public.products;
CREATE POLICY "Tenant isolation for products select"
ON public.products FOR SELECT
USING (
    tenant_id IS NOT NULL AND (
        tenant_id = public.get_current_tenant_id() OR
        tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
    )
);

-- Strict Policies for Tenants Table (settings, logo, address)
DROP POLICY IF EXISTS "Tenant isolation for tenants select" ON public.tenants;
CREATE POLICY "Tenant isolation for tenants select"
ON public.tenants FOR SELECT
USING (
    id = public.get_current_tenant_id() OR
    owner_id = auth.uid()
);

DROP POLICY IF EXISTS "Tenant isolation for tenants update" ON public.tenants;
CREATE POLICY "Tenant isolation for tenants update"
ON public.tenants FOR UPDATE
USING (
    id = public.get_current_tenant_id() OR
    owner_id = auth.uid()
);
