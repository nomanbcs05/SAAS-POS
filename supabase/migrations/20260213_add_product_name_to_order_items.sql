-- Migration to add product_name to order_items and handle non-UUID product_ids
-- This allows "virtual" products (like those from modals) to be saved correctly.

DO $$ 
BEGIN 
    -- Add product_name if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_name') THEN
        ALTER TABLE order_items ADD COLUMN product_name TEXT;
    END IF;

    -- Add product_category if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_category') THEN
        ALTER TABLE order_items ADD COLUMN product_category TEXT;
    END IF;

    -- Update existing order_items with product names and categories from products table (if possible)
    UPDATE order_items oi
    SET 
        product_name = p.name,
        product_category = p.category
    FROM products p
    WHERE oi.product_id = p.id
    AND (oi.product_name IS NULL OR oi.product_category IS NULL);

    -- Make product_id optional if it wasn't already (it should be)
    ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;

END $$;
