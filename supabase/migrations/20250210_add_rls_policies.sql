-- Enable RLS on all tables
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeaway_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create policies for restaurant_tables
-- Allow read access to everyone
CREATE POLICY "Allow public read access on restaurant_tables"
ON restaurant_tables FOR SELECT
USING (true);

-- Allow update access to everyone (for now, or authenticated users)
CREATE POLICY "Allow public update access on restaurant_tables"
ON restaurant_tables FOR UPDATE
USING (true);

-- Create policies for customers
CREATE POLICY "Allow public read access on customers"
ON customers FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access on customers"
ON customers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access on customers"
ON customers FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete access on customers"
ON customers FOR DELETE
USING (true);

-- Create policies for orders
CREATE POLICY "Allow public read access on orders"
ON orders FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access on orders"
ON orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access on orders"
ON orders FOR UPDATE
USING (true);

-- Create policies for order_items
CREATE POLICY "Allow public read access on order_items"
ON order_items FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access on order_items"
ON order_items FOR INSERT
WITH CHECK (true);

-- Create policies for delivery_zones
CREATE POLICY "Allow public read access on delivery_zones"
ON delivery_zones FOR SELECT
USING (true);

-- Create policies for products
CREATE POLICY "Allow public read access on products"
ON products FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access on products"
ON products FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access on products"
ON products FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete access on products"
ON products FOR DELETE
USING (true);

-- Create policies for categories
CREATE POLICY "Allow public read access on categories"
ON categories FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access on categories"
ON categories FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update access on categories"
ON categories FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete access on categories"
ON categories FOR DELETE
USING (true);

-- Update delivery fees to 30 for all zones as requested
UPDATE delivery_zones SET delivery_fee = 30.00;
