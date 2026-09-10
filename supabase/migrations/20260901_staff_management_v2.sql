-- ============================================================================
-- GENX CLOUD POS - STAFF MANAGEMENT MODULE V2 (PRO LEVEL) MIGRATION
-- Database: PostgreSQL / Supabase / Neon
-- Version: 2.0.0
-- Safe, Non-Destructive Migration Script
-- ============================================================================

-- Step 1: Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Ensure base 'tenants' / 'restaurants' & 'employees' / 'staff' tables exist
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_name TEXT NOT NULL,
    owner_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure settings and tenants tables have the feature flag column
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS staff_management_v2 BOOLEAN DEFAULT FALSE;

DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
        ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS staff_management_v2 BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Step 3: Ensure employees table exists (or staff table) and add new columns safely
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'waiter',
    phone VARCHAR(50),
    email VARCHAR(100),
    pin VARCHAR(10),
    salary_amount NUMERIC(12, 2) DEFAULT 0,
    joining_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add new columns to 'employees' table if not exist
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS cnic VARCHAR(50);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'monthly';

-- Also add new columns to legacy 'staff' table for backward compatibility
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff') THEN
        ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS cnic VARCHAR(50);
        ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100);
        ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'monthly';
    END IF;
END $$;

-- ============================================================================
-- 4 NEW PRO TABLES
-- ============================================================================

-- TABLE 1: attendance_logs
-- Status ENUM: ('present', 'absent', 'halfday', 'leave')
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'halfday', 'leave')),
    check_in TIME,
    check_out TIME,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_attendance_restaurant_employee_date UNIQUE(restaurant_id, employee_id, date)
);

-- TABLE 2: salary_advances
CREATE TABLE IF NOT EXISTS public.salary_advances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reason TEXT,
    deducted_in_month DATE NOT NULL,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLE 3: payroll_history
CREATE TABLE IF NOT EXISTS public.payroll_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    month DATE NOT NULL,
    base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    present_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
    absent_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
    bonus NUMERIC(12, 2) NOT NULL DEFAULT 0,
    advances NUMERIC(12, 2) NOT NULL DEFAULT 0,
    deductions NUMERIC(12, 2) NOT NULL DEFAULT 0,
    net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_payroll_restaurant_employee_month UNIQUE(restaurant_id, employee_id, month)
);

-- TABLE 4: salary_vouchers
CREATE TABLE IF NOT EXISTS public.salary_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    month DATE NOT NULL,
    net_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
    voucher_no VARCHAR(100) NOT NULL,
    pdf_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'paid')),
    paid_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_voucher_restaurant_voucher_no UNIQUE(restaurant_id, voucher_no)
);

-- ============================================================================
-- PERFORMANCE INDEXES (Ensures ultra-fast queries across 20+ restaurants)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_attendance_logs_rest_date ON public.attendance_logs(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_emp_date ON public.attendance_logs(employee_id, date);

CREATE INDEX IF NOT EXISTS idx_salary_advances_rest_month ON public.salary_advances(restaurant_id, deducted_in_month);
CREATE INDEX IF NOT EXISTS idx_salary_advances_emp ON public.salary_advances(employee_id);

CREATE INDEX IF NOT EXISTS idx_payroll_history_rest_month ON public.payroll_history(restaurant_id, month);
CREATE INDEX IF NOT EXISTS idx_payroll_history_emp ON public.payroll_history(employee_id);

CREATE INDEX IF NOT EXISTS idx_salary_vouchers_rest_month ON public.salary_vouchers(restaurant_id, month);
CREATE INDEX IF NOT EXISTS idx_salary_vouchers_emp ON public.salary_vouchers(employee_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) & TENANT ISOLATION
-- ============================================================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_vouchers ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    -- Employees
    DROP POLICY IF EXISTS "Tenant Isolation Employees" ON public.employees;
    CREATE POLICY "Tenant Isolation Employees" ON public.employees FOR ALL 
    USING (restaurant_id = public.get_auth_tenant_id() OR restaurant_id IS NULL) 
    WITH CHECK (restaurant_id = public.get_auth_tenant_id() OR restaurant_id IS NULL);

    -- Attendance Logs
    DROP POLICY IF EXISTS "Tenant Isolation Attendance Logs" ON public.attendance_logs;
    CREATE POLICY "Tenant Isolation Attendance Logs" ON public.attendance_logs FOR ALL 
    USING (restaurant_id = public.get_auth_tenant_id() OR restaurant_id IS NULL) 
    WITH CHECK (restaurant_id = public.get_auth_tenant_id() OR restaurant_id IS NULL);

    -- Salary Advances
    DROP POLICY IF EXISTS "Tenant Isolation Salary Advances" ON public.salary_advances;
    CREATE POLICY "Tenant Isolation Salary Advances" ON public.salary_advances FOR ALL 
    USING (restaurant_id = public.get_auth_tenant_id() OR restaurant_id IS NULL) 
    WITH CHECK (restaurant_id = public.get_auth_tenant_id() OR restaurant_id IS NULL);

    -- Payroll History
    DROP POLICY IF EXISTS "Tenant Isolation Payroll History" ON public.payroll_history;
    CREATE POLICY "Tenant Isolation Payroll History" ON public.payroll_history FOR ALL 
    USING (restaurant_id = public.get_auth_tenant_id() OR restaurant_id IS NULL) 
    WITH CHECK (restaurant_id = public.get_auth_tenant_id() OR restaurant_id IS NULL);

    -- Salary Vouchers
    DROP POLICY IF EXISTS "Tenant Isolation Salary Vouchers" ON public.salary_vouchers;
    CREATE POLICY "Tenant Isolation Salary Vouchers" ON public.salary_vouchers FOR ALL 
    USING (restaurant_id = public.get_auth_tenant_id() OR restaurant_id IS NULL) 
    WITH CHECK (restaurant_id = public.get_auth_tenant_id() OR restaurant_id IS NULL);
END $$;

-- Permissions grant
GRANT ALL ON public.employees TO anon, authenticated, service_role;
GRANT ALL ON public.attendance_logs TO anon, authenticated, service_role;
GRANT ALL ON public.salary_advances TO anon, authenticated, service_role;
GRANT ALL ON public.payroll_history TO anon, authenticated, service_role;
GRANT ALL ON public.salary_vouchers TO anon, authenticated, service_role;
