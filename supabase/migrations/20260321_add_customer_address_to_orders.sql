-- Migration: Add customer_address column to orders table
-- This migration ensures customer's complete address is captured and displayed on bills

DO $$ 
BEGIN 
    -- Add customer_address if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_address') THEN
        ALTER TABLE orders ADD COLUMN customer_address TEXT;
    END IF;
END $$;
