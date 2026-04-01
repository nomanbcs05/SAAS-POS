-- Run this in the Supabase SQL Editor to add the register_id column to the orders table
-- This allows linking orders to the specific shift (register) they belong to

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS register_id UUID REFERENCES public.daily_registers(id);

-- Optional: Index the register_id for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_register_id ON public.orders(register_id);
