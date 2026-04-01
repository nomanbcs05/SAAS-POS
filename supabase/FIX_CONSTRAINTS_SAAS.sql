-- ==========================================
-- FIX: TENANT-AWARE UNIQUE CONSTRAINTS
-- ==========================================
-- This script fixes the 409 Conflict errors during seeding 
-- by making product SKUs and category names unique PER TENANT.

-- 1. Fix Products Table Constraints
-- First, drop the global unique constraint on sku
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_sku_key;

-- Create a composite unique constraint (tenant_id, sku)
-- This allows different tenants to have the same SKU.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_tenant_sku_key') THEN
        ALTER TABLE public.products ADD CONSTRAINT products_tenant_sku_key UNIQUE (tenant_id, sku);
    END IF;
END $$;

-- 2. Fix Categories Table Constraints
-- Drop any global unique constraint on category name
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- Create a composite unique constraint (tenant_id, name)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_tenant_name_key') THEN
        ALTER TABLE public.categories ADD CONSTRAINT categories_tenant_name_key UNIQUE (tenant_id, name);
    END IF;
END $$;

-- 3. Ensure RLS allows the check
-- (This was handled in previous scripts, but ensuring permissions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
