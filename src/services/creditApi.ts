import { supabase } from '@/integrations/supabase/client';

export const creditApi = {
  getCustomersWithCredit: async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .gt('credit_balance', 0)
      .order('name');
      
    if (error) throw error;
    return data;
  },

  receivePayment: async (customerId: string, amountReceived: number, notes?: string) => {
    // 1. Fetch current customer balance
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('credit_balance, tenant_id')
      .eq('id', customerId)
      .single();

    if (fetchError) throw fetchError;

    const currentBalance = Number(customer.credit_balance || 0);
    const newBalance = Math.max(0, currentBalance - amountReceived); // Prevent negative balance

    // 2. Update customer balance
    const { error: updateError } = await supabase
      .from('customers')
      .update({ credit_balance: newBalance })
      .eq('id', customerId);

    if (updateError) throw updateError;

    // 3. Add ledger entry for the payment
    const { error: ledgerError } = await supabase
      .from('ledger_entries')
      .insert({
        entity_type: 'customer',
        customer_id: customerId,
        type: 'debit',
        amount: amountReceived,
        description: notes || 'Credit Payment Received',
        tenant_id: customer.tenant_id
      });

    if (ledgerError) {
      console.error('Failed to insert ledger entry:', ledgerError);
      // We don't throw here to avoid failing the payment if ledger fails, but in a real $10k app we might use an RPC transaction
    }

    return { success: true, previousBalance: currentBalance, newBalance };
  }
};
