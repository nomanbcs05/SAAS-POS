-- ==========================================
-- CREATE RESTAURANT LOGOS STORAGE BUCKET
-- ==========================================

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('restaurant-logos', 'restaurant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up RLS Policies for the bucket
-- Allow anyone to view logos (Public)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'restaurant-logos' OR bucket_id = 'product-images' );

-- Allow authenticated users to upload their own logos
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload logos" 
ON storage.objects FOR INSERT 
WITH CHECK ( 
  bucket_id = 'restaurant-logos' 
  AND auth.role() = 'authenticated' 
);

-- Allow authenticated users to update their own logos
DROP POLICY IF EXISTS "Authenticated users can update logos" ON storage.objects;
CREATE POLICY "Authenticated users can update logos" 
ON storage.objects FOR UPDATE 
USING ( 
  bucket_id = 'restaurant-logos' 
  AND auth.role() = 'authenticated' 
);

-- Allow authenticated users to delete their own logos
DROP POLICY IF EXISTS "Authenticated users can delete logos" ON storage.objects;
CREATE POLICY "Authenticated users can delete logos" 
ON storage.objects FOR DELETE 
USING ( 
  bucket_id = 'restaurant-logos' 
  AND auth.role() = 'authenticated' 
);
