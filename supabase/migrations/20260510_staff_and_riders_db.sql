
-- Migration to support staff and riders in the database for multi-tenancy
-- Date: 2026-05-10

-- 1. Create 'staff' table for Waiters/Servers
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'waiter',
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ensure 'delivery_drivers' has tenant_id and SaaS support
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delivery_drivers' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.delivery_drivers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Enable RLS and Policies
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

-- Standard tenant isolation policies
DO $$ 
BEGIN 
    -- Staff
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.staff;
    CREATE POLICY "Tenant Isolation" ON public.staff FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);
    
    -- Delivery Drivers
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.delivery_drivers;
    CREATE POLICY "Tenant Isolation" ON public.delivery_drivers FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);
END $$;

-- 4. Triggers for tenant_id
DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.staff;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.staff FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.delivery_drivers;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.delivery_drivers FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- 5. Seed Khanshinwari Menu into Products (Optional but good for "saved on database" request)
-- We'll insert categories first if they don't exist
INSERT INTO public.categories (name, icon) VALUES 
('CHICKEN KARHAI', 'UtensilsCrossed'),
('BBQ PLATTERS', 'Flame'),
('EID ITEM', 'Star'),
('MUTTON ROSH', 'Beef'),
('MUTTON KARHAI', 'UtensilsCrossed'),
('NAMKEEN BOTI', 'Flame'),
('DRINKS', 'CupSoda'),
('TANDOOR', 'Wheat'),
('SALAD & RAITA', 'Leaf'),
('BBQ ITEMS', 'Flame'),
('KEBABS', 'Flame'),
('CHICKEN HANDI', 'Soup'),
('MUTTON HANDI', 'Soup'),
('KHEER', 'Cake')
ON CONFLICT (name) DO NOTHING;

-- Note: We don't insert products here because tenant_id is needed and it's hard to target "Khanshinwari" tenant in a generic migration.
-- Instead, the application will handle "Saving to Database" if we update the Modal to sync with the DB.
