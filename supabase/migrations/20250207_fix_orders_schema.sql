-- Ensure all required columns exist in the orders table
DO $$ 
BEGIN 
    -- Add order_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type') THEN
        ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in';
    END IF;

    -- Add subtotal if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'subtotal') THEN
        ALTER TABLE orders ADD COLUMN subtotal NUMERIC DEFAULT 0;
    END IF;

    -- Add tax if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tax') THEN
        ALTER TABLE orders ADD COLUMN tax NUMERIC DEFAULT 0;
    END IF;

    -- Add discount if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'discount') THEN
        ALTER TABLE orders ADD COLUMN discount NUMERIC DEFAULT 0;
    END IF;

    -- Add delivery_fee if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_fee') THEN
        ALTER TABLE orders ADD COLUMN delivery_fee NUMERIC DEFAULT 0;
    END IF;
    
    -- Add total_amount if missing (it should be there, but just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total_amount') THEN
        ALTER TABLE orders ADD COLUMN total_amount NUMERIC DEFAULT 0;
    END IF;
END $$;
