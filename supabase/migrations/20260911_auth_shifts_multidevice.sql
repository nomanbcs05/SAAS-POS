-- =========================================================
-- GENX CLOUD POS: Multi-Device Sessions & Independent Shifts
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USER_SESSIONS TABLE (Multi-device session support)
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    session_id TEXT NOT NULL UNIQUE,
    login_time TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'logged_out', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_status ON public.user_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device_id ON public.user_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON public.user_sessions(session_id);

-- 2. SHIFTS TABLE (Independent shift per user & device)
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    closing_balance NUMERIC(12, 2),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    cashier_name TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Indexes for shifts
CREATE INDEX IF NOT EXISTS idx_shifts_user_device ON public.shifts(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_shifts_device_status ON public.shifts(device_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);

-- 3. RLS Policies
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow user_sessions all" ON public.user_sessions;
CREATE POLICY "Allow user_sessions all" ON public.user_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow shifts all" ON public.shifts;
CREATE POLICY "Allow shifts all" ON public.shifts FOR ALL USING (true) WITH CHECK (true);

-- Grant access to roles
GRANT ALL ON TABLE public.user_sessions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.shifts TO anon, authenticated, service_role;
