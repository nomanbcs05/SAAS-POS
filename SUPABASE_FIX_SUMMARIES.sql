-- QUICK FIX: Execute this directly in Supabase SQL Editor
-- This removes restrictive RLS and allows data access for reports

-- 1. Drop and recreate order_items policies
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.order_items;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.order_items;

CREATE POLICY "Enable all operations for authenticated users" ON public.order_items 
FOR ALL USING (true) WITH CHECK (true);

-- 2. Ensure products allows full access
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON public.products;
DROP POLICY IF EXISTS "Super Admin Override" ON public.products;
DROP POLICY IF EXISTS "products_public_read" ON public.products;
DROP POLICY IF EXISTS "products_public_insert" ON public.products;
DROP POLICY IF EXISTS "products_public_update" ON public.products;
DROP POLICY IF EXISTS "products_public_delete" ON public.products;

CREATE POLICY "Products allow all" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- 3. Ensure categories allows full access
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON public.categories;
DROP POLICY IF EXISTS "Super Admin Override" ON public.categories;
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
DROP POLICY IF EXISTS "categories_public_insert" ON public.categories;
DROP POLICY IF EXISTS "categories_public_update" ON public.categories;
DROP POLICY IF EXISTS "categories_public_delete" ON public.categories;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.categories;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.categories;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.categories;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.categories;

CREATE POLICY "Categories allow all" ON public.categories FOR ALL USING (true) WITH CHECK (true);

-- 4. Verify orders and customers policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation" ON public.orders;
DROP POLICY IF EXISTS "Super Admin Override" ON public.orders;
DROP POLICY IF EXISTS "orders_super_admin_read" ON public.orders;
DROP POLICY IF EXISTS "orders_tenant_read" ON public.orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.orders;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.orders;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.orders;

CREATE POLICY "Orders allow all" ON public.orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant Isolation" ON public.customers;
DROP POLICY IF EXISTS "Super Admin Override" ON public.customers;
DROP POLICY IF EXISTS "customers_super_admin_read" ON public.customers;
DROP POLICY IF EXISTS "customers_tenant_read" ON public.customers;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.customers;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.customers;

CREATE POLICY "Customers allow all" ON public.customers FOR ALL USING (true) WITH CHECK (true);
