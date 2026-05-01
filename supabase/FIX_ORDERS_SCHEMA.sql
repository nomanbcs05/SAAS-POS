-- ==========================================
-- FIX ORDERS SCHEMA - ADD MISSING COLUMNS
-- ==========================================
-- Run this in the Supabase SQL Editor to ensure
-- the database matches the application code.

DO $$ 
BEGIN 
    -- 1. Add missing columns to 'orders' table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'daily_id') THEN
        ALTER TABLE public.orders ADD COLUMN daily_id INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.orders ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_address') THEN
        ALTER TABLE public.orders ADD COLUMN customer_address TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'server_name') THEN
        ALTER TABLE public.orders ADD COLUMN server_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'table_id') THEN
        ALTER TABLE public.orders ADD COLUMN table_id UUID REFERENCES public.restaurant_tables(id);
    END IF;

    -- 2. Add missing columns to 'order_items' table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_name') THEN
        ALTER TABLE public.order_items ADD COLUMN product_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_category') THEN
        ALTER TABLE public.order_items ADD COLUMN product_category TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.order_items ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    END IF;

END $$;

-- 3. Refresh permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
