-- Add credit_balance to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_balance NUMERIC DEFAULT 0;

-- Optional: Create an RPC to safely increment credit balance
CREATE OR REPLACE FUNCTION public.increment_customer_credit(customer_id UUID, amount NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE public.customers
  SET credit_balance = COALESCE(credit_balance, 0) + amount
  WHERE id = customer_id;
END;
$$ LANGUAGE plpgsql;
