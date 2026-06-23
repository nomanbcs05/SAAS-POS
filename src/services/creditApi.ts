import { supabase } from '@/integrations/supabase/client';
import { isDesktop } from '@/lib/env';
import { getCachedCustomers, cacheCustomers } from '@/services/offlineStore';

export const creditApi = {
  getCustomersWithCredit: async () => {
    if (isDesktop()) {
      const customers = await getCachedCustomers();
      return customers
        .filter((c: any) => Number(c.credit_balance || 0) > 0)
        .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .gt('credit_balance', 0)
      .order('name');

    if (error) throw error;
    return data;
  },

  receivePayment: async (customerId: string, amountReceived: number, notes?: string) => {
    if (isDesktop()) {
      const customers = await getCachedCustomers();
      const customer = customers.find((c: any) => c.id === customerId);
      if (!customer) throw new Error('Customer not found');

      const currentBalance = Number(customer.credit_balance || 0);
      const newBalance = Math.max(0, currentBalance - amountReceived);

      customer.credit_balance = newBalance;
      await cacheCustomers(customers);

      // Save ledger entry locally
      if (typeof window !== 'undefined' && window.electronAPI) {
        try {
          const raw = await window.electronAPI.getItem('pos_offline_ledger');
          const ledger: any[] = raw ? JSON.parse(raw) : [];
          ledger.push({
            entity_type: 'customer',
            customer_id: customerId,
            type: 'debit',
            amount: amountReceived,
            description: notes || 'Credit Payment Received',
            tenant_id: customer.tenant_id,
            created_at: new Date().toISOString(),
          });
          await window.electronAPI.setItem('pos_offline_ledger', JSON.stringify(ledger));
        } catch (e) {
          console.error('Failed to save offline ledger entry:', e);
        }
      }

      return { success: true, previousBalance: currentBalance, newBalance };
    }

    // 1. Fetch current customer balance
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('credit_balance, tenant_id')
      .eq('id', customerId)
      .single();

    if (fetchError) throw fetchError;

    const currentBalance = Number(customer.credit_balance || 0);
    const newBalance = Math.max(0, currentBalance - amountReceived);

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
        tenant_id: customer.tenant_id,
      });

    if (ledgerError) {
      console.error('Failed to insert ledger entry:', ledgerError);
    }

    return { success: true, previousBalance: currentBalance, newBalance };
  },
};
