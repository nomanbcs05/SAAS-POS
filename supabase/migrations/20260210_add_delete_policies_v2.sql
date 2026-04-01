-- Enable DELETE policies for orders and order_items
-- This is required for the "Clear History" functionality to work

-- Allow public delete access on orders
CREATE POLICY "Allow public delete access on orders"
ON orders FOR DELETE
USING (true);

-- Allow public delete access on order_items
CREATE POLICY "Allow public delete access on order_items"
ON order_items FOR DELETE
USING (true);
