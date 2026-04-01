-- 1. Create "restaurant_tables" table
CREATE TABLE IF NOT EXISTS restaurant_tables (
    table_id SERIAL PRIMARY KEY,
    table_number VARCHAR(10) NOT NULL,
    section VARCHAR(50) NOT NULL CHECK (section IN ('indoor', 'outdoor', 'vip')),
    capacity INTEGER DEFAULT 4,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning')),
    current_order_id INTEGER,
    waiter_id INTEGER
);

-- 2. Create "customers" table
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100),
    loyalty_points INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0
);

-- 3. Create "delivery_addresses" table
CREATE TABLE IF NOT EXISTS delivery_addresses (
    address_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(customer_id) ON DELETE CASCADE,
    address_line1 VARCHAR(200) NOT NULL,
    address_line2 VARCHAR(200),
    area VARCHAR(100) NOT NULL,
    city VARCHAR(50) NOT NULL,
    landmark TEXT,
    delivery_zone VARCHAR(50),
    is_default BOOLEAN DEFAULT false
);

-- 4. Create "delivery_zones" table
CREATE TABLE IF NOT EXISTS delivery_zones (
    zone_id SERIAL PRIMARY KEY,
    zone_name VARCHAR(50) NOT NULL,
    delivery_fee DECIMAL(10,2) NOT NULL,
    minimum_order DECIMAL(10,2) NOT NULL,
    estimated_time INTEGER NOT NULL, -- minutes
    is_active BOOLEAN DEFAULT true
);

-- 5. Create "delivery_drivers" table
CREATE TABLE IF NOT EXISTS delivery_drivers (
    driver_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline')),
    active_orders INTEGER DEFAULT 0
);

-- 6. Update existing "orders" table
DO $$ 
BEGIN 
    -- Add order_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type') THEN
        ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) CHECK (order_type IN ('dine_in', 'delivery', 'takeaway'));
    END IF;

    -- Add table_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'table_id') THEN
        ALTER TABLE orders ADD COLUMN table_id INTEGER REFERENCES restaurant_tables(table_id);
    END IF;

    -- Add customer_id if missing (Note: handling potential existing column type mismatch is complex, assuming new or compatible)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_id') THEN
        ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(customer_id);
    ELSE
        -- Optional: If it exists but is not FK, we could try to add constraint, but skipping for safety to avoid data errors
        -- We just ensure it exists.
        NULL;
    END IF;

    -- Add delivery_address_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_address_id') THEN
        ALTER TABLE orders ADD COLUMN delivery_address_id INTEGER REFERENCES delivery_addresses(address_id);
    END IF;

    -- Add delivery_fee if missing (might have been added by previous migration)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_fee') THEN
        ALTER TABLE orders ADD COLUMN delivery_fee DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Add packaging_charges if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'packaging_charges') THEN
        ALTER TABLE orders ADD COLUMN packaging_charges DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Add order_status if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_status') THEN
        ALTER TABLE orders ADD COLUMN order_status VARCHAR(20) DEFAULT 'pending' CHECK (order_status IN ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled'));
    END IF;

    -- Add special_instructions if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'special_instructions') THEN
        ALTER TABLE orders ADD COLUMN special_instructions TEXT;
    END IF;
END $$;

-- 7. Create "delivery_orders" table
CREATE TABLE IF NOT EXISTS delivery_orders (
    delivery_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE, -- Assuming orders.id exists
    customer_id INTEGER REFERENCES customers(customer_id),
    address_id INTEGER REFERENCES delivery_addresses(address_id),
    delivery_zone VARCHAR(50),
    delivery_fee DECIMAL(10,2),
    driver_id INTEGER REFERENCES delivery_drivers(driver_id),
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled'))
);

-- 8. Create "takeaway_orders" table
CREATE TABLE IF NOT EXISTS takeaway_orders (
    takeaway_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    pickup_time TIMESTAMP WITH TIME ZONE,
    is_scheduled BOOLEAN DEFAULT false,
    pickup_status VARCHAR(20) DEFAULT 'pending' CHECK (pickup_status IN ('pending', 'ready', 'picked_up', 'cancelled'))
);

-- Insert sample data
-- Restaurant Tables
INSERT INTO restaurant_tables (table_number, section, capacity) VALUES
('T1', 'indoor', 2),
('T2', 'indoor', 4),
('T3', 'indoor', 4),
('T4', 'outdoor', 4),
('T5', 'outdoor', 6),
('T6', 'outdoor', 6),
('VIP1', 'vip', 8),
('VIP2', 'vip', 10)
ON CONFLICT DO NOTHING;

-- Delivery Zones
INSERT INTO delivery_zones (zone_name, delivery_fee, minimum_order, estimated_time) VALUES
('DHA', 100.00, 500.00, 30),
('Clifton', 150.00, 800.00, 45),
('Gulshan', 200.00, 1000.00, 60),
('Saddar', 150.00, 800.00, 45),
('North Nazimabad', 250.00, 1500.00, 75)
ON CONFLICT DO NOTHING;

-- Delivery Drivers
INSERT INTO delivery_drivers (name, phone, vehicle_type, status) VALUES
('Ahmed Khan', '+923001234567', 'Bike', 'available'),
('Bilal Raza', '+923007654321', 'Bike', 'available'),
('Kashif Ali', '+923001122334', 'Bike', 'available')
ON CONFLICT DO NOTHING;
