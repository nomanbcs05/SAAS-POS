-- ==========================================
-- ALTER order_items QUANTITY COLUMN TO NUMERIC
-- ==========================================
-- Run this in the Supabase SQL Editor to allow fractional quantities
-- for items like 0.25, 0.5, 0.75 kg.

DO $$ 
BEGIN 
    -- Alter quantity column from INTEGER to NUMERIC
    ALTER TABLE public.order_items ALTER COLUMN quantity TYPE NUMERIC;
END $$;
