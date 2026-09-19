-- ============================================================================
-- GENX CLOUD POS — STAFF MANAGEMENT V2 FIX SCRIPT (PRO LEVEL)
-- Run ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe & Idempotent — will NOT delete any existing data
-- ============================================================================

-- STEP 1: Add missing columns to 'staff' table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS cnic VARCHAR(50);
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS bank_account VARCHAR(100);
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'monthly';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS salary_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS joining_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pin VARCHAR(10);

-- STEP 2: Drop all bad FK constraints that point to 'employees' (since staff live in 'staff' table)
ALTER TABLE public.salary_advances DROP CONSTRAINT IF EXISTS salary_advances_employee_id_fkey;
ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS attendance_logs_employee_id_fkey;
ALTER TABLE public.payroll_history DROP CONSTRAINT IF EXISTS payroll_history_employee_id_fkey;
ALTER TABLE public.salary_vouchers DROP CONSTRAINT IF EXISTS salary_vouchers_employee_id_fkey;

-- STEP 3: Change column types to TEXT for UUID/string flexibility
ALTER TABLE public.salary_advances ALTER COLUMN employee_id TYPE TEXT USING employee_id::TEXT;
ALTER TABLE public.salary_advances ALTER COLUMN restaurant_id TYPE TEXT USING restaurant_id::TEXT;

ALTER TABLE public.attendance_logs ALTER COLUMN employee_id TYPE TEXT USING employee_id::TEXT;
ALTER TABLE public.attendance_logs ALTER COLUMN restaurant_id TYPE TEXT USING restaurant_id::TEXT;

ALTER TABLE public.payroll_history ALTER COLUMN employee_id TYPE TEXT USING employee_id::TEXT;
ALTER TABLE public.payroll_history ALTER COLUMN restaurant_id TYPE TEXT USING restaurant_id::TEXT;

ALTER TABLE public.salary_vouchers ALTER COLUMN employee_id TYPE TEXT USING employee_id::TEXT;
ALTER TABLE public.salary_vouchers ALTER COLUMN restaurant_id TYPE TEXT USING restaurant_id::TEXT;

-- STEP 4: Ensure proper UNIQUE constraints on attendance_logs and salary_vouchers
ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS uq_attendance_restaurant_employee_date;
ALTER TABLE public.attendance_logs ADD CONSTRAINT uq_attendance_restaurant_employee_date UNIQUE(restaurant_id, employee_id, date);

ALTER TABLE public.salary_vouchers DROP CONSTRAINT IF EXISTS uq_voucher_restaurant_voucher_no;
ALTER TABLE public.salary_vouchers DROP CONSTRAINT IF EXISTS salary_vouchers_voucher_no_key;
ALTER TABLE public.salary_vouchers ADD CONSTRAINT uq_voucher_voucher_no UNIQUE(voucher_no);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_rest_date ON public.attendance_logs(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_emp_date ON public.attendance_logs(employee_id, date);

-- STEP 5: Permissive RLS (cashier sessions run as anon, no auth.uid())
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow staff all" ON public.staff;
CREATE POLICY "Allow staff all" ON public.staff FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant Isolation Employees" ON public.employees;
DROP POLICY IF EXISTS "Allow employees all" ON public.employees;
CREATE POLICY "Allow employees all" ON public.employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant Isolation Attendance Logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow attendance_logs all" ON public.attendance_logs;
CREATE POLICY "Allow attendance_logs all" ON public.attendance_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant Isolation Salary Advances" ON public.salary_advances;
DROP POLICY IF EXISTS "Allow salary_advances all" ON public.salary_advances;
CREATE POLICY "Allow salary_advances all" ON public.salary_advances FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant Isolation Payroll History" ON public.payroll_history;
DROP POLICY IF EXISTS "Allow payroll_history all" ON public.payroll_history;
CREATE POLICY "Allow payroll_history all" ON public.payroll_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant Isolation Salary Vouchers" ON public.salary_vouchers;
DROP POLICY IF EXISTS "Allow salary_vouchers all" ON public.salary_vouchers;
CREATE POLICY "Allow salary_vouchers all" ON public.salary_vouchers FOR ALL USING (true) WITH CHECK (true);

-- STEP 6: Grants
GRANT ALL ON public.staff TO anon, authenticated, service_role;
GRANT ALL ON public.employees TO anon, authenticated, service_role;
GRANT ALL ON public.attendance_logs TO anon, authenticated, service_role;
GRANT ALL ON public.salary_advances TO anon, authenticated, service_role;
GRANT ALL ON public.payroll_history TO anon, authenticated, service_role;
GRANT ALL ON public.salary_vouchers TO anon, authenticated, service_role;

-- STEP 7: CNIC unique index on staff table
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_cnic_unique
  ON public.staff(cnic)
  WHERE cnic IS NOT NULL AND cnic != '';

-- STEP 8: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- DONE ✓
