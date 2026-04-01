
-- Update security policies for the product-images bucket to be more permissive for development
-- Allow public/anon access for upload/update/delete

DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

-- Allow everyone to upload (including anon)
CREATE POLICY "Public can upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'product-images' );

-- Allow everyone to update
CREATE POLICY "Public can update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'product-images' );

-- Allow everyone to delete
CREATE POLICY "Public can delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'product-images' );
