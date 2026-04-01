-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  price NUMERIC NOT NULL,
  cost NUMERIC NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  payment_method TEXT NOT NULL,
  order_type TEXT NOT NULL DEFAULT 'dine_in',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  register_id UUID
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (development mode)
-- Products
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
CREATE POLICY "Enable read access for all users" ON products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON products;
CREATE POLICY "Enable insert access for all users" ON products FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for all users" ON products;
CREATE POLICY "Enable update access for all users" ON products FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enable delete access for all users" ON products;
CREATE POLICY "Enable delete access for all users" ON products FOR DELETE USING (true);

-- Customers
DROP POLICY IF EXISTS "Enable read access for all users" ON customers;
CREATE POLICY "Enable read access for all users" ON customers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON customers;
CREATE POLICY "Enable insert access for all users" ON customers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for all users" ON customers;
CREATE POLICY "Enable update access for all users" ON customers FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Enable delete access for all users" ON customers;
CREATE POLICY "Enable delete access for all users" ON customers FOR DELETE USING (true);

-- Orders
DROP POLICY IF EXISTS "Enable read access for all users" ON orders;
CREATE POLICY "Enable read access for all users" ON orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON orders;
CREATE POLICY "Enable insert access for all users" ON orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable update access for all users" ON orders;
CREATE POLICY "Enable update access for all users" ON orders FOR UPDATE USING (true);

-- Order Items
DROP POLICY IF EXISTS "Enable read access for all users" ON order_items;
CREATE POLICY "Enable read access for all users" ON order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON order_items;
CREATE POLICY "Enable insert access for all users" ON order_items FOR INSERT WITH CHECK (true);

-- Insert sample products (using ON CONFLICT to avoid errors on re-run)
INSERT INTO products (name, sku, price, cost, stock, category, image) VALUES
('Espresso', 'BEV001', 350, 100, 100, 'beverages', '☕'),
('Americano', 'BEV002', 400, 120, 100, 'beverages', '☕'),
('Cappuccino', 'BEV003', 550, 180, 85, 'beverages', '☕'),
('Croissant', 'FOOD001', 450, 150, 25, 'food', '🥐'),
('Chocolate Chip Cookie', 'SNK001', 250, 80, 50, 'snacks', '🍪')
ON CONFLICT (sku) DO NOTHING;

-- Insert sample customers
INSERT INTO customers (name, phone, email, loyalty_points, total_spent, visit_count) VALUES
('Ali Khan', '+923001234567', 'ali@example.com', 100, 15000, 10),
('Ayesha Bibi', '+923219876543', 'ayesha@example.com', 50, 7500, 5);
-- Note: Customers table doesn't have unique constraint on email in this schema, so duplicates might be created if run multiple times.
