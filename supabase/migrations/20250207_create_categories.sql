
-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'Package',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable read access for all users" ON categories;
CREATE POLICY "Enable read access for all users" ON categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert access for all users" ON categories;
CREATE POLICY "Enable insert access for all users" ON categories FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update access for all users" ON categories;
CREATE POLICY "Enable update access for all users" ON categories FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete access for all users" ON categories;
CREATE POLICY "Enable delete access for all users" ON categories FOR DELETE USING (true);

-- Insert default categories
INSERT INTO categories (name, icon) VALUES
('Beverages', 'Coffee'),
('Food', 'UtensilsCrossed'),
('Snacks', 'Cookie'),
('Desserts', 'Cake'),
('Merchandise', 'ShoppingBag')
ON CONFLICT (name) DO NOTHING;
