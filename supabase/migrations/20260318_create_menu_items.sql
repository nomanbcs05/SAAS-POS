-- Migration: Create menu_items table with cascading delete on product removal
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  menu_section TEXT,
  price NUMERIC,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security for menu_items
drop policy if exists "Public access menu_items" on menu_items;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access menu_items" ON menu_items FOR ALL USING (true) WITH CHECK (true);
