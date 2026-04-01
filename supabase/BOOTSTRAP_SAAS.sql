-- ==========================================
-- GENX CLOUD POS - FULL SAAS BOOTSTRAP SCRIPT
-- ==========================================
-- This script will set up ALL tables, columns, and RLS policies 
-- required for the Multi-Tenant SaaS version of the POS.
-- Run this in the Supabase SQL Editor.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TENANTS TABLE
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    logo_url TEXT,
    address TEXT,
    city TEXT,
    phone TEXT,
    receipt_footer TEXT,
    bill_footer TEXT,
    tax_id TEXT,
    website TEXT,
    tax_rate NUMERIC DEFAULT 0,
    tax_name TEXT DEFAULT 'Tax',
    low_stock_threshold INTEGER DEFAULT 10,
    enable_sounds BOOLEAN DEFAULT true,
    enabled_payment_methods JSONB DEFAULT '["cash", "card", "wallet"]'::jsonb,
    default_cashier_name TEXT DEFAULT 'Ali Hyder',
    plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'premium', 'enterprise')),
    billing_status TEXT DEFAULT 'active' CHECK (billing_status IN ('active', 'past_due', 'canceled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    restaurant_id UUID, -- Legacy reference
    full_name TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier', 'super-admin')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure email column exists if table was created without it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
        ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
END $$;

-- 4. CORE TABLES
-- Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    price NUMERIC NOT NULL,
    cost NUMERIC NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'Package',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID DEFAULT gen_random_uuid(), -- Legacy compat
    tenant_id UUID REFERENCES public.tenants(id),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    loyalty_points INTEGER DEFAULT 0,
    total_spent NUMERIC DEFAULT 0,
    visit_count INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0, -- Legacy compat
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure legacy columns exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'customer_id') THEN
        ALTER TABLE public.customers ADD COLUMN customer_id UUID DEFAULT gen_random_uuid();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'total_orders') THEN
        ALTER TABLE public.customers ADD COLUMN total_orders INTEGER DEFAULT 0;
    END IF;
END $$;

-- Daily Registers (The missing table)
CREATE TABLE IF NOT EXISTS public.daily_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    closed_at TIMESTAMP WITH TIME ZONE,
    starting_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    ending_amount NUMERIC(10, 2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    notes TEXT
);

-- Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    customer_id UUID REFERENCES public.customers(id),
    table_id UUID REFERENCES public.restaurant_tables(id), -- Add table_id reference
    register_id UUID REFERENCES public.daily_registers(id),
    total_amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    payment_method TEXT NOT NULL,
    order_type TEXT NOT NULL DEFAULT 'dine_in',
    server_name TEXT,
    customer_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id),
    product_name TEXT,
    product_category TEXT,
    quantity INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Restaurant Tables
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID DEFAULT gen_random_uuid(), -- Legacy compat
    tenant_id UUID REFERENCES public.tenants(id),
    table_number TEXT NOT NULL,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure legacy columns exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_tables' AND column_name = 'table_id') THEN
        ALTER TABLE public.restaurant_tables ADD COLUMN table_id UUID DEFAULT gen_random_uuid();
    END IF;
END $$;

-- 5. HELPERS
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS & POLICIES
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_registers ENABLE ROW LEVEL SECURITY;

-- Policy helper
CREATE OR REPLACE FUNCTION public.apply_tenant_policy(p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', p_table_name);
    EXECUTE format('CREATE POLICY "Tenant Isolation" ON public.%I FOR ALL USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id())', p_table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all
SELECT public.apply_tenant_policy('products');
SELECT public.apply_tenant_policy('categories');
SELECT public.apply_tenant_policy('customers');
SELECT public.apply_tenant_policy('orders');
SELECT public.apply_tenant_policy('order_items');
SELECT public.apply_tenant_policy('restaurant_tables');
SELECT public.apply_tenant_policy('daily_registers');

-- Tenants Policy
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" ON public.tenants FOR SELECT USING (id = public.get_auth_tenant_id());

-- Profiles Policy
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
CREATE POLICY "Profiles isolation" ON public.profiles FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR id = auth.uid()) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR id = auth.uid());

-- 7. REPAIR PERMISSIONS (Fixes 403/406 errors)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Allow users to create their own restaurant
DROP POLICY IF EXISTS "Users can create their own tenant" ON public.tenants;
CREATE POLICY "Users can create their own tenant" ON public.tenants FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- 8. TRIGGERS
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_auth_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
