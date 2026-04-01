-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- This script fixes the "violates row-level security" error when creating a restaurant

-- 1. Helper function to check if the user is a Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  RETURN coalesce(v_role, '') = 'super-admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure RLS is active
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- 3. Drop all previous (potentially broken) policies on this table
DROP POLICY IF EXISTS "Super Admins can manage all restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Users can create a restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Users can view their affiliated restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Owners can update their restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.restaurants;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.restaurants;

-- 4. Add the corrected SaaS policies

-- Super Admins get God Mode on restaurants
CREATE POLICY "Super Admins can manage all restaurants" ON public.restaurants
FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Regular Admins can create a restaurant if they set themselves as the owner
CREATE POLICY "Users can create a restaurant" ON public.restaurants
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Cashiers/Admins can see the restaurant they belong to, or own
CREATE POLICY "Users can view their affiliated restaurant" ON public.restaurants
FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR id = public.get_current_restaurant_id());

-- Owners can edit their own restaurant details
CREATE POLICY "Owners can update their restaurant" ON public.restaurants
FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());
