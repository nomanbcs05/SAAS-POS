-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create 'inventory_items' table
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT NOT NULL CHECK (category IN ('raw_material', 'consumable', 'packaging')),
    unit TEXT NOT NULL,
    current_stock NUMERIC NOT NULL DEFAULT 0,
    min_stock NUMERIC NOT NULL DEFAULT 0,
    cost_price NUMERIC NOT NULL DEFAULT 0,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create 'inventory_vendors' table
CREATE TABLE IF NOT EXISTS public.inventory_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create 'inventory_purchases' table
CREATE TABLE IF NOT EXISTS public.inventory_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,
    vendor_id UUID REFERENCES public.inventory_vendors(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved')),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create 'inventory_purchase_items' table
CREATE TABLE IF NOT EXISTS public.inventory_purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID REFERENCES public.inventory_purchases(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- 5. Create 'inventory_recipes' table
CREATE TABLE IF NOT EXISTS public.inventory_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL, -- Ingredient portion size per product sold
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_id, item_id)
);

-- 6. Create 'inventory_adjustments' table
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('manual_adjustment', 'waste', 'expired', 'transfer', 'sale_deduction', 'purchase_addition')),
    quantity NUMERIC NOT NULL,
    reason TEXT,
    created_by TEXT,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.inventory_items;
    CREATE POLICY "Tenant Isolation" ON public.inventory_items FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);

    DROP POLICY IF EXISTS "Tenant Isolation" ON public.inventory_vendors;
    CREATE POLICY "Tenant Isolation" ON public.inventory_vendors FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);

    DROP POLICY IF EXISTS "Tenant Isolation" ON public.inventory_purchases;
    CREATE POLICY "Tenant Isolation" ON public.inventory_purchases FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);

    DROP POLICY IF EXISTS "Tenant Isolation" ON public.inventory_purchase_items;
    CREATE POLICY "Tenant Isolation" ON public.inventory_purchase_items FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);

    DROP POLICY IF EXISTS "Tenant Isolation" ON public.inventory_recipes;
    CREATE POLICY "Tenant Isolation" ON public.inventory_recipes FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);

    DROP POLICY IF EXISTS "Tenant Isolation" ON public.inventory_adjustments;
    CREATE POLICY "Tenant Isolation" ON public.inventory_adjustments FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);
END $$;

-- Triggers for automatic tenant_id injection
DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.inventory_items;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.inventory_vendors;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.inventory_vendors FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.inventory_purchases;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.inventory_purchases FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.inventory_purchase_items;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.inventory_purchase_items FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.inventory_recipes;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.inventory_recipes FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.inventory_adjustments;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.inventory_adjustments FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- Grant permissions to standard roles
GRANT ALL ON public.inventory_items TO anon, authenticated, service_role;
GRANT ALL ON public.inventory_vendors TO anon, authenticated, service_role;
GRANT ALL ON public.inventory_purchases TO anon, authenticated, service_role;
GRANT ALL ON public.inventory_purchase_items TO anon, authenticated, service_role;
GRANT ALL ON public.inventory_recipes TO anon, authenticated, service_role;
GRANT ALL ON public.inventory_adjustments TO anon, authenticated, service_role;
