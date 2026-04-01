-- Update restaurant address, city and phone in Supabase
-- Run this in your Supabase SQL Editor to update the live restaurant record

UPDATE public.restaurants
SET
  address = 'Near Lasani Chicken Broast, Gol Wala Complex',
  city    = 'Nawabshah',
  phone   = '+92 332 2822654'
WHERE name ILIKE '%pizza%burger%house%'
   OR name ILIKE '%PBH%'
   OR name ILIKE '%GENX%';
