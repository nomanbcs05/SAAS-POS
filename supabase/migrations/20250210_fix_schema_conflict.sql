-- Fix for "foreign key constraint ... cannot be implemented" (UUID vs Integer mismatch)
-- And ensuring customer_id consistency.

-- 1. Drop tables to clean slate
DROP TABLE IF EXISTS delivery_orders CASCADE;
DROP TABLE IF EXISTS takeaway_orders CASCADE;
DROP TABLE IF EXISTS delivery_addresses CASCADE;
DROP TABLE IF EXISTS customers CASCADE; 
DROP TABLE IF EXISTS restaurant_tables CASCADE;
DROP TABLE IF EXISTS delivery_zones CASCADE;
DROP TABLE IF EXISTS delivery_drivers CASCADE;

-- 2. Re-create "customers" table (Integer ID)
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100),
    loyalty_points INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0
);

-- 3. Re-create "delivery_addresses" table
CREATE TABLE delivery_addresses (
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

-- 4. Create other tables
-- Note: current_order_id changed to UUID to match orders.id which is UUID in Supabase
CREATE TABLE restaurant_tables (
    table_id SERIAL PRIMARY KEY,
    table_number VARCHAR(10) NOT NULL,
    section VARCHAR(50) NOT NULL CHECK (section IN ('indoor', 'outdoor', 'vip')),
    capacity INTEGER DEFAULT 4,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning')),
    current_order_id UUID, 
    waiter_id INTEGER
);

CREATE TABLE delivery_zones (
    zone_id SERIAL PRIMARY KEY,
    zone_name VARCHAR(50) NOT NULL,
    delivery_fee DECIMAL(10,2) NOT NULL,
    minimum_order DECIMAL(10,2) NOT NULL,
    estimated_time INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE delivery_drivers (
    driver_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'busy', 'offline')),
    active_orders INTEGER DEFAULT 0
);

-- 5. Fix "orders" table references
DO $$ 
BEGIN 
    -- Check if customer_id exists in orders. 
    -- If it's UUID (from previous setup), we can't link it to our new INTEGER customers table.
    -- We will drop it if it's UUID so we can recreate it as INTEGER.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'customer_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE orders DROP COLUMN customer_id;
    END IF;

    -- Now ensure customer_id is INTEGER and references customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_id') THEN
        ALTER TABLE orders ADD COLUMN customer_id INTEGER REFERENCES customers(customer_id);
    ELSE
        -- If it exists (as integer), try to add FK if missing
        BEGIN
            ALTER TABLE orders ADD CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id);
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Constraint might already exist
        END;
    END IF;

    -- Add other columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type') THEN
        ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) CHECK (order_type IN ('dine_in', 'delivery', 'takeaway'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'table_id') THEN
        ALTER TABLE orders ADD COLUMN table_id INTEGER REFERENCES restaurant_tables(table_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_address_id') THEN
        ALTER TABLE orders ADD COLUMN delivery_address_id INTEGER REFERENCES delivery_addresses(address_id);
    END IF;
END $$;

-- 6. Re-create dependent order tables (Using UUID for order_id)
CREATE TABLE delivery_orders (
    delivery_id SERIAL PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(customer_id),
    address_id INTEGER REFERENCES delivery_addresses(address_id),
    delivery_zone VARCHAR(50),
    delivery_fee DECIMAL(10,2),
    driver_id INTEGER REFERENCES delivery_drivers(driver_id),
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
    delivery_status VARCHAR(20) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled'))
);

CREATE TABLE takeaway_orders (
    takeaway_id SERIAL PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    pickup_time TIMESTAMP WITH TIME ZONE,
    is_scheduled BOOLEAN DEFAULT false,
    pickup_status VARCHAR(20) DEFAULT 'pending' CHECK (pickup_status IN ('pending', 'ready', 'picked_up', 'cancelled'))
);

-- Insert sample data
INSERT INTO restaurant_tables (table_number, section, capacity) VALUES
('T1', 'indoor', 2), ('T2', 'indoor', 4), ('T3', 'indoor', 4),
('T4', 'outdoor', 4), ('T5', 'outdoor', 6), ('T6', 'outdoor', 6),
('VIP1', 'vip', 8), ('VIP2', 'vip', 10);

-- Updated Delivery Zones (Fee: 30)
INSERT INTO delivery_zones (zone_name, delivery_fee, minimum_order, estimated_time) VALUES
('DHA', 30.00, 500.00, 30),
('Clifton', 30.00, 800.00, 45),
('Gulshan', 30.00, 1000.00, 60),
('Saddar', 30.00, 800.00, 45),
('North Nazimabad', 30.00, 1500.00, 75);

INSERT INTO delivery_drivers (name, phone, vehicle_type, status) VALUES
('Ahmed Khan', '+923001234567', 'Bike', 'available'),
('Bilal Raza', '+923007654321', 'Bike', 'available'),
('Kashif Ali', '+923001122334', 'Bike', 'available');
