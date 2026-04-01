
-- FINAL MULTI-TENANT LAUNCH SCRIPT
-- RUN ALL OF THIS IN SUPABASE SQL EDITOR

-- 1. Foundation
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled')),
    license_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'cashier', 'super-admin')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Data Attribution
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.daily_registers ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id);

-- 3. Isolation & Security
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_auth_restaurant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT restaurant_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply isolation policies to all tables
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['products', 'categories', 'orders', 'customers', 'daily_registers', 'restaurant_tables'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Tenant Isolation" ON public.%I FOR ALL USING (restaurant_id = public.get_auth_restaurant_id()) WITH CHECK (restaurant_id = public.get_auth_restaurant_id())', t);
        
        EXECUTE format('DROP POLICY IF EXISTS "Super Admin Override" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Super Admin Override" ON public.%I FOR ALL USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = ''super-admin'')', t);
    END LOOP;
END $$;

-- 4. Auto-Attribution Trigger
CREATE OR REPLACE FUNCTION public.set_restaurant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.restaurant_id IS NULL THEN
    NEW.restaurant_id := public.get_auth_restaurant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY['products', 'categories', 'orders', 'customers', 'daily_registers', 'restaurant_tables'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_set_restaurant_id ON public.%I', t);
        EXECUTE format('CREATE TRIGGER trigger_set_restaurant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_restaurant_id()', t);
    END LOOP;
END $$;

-- 5. Setup Default Data & Super Admin
INSERT INTO public.restaurants (name, slug, subscription_status)
VALUES ('Gen XCloud POS Default', 'default-restaurant', 'active')
ON CONFLICT (slug) DO NOTHING;

UPDATE public.profiles 
SET role = 'super-admin' 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'noman53000@gmail.com');

UPDATE public.profiles
SET restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'default-restaurant')
WHERE restaurant_id IS NULL AND role != 'super-admin';

UPDATE public.products SET restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'default-restaurant') WHERE restaurant_id IS NULL;
UPDATE public.categories SET restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'default-restaurant') WHERE restaurant_id IS NULL;
UPDATE public.orders SET restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'default-restaurant') WHERE restaurant_id IS NULL;
UPDATE public.customers SET restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'default-restaurant') WHERE restaurant_id IS NULL;
UPDATE public.daily_registers SET restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'default-restaurant') WHERE restaurant_id IS NULL;
UPDATE public.restaurant_tables SET restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'default-restaurant') WHERE restaurant_id IS NULL;
