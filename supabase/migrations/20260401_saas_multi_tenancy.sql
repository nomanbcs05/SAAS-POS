-- Multi-Tenancy SaaS Migration for Gen XCloud POS
-- Date: 2026-04-01

-- 1. Create the 'tenants' table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'premium', 'enterprise')),
    billing_status TEXT DEFAULT 'active' CHECK (billing_status IN ('active', 'past_due', 'canceled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1b. Ensure 'profiles' table exists (if not already created by previous migrations)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id UUID, -- Legacy reference
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier', 'super-admin')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add 'tenant_id' column to core tables
DO $$ 
BEGIN 
    -- Profiles
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.profiles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        END IF;
    END IF;

    -- Products
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.products ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        END IF;
    END IF;

    -- Categories
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.categories ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        END IF;
    END IF;

    -- Customers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.customers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        END IF;
    END IF;

    -- Orders
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.orders ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        END IF;
    END IF;

    -- Order Items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.order_items ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        END IF;
    END IF;

    -- Restaurant Tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_tables') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurant_tables' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.restaurant_tables ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        END IF;
    END IF;

    -- Daily Registers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_registers') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_registers' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.daily_registers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        END IF;
    END IF;
END $$;

-- 3. Data Migration (Copy from existing restaurants if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurants') THEN
        INSERT INTO public.tenants (id, restaurant_name, owner_id, created_at)
        SELECT id, name, owner_id, created_at FROM public.restaurants
        ON CONFLICT (id) DO NOTHING;
        
        -- Copy tenant_id from restaurant_id where available (using safe updates)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'restaurant_id') THEN
            UPDATE public.profiles SET tenant_id = restaurant_id WHERE tenant_id IS NULL AND restaurant_id IS NOT NULL;
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'restaurant_id') THEN
            UPDATE public.products SET tenant_id = restaurant_id WHERE tenant_id IS NULL AND restaurant_id IS NOT NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'restaurant_id') THEN
            UPDATE public.categories SET tenant_id = restaurant_id WHERE tenant_id IS NULL AND restaurant_id IS NOT NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'restaurant_id') THEN
            UPDATE public.customers SET tenant_id = restaurant_id WHERE tenant_id IS NULL AND restaurant_id IS NOT NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'restaurant_id') THEN
            UPDATE public.orders SET tenant_id = restaurant_id WHERE tenant_id IS NULL AND restaurant_id IS NOT NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'restaurant_id') THEN
            UPDATE public.order_items SET tenant_id = restaurant_id WHERE tenant_id IS NULL AND restaurant_id IS NOT NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'restaurant_tables' AND column_name = 'restaurant_id') THEN
            UPDATE public.restaurant_tables SET tenant_id = restaurant_id WHERE tenant_id IS NULL AND restaurant_id IS NOT NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'daily_registers' AND column_name = 'restaurant_id') THEN
            UPDATE public.daily_registers SET tenant_id = restaurant_id WHERE tenant_id IS NULL AND restaurant_id IS NOT NULL;
        END IF;
    END IF;
END $$;

-- 4. Create Indexes for performance
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
        CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON public.categories(tenant_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers(tenant_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders(tenant_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON public.order_items(tenant_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_tables') THEN
        CREATE INDEX IF NOT EXISTS idx_tables_tenant_id ON public.restaurant_tables(tenant_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_registers') THEN
        CREATE INDEX IF NOT EXISTS idx_registers_tenant_id ON public.daily_registers(tenant_id);
    END IF;
END $$;

-- 5. Create Helper function to get the current tenant_id
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable Row Level Security
DO $$
BEGIN
    ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
        ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'restaurant_tables') THEN
        ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_registers') THEN
        ALTER TABLE public.daily_registers ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 7. Implement RLS Policies (Tenant Isolation)

-- Tenants Policy: Users can see their own tenant or if they are the owner
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" ON public.tenants
FOR SELECT USING (id = public.get_auth_tenant_id() OR owner_id = auth.uid());

-- Safe Policy Application Function
CREATE OR REPLACE FUNCTION public.apply_tenant_policy(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = p_table_name) THEN
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', p_table_name);
        EXECUTE format('CREATE POLICY "Tenant Isolation" ON public.%I FOR ALL USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id())', p_table_name);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policy (Special Case)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
        CREATE POLICY "Profiles isolation" ON public.profiles
        FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR id = auth.uid())
        WITH CHECK (tenant_id = public.get_auth_tenant_id() OR id = auth.uid());
    END IF;
END $$;

-- Apply Standard Isolation Policies
SELECT public.apply_tenant_policy('products');
SELECT public.apply_tenant_policy('categories');
SELECT public.apply_tenant_policy('customers');
SELECT public.apply_tenant_policy('orders');
SELECT public.apply_tenant_policy('order_items');
SELECT public.apply_tenant_policy('restaurant_tables');
SELECT public.apply_tenant_policy('daily_registers');

-- 8. Create Triggers to automate tenant_id assignment
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_auth_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT table_name 
             FROM information_schema.tables 
             WHERE table_schema = 'public' 
             AND table_name IN ('products', 'categories', 'customers', 'orders', 'order_items', 'restaurant_tables', 'daily_registers')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.%I', t);
        EXECUTE format('CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert()', t);
    END LOOP;
END $$;
