-- MIGRATION: Fix RLS policies for reports and summaries
-- This migration ensures order_items and related tables have proper access for dashboard/reports

-- 1. Ensure order_items table has RLS and proper policies
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;

-- Allow reading order_items if user is super-admin
DROP POLICY IF EXISTS "order_items_super_admin_read" ON public.order_items;
CREATE POLICY "order_items_super_admin_read" ON public.order_items FOR SELECT 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin');

-- Allow reading order_items if the order belongs to user's restaurant
DROP POLICY IF EXISTS "order_items_tenant_read" ON public.order_items;
CREATE POLICY "order_items_tenant_read" ON public.order_items FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.restaurant_id = public.get_auth_restaurant_id()
  )
);

-- Allow inserting order_items 
DROP POLICY IF EXISTS "order_items_tenant_insert" ON public.order_items;
CREATE POLICY "order_items_tenant_insert" ON public.order_items FOR INSERT 
WITH CHECK (TRUE);

-- Allow updating order_items
DROP POLICY IF EXISTS "order_items_tenant_update" ON public.order_items;
CREATE POLICY "order_items_tenant_update" ON public.order_items FOR UPDATE 
USING (TRUE);

-- 2. Ensure products table allows public read access (data shared across restaurants)
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "products_public_insert" ON public.products;
CREATE POLICY "products_public_insert" ON public.products FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "products_public_update" ON public.products;
CREATE POLICY "products_public_update" ON public.products FOR UPDATE USING (true);

DROP POLICY IF EXISTS "products_public_delete" ON public.products;
CREATE POLICY "products_public_delete" ON public.products FOR DELETE USING (true);

-- 3. Ensure categories table allows public read access
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories_public_insert" ON public.categories;
CREATE POLICY "categories_public_insert" ON public.categories FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "categories_public_update" ON public.categories;
CREATE POLICY "categories_public_update" ON public.categories FOR UPDATE USING (true);

DROP POLICY IF EXISTS "categories_public_delete" ON public.categories;
CREATE POLICY "categories_public_delete" ON public.categories FOR DELETE USING (true);

-- 4. Ensure customers table allows access for reports
DROP POLICY IF EXISTS "customers_super_admin_read" ON public.customers;
CREATE POLICY "customers_super_admin_read" ON public.customers FOR SELECT 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin');

DROP POLICY IF EXISTS "customers_tenant_read" ON public.customers;
CREATE POLICY "customers_tenant_read" ON public.customers FOR SELECT 
USING (restaurant_id = public.get_auth_restaurant_id());

-- 5. Ensure orders table allows access for reports
DROP POLICY IF EXISTS "orders_super_admin_read" ON public.orders;
CREATE POLICY "orders_super_admin_read" ON public.orders FOR SELECT 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super-admin');

DROP POLICY IF EXISTS "orders_tenant_read" ON public.orders;
CREATE POLICY "orders_tenant_read" ON public.orders FOR SELECT 
USING (restaurant_id = public.get_auth_restaurant_id());
