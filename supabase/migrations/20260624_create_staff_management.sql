-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create 'tenants' table if it does not exist (defensive fallback)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_name TEXT NOT NULL,
    owner_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create defensive stub for get_auth_tenant_id function if it does not exist
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Try to get tenant_id from user's profile if auth is set up
    IF auth.uid() IS NOT NULL THEN
        -- We use a dynamic check in case profiles table doesn't exist yet
        BEGIN
            EXECUTE 'SELECT tenant_id FROM public.profiles WHERE id = $1'
            INTO v_tenant_id
            USING auth.uid();
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
        RETURN v_tenant_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create defensive stub for set_tenant_id_on_insert function if it does not exist
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := public.get_auth_tenant_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create 'staff' table if it does not exist
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'waiter',
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alter existing 'staff' table to add payroll and basic details columns safely
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary_type TEXT DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'daily'));
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary_amount NUMERIC DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS joining_date DATE DEFAULT CURRENT_DATE;

-- Create 'staff_attendance' table
CREATE TABLE IF NOT EXISTS public.staff_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'half_day', 'leave')),
    check_in TIME,
    check_out TIME,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(staff_id, date)
);

-- Create 'staff_payroll' table
CREATE TABLE IF NOT EXISTS public.staff_payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    base_salary NUMERIC NOT NULL DEFAULT 0,
    present_days INTEGER NOT NULL DEFAULT 0,
    absent_days INTEGER NOT NULL DEFAULT 0,
    bonus NUMERIC DEFAULT 0,
    advances NUMERIC DEFAULT 0,
    deductions NUMERIC DEFAULT 0,
    net_salary NUMERIC NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(staff_id, month)
);

-- Create 'payroll_vouchers' table
CREATE TABLE IF NOT EXISTS public.payroll_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id TEXT UNIQUE NOT NULL, -- e.g. PV-YYYYMM-XXXX
    staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
    payroll_id UUID REFERENCES public.staff_payroll(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    net_salary NUMERIC NOT NULL,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('Paid', 'Pending')),
    payment_date TIMESTAMP WITH TIME ZONE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for all tables (including staff, just in case)
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_vouchers ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation policies
DO $$ 
BEGIN 
    -- Staff Policies
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.staff;
    CREATE POLICY "Tenant Isolation" ON public.staff FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);

    -- Staff Attendance Policies
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.staff_attendance;
    CREATE POLICY "Tenant Isolation" ON public.staff_attendance FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);
    
    -- Staff Payroll Policies
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.staff_payroll;
    CREATE POLICY "Tenant Isolation" ON public.staff_payroll FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);
    
    -- Payroll Vouchers Policies
    DROP POLICY IF EXISTS "Tenant Isolation" ON public.payroll_vouchers;
    CREATE POLICY "Tenant Isolation" ON public.payroll_vouchers FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL) WITH CHECK (tenant_id = public.get_auth_tenant_id() OR tenant_id IS NULL);
END $$;

-- Register tenant_id triggers to automatically assign tenant_id on insert
DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.staff;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.staff FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.staff_attendance;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.staff_attendance FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.staff_payroll;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.staff_payroll FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

DROP TRIGGER IF EXISTS tr_set_tenant_id ON public.payroll_vouchers;
CREATE TRIGGER tr_set_tenant_id BEFORE INSERT ON public.payroll_vouchers FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();
