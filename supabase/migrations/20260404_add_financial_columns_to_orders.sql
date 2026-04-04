-- Migration to add missing columns to orders table for financials
-- Date: 2026-04-04

DO $$ 
BEGIN 
    -- Add discount_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'discount_amount') THEN
        ALTER TABLE public.orders ADD COLUMN discount_amount DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- Add service_charges_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'service_charges_amount') THEN
        ALTER TABLE public.orders ADD COLUMN service_charges_amount DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- Add delivery_fee
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_fee') THEN
        ALTER TABLE public.orders ADD COLUMN delivery_fee DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;
