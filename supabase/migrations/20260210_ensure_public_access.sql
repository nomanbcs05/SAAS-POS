-- Enable public access for all core tables to ensure data persistence 
-- even if auth is flaky or user is in "Local Dev Mode" (anon role)

-- Daily Registers
ALTER TABLE daily_registers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access daily_registers" ON daily_registers;
CREATE POLICY "Public access daily_registers" ON daily_registers FOR ALL USING (true) WITH CHECK (true);

-- Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access orders" ON orders;
CREATE POLICY "Public access orders" ON orders FOR ALL USING (true) WITH CHECK (true);

-- Order Items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access order_items" ON order_items;
CREATE POLICY "Public access order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- Profiles (if used)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access profiles" ON profiles;
CREATE POLICY "Public access profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- Tables (Physical tables)
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access tables" ON tables;
CREATE POLICY "Public access tables" ON tables FOR ALL USING (true) WITH CHECK (true);

-- Categories & Menu Items
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access categories" ON categories;
CREATE POLICY "Public access categories" ON categories FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access menu_items" ON menu_items;
CREATE POLICY "Public access menu_items" ON menu_items FOR ALL USING (true) WITH CHECK (true);
