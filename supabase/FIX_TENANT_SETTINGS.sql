-- ==========================================
-- FIX: TENANTS TABLE SETTINGS COLUMNS
-- ==========================================
-- This script ensures all required columns for restaurant settings 
-- exist in the tenants table to avoid 400 Bad Request errors.

DO $$ 
BEGIN 
    -- 1. Ensure logo_url exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'logo_url') THEN
        ALTER TABLE public.tenants ADD COLUMN logo_url TEXT;
    END IF;

    -- 2. Ensure address exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'address') THEN
        ALTER TABLE public.tenants ADD COLUMN address TEXT;
    END IF;

    -- 3. Ensure city exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'city') THEN
        ALTER TABLE public.tenants ADD COLUMN city TEXT;
    END IF;

    -- 4. Ensure phone exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'phone') THEN
        ALTER TABLE public.tenants ADD COLUMN phone TEXT;
    END IF;

    -- 5. Ensure receipt_footer exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'receipt_footer') THEN
        ALTER TABLE public.tenants ADD COLUMN receipt_footer TEXT;
    END IF;

    -- 6. Ensure bill_footer exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'bill_footer') THEN
        ALTER TABLE public.tenants ADD COLUMN bill_footer TEXT;
    END IF;

    -- 7. Ensure tax_id exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'tax_id') THEN
        ALTER TABLE public.tenants ADD COLUMN tax_id TEXT;
    END IF;

    -- 8. Ensure website exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'website') THEN
        ALTER TABLE public.tenants ADD COLUMN website TEXT;
    END IF;

    -- 9. Ensure tax settings exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'tax_rate') THEN
        ALTER TABLE public.tenants ADD COLUMN tax_rate NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'tax_name') THEN
        ALTER TABLE public.tenants ADD COLUMN tax_name TEXT DEFAULT 'Tax';
    END IF;

    -- 10. Ensure notification settings exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'low_stock_threshold') THEN
        ALTER TABLE public.tenants ADD COLUMN low_stock_threshold INTEGER DEFAULT 10;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'enable_sounds') THEN
        ALTER TABLE public.tenants ADD COLUMN enable_sounds BOOLEAN DEFAULT true;
    END IF;

    -- 11. Ensure payment methods settings exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'enabled_payment_methods') THEN
        ALTER TABLE public.tenants ADD COLUMN enabled_payment_methods JSONB DEFAULT '["cash", "card", "wallet"]'::jsonb;
    END IF;

    -- 12. Ensure default cashier name exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'default_cashier_name') THEN
        ALTER TABLE public.tenants ADD COLUMN default_cashier_name TEXT DEFAULT 'Ali Hyder';
    END IF;
END $$;

-- 13. Re-grant permissions just in case
GRANT ALL ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO anon;
GRANT ALL ON public.tenants TO service_role;
