-- ==========================================
-- FIX: TENANT & PROFILE RLS POLICIES (RECURSION FIXED)
-- ==========================================
-- This script fixes the "infinite recursion detected in policy" error
-- by using a SECURITY DEFINER function to bypass RLS when checking tenant_id.

-- 1. First, create/update the helper function (must be SECURITY DEFINER)
-- This function can read the profiles table even if RLS is enabled on it.
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix Profiles Policy
-- We avoid "(SELECT tenant_id FROM profiles...)" inside the policy to prevent recursion.
DROP POLICY IF EXISTS "Profiles isolation" ON public.profiles;
CREATE POLICY "Profiles isolation" ON public.profiles 
FOR ALL USING (
  id = auth.uid() 
  OR tenant_id = public.get_auth_tenant_id()
)
WITH CHECK (
  id = auth.uid() 
  OR tenant_id = public.get_auth_tenant_id()
);

-- 3. Fix Tenants Policies
-- Also use the helper function here for consistency and safety.
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant" ON public.tenants 
FOR SELECT USING (
  auth.uid() = owner_id 
  OR id = public.get_auth_tenant_id()
);

-- Allow users to create their own tenant
DROP POLICY IF EXISTS "Users create their own tenant" ON public.tenants;
DROP POLICY IF EXISTS "Users can create their own tenant" ON public.tenants;
CREATE POLICY "Users can create their own tenant" ON public.tenants 
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Allow users to update their own tenant
DROP POLICY IF EXISTS "Users can update their own tenant" ON public.tenants;
CREATE POLICY "Users can update their own tenant" ON public.tenants 
FOR UPDATE USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 4. Grant full permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
