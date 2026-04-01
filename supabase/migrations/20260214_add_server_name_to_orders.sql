-- Add server_name column to orders table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'server_name') THEN
        ALTER TABLE orders ADD COLUMN server_name VARCHAR(100);
    END IF;
END $$;
