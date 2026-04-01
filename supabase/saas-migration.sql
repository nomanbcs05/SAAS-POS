-- SaaS Migration Script for Gen XCloud POS

-- Step 1: Add `restaurant_id` column to all tenant-specific tables if they don't exist
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
-- order_items might implicitly inherit tenant from orders, but explicit is better for massive data
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.daily_registers ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);

-- Step 2: Create indexes to guarantee "No Lags" for queries filtered by restaurant
CREATE INDEX IF NOT EXISTS idx_products_restaurant_id ON public.products(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON public.categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_id ON public.customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id ON public.order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id ON public.restaurant_tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_registers_restaurant_id ON public.daily_registers(restaurant_id);


-- Step 3: Enable RLS on all tenant specific tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_registers ENABLE ROW LEVEL SECURITY;


-- Step 4: Create a helper function to get the current user's restaurant_id
CREATE OR REPLACE FUNCTION public.get_current_restaurant_id()
RETURNS UUID AS $$
DECLARE
  v_restaurant_id UUID;
BEGIN
  SELECT restaurant_id INTO v_restaurant_id 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  RETURN v_restaurant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Step 5: Implement RLS Policies for true Tenant Isolation
-- (These ensure Cashiers in Restaurant A can only select/insert/update/delete Restaurant A's rows)

-- Products
CREATE POLICY "Tenant Isolation - Products" ON public.products
FOR ALL TO authenticated
USING (restaurant_id = public.get_current_restaurant_id())
WITH CHECK (restaurant_id = public.get_current_restaurant_id());

-- Categories
CREATE POLICY "Tenant Isolation - Categories" ON public.categories
FOR ALL TO authenticated
USING (restaurant_id = public.get_current_restaurant_id())
WITH CHECK (restaurant_id = public.get_current_restaurant_id());

-- Customers
CREATE POLICY "Tenant Isolation - Customers" ON public.customers
FOR ALL TO authenticated
USING (restaurant_id = public.get_current_restaurant_id())
WITH CHECK (restaurant_id = public.get_current_restaurant_id());

-- Orders
CREATE POLICY "Tenant Isolation - Orders" ON public.orders
FOR ALL TO authenticated
USING (restaurant_id = public.get_current_restaurant_id())
WITH CHECK (restaurant_id = public.get_current_restaurant_id());

-- Order Items
CREATE POLICY "Tenant Isolation - Order Items" ON public.order_items
FOR ALL TO authenticated
USING (restaurant_id = public.get_current_restaurant_id())
WITH CHECK (restaurant_id = public.get_current_restaurant_id());

-- Tables
CREATE POLICY "Tenant Isolation - Tables" ON public.restaurant_tables
FOR ALL TO authenticated
USING (restaurant_id = public.get_current_restaurant_id())
WITH CHECK (restaurant_id = public.get_current_restaurant_id());

-- Registers
CREATE POLICY "Tenant Isolation - Registers" ON public.daily_registers
FOR ALL TO authenticated
USING (restaurant_id = public.get_current_restaurant_id())
WITH CHECK (restaurant_id = public.get_current_restaurant_id());


-- Step 6: Database Triggers to Automate `restaurant_id` insertion
-- This stops the frontend from needing massive changes to append `restaurant_id` to every insert payload.

CREATE OR REPLACE FUNCTION public.set_restaurant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    NEW.restaurant_id := public.get_current_restaurant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Map trigger to all tables
DROP TRIGGER IF EXISTS trigger_set_restaurant_id ON public.products;
CREATE TRIGGER trigger_set_restaurant_id
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_id();

DROP TRIGGER IF EXISTS trigger_set_restaurant_id ON public.categories;
CREATE TRIGGER trigger_set_restaurant_id
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_id();

DROP TRIGGER IF EXISTS trigger_set_restaurant_id ON public.customers;
CREATE TRIGGER trigger_set_restaurant_id
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_id();

DROP TRIGGER IF EXISTS trigger_set_restaurant_id ON public.orders;
CREATE TRIGGER trigger_set_restaurant_id
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_id();

DROP TRIGGER IF EXISTS trigger_set_restaurant_id ON public.order_items;
CREATE TRIGGER trigger_set_restaurant_id
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_id();

DROP TRIGGER IF EXISTS trigger_set_restaurant_id ON public.restaurant_tables;
CREATE TRIGGER trigger_set_restaurant_id
  BEFORE INSERT ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_id();

DROP TRIGGER IF EXISTS trigger_set_restaurant_id ON public.daily_registers;
CREATE TRIGGER trigger_set_restaurant_id
  BEFORE INSERT ON public.daily_registers
  FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_id();
