-- =========================================================================
-- GENX CLOUD POS: Inventory Auto-Deduction by Conversion Rate & Breakdown
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Ensure inventory_items exists
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT DEFAULT 'raw_material',
    unit TEXT NOT NULL DEFAULT 'kg',
    current_stock NUMERIC NOT NULL DEFAULT 0,
    min_stock NUMERIC NOT NULL DEFAULT 0,
    cost_price NUMERIC NOT NULL DEFAULT 0,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add conversion rate fields to products table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'linked_ingredient_id') THEN
        ALTER TABLE public.products ADD COLUMN linked_ingredient_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'deduction_qty') THEN
        ALTER TABLE public.products ADD COLUMN deduction_qty NUMERIC(10, 4) DEFAULT 0;
    END IF;
END $$;

-- 3. Create sale_ingredient_breakdown table
CREATE TABLE IF NOT EXISTS public.sale_ingredient_breakdown (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    ingredient_name TEXT NOT NULL,
    qty_deducted NUMERIC(10, 4) NOT NULL,
    unit TEXT DEFAULT 'kg',
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sale_ingredient_breakdown_sale_id ON public.sale_ingredient_breakdown(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_ingredient_breakdown_order_id ON public.sale_ingredient_breakdown(order_id);
CREATE INDEX IF NOT EXISTS idx_sale_ingredient_breakdown_ingredient ON public.sale_ingredient_breakdown(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_products_linked_ingredient ON public.products(linked_ingredient_id);

-- Enable RLS
ALTER TABLE public.sale_ingredient_breakdown ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow sale_ingredient_breakdown all" ON public.sale_ingredient_breakdown;
CREATE POLICY "Allow sale_ingredient_breakdown all" ON public.sale_ingredient_breakdown FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.sale_ingredient_breakdown TO anon, authenticated, service_role;

-- 4. Create or replace ingredients view for compatibility
CREATE OR REPLACE VIEW public.ingredients AS
SELECT 
    id, 
    name, 
    sku,
    category,
    unit, 
    current_stock, 
    min_stock, 
    cost_price, 
    tenant_id, 
    created_at 
FROM public.inventory_items;

GRANT ALL ON public.ingredients TO anon, authenticated, service_role;
