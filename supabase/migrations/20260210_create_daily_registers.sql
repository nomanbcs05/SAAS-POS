-- Create daily_registers table
CREATE TABLE IF NOT EXISTS daily_registers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  starting_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ending_amount NUMERIC(10, 2),
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
  notes TEXT
);

-- Add RLS policies
ALTER TABLE daily_registers ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed for auth)
CREATE POLICY "Allow public select on daily_registers"
ON daily_registers FOR SELECT
USING (true);

CREATE POLICY "Allow public insert on daily_registers"
ON daily_registers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update on daily_registers"
ON daily_registers FOR UPDATE
USING (true);
