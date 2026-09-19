-- ==============================================================================
-- GENX CLOUD POS: SAFE FORWARD-ONLY PERFORMANCE INDEXES MIGRATION
-- Paste and Run in Supabase Dashboard -> SQL Editor
-- Description:
--   Resolves PostgREST HTTP 500 Statement Timeout (Postgres error 57014) on:
--     - GET /rest/v1/orders?select=*,order_items(*,products(*))&order=created_at.desc
--     - GET /rest/v1/orders?select=*,order_items(*)
--     - Ongoing Orders, Completed Orders, Reports Page
-- ==============================================================================

-- 1. High-Performance Foreign Key Index on order_items.order_id
-- Prevents sequential table scan of 26,000+ order_items for every order join
CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON public.order_items (order_id);

-- 2. High-Performance Index on order_items.product_id
CREATE INDEX IF NOT EXISTS idx_order_items_product_id 
ON public.order_items (product_id);

-- 3. Standalone Index on orders.created_at DESC
-- Enables fast sorting for orders by created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc 
ON public.orders (created_at DESC);

-- 4. Composite Index for Status & Date queries (used by getOngoing & getCompleted)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at 
ON public.orders (status, created_at DESC);

-- 5. Update Postgres planner statistics
ANALYZE public.orders;
ANALYZE public.order_items;
