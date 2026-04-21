/**
 * useOfflineSync
 * 
 * Watches for connectivity changes and flushes the offline order queue
 * to Supabase when the browser comes back online.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as offline from '@/services/offlineStore';
import { useQueryClient } from '@tanstack/react-query';

// Shared flag so we never run two syncs concurrently
let syncing = false;

// Helper to validate UUID
const isValidUUID = (uuid: string) => {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

async function syncPendingOrders() {
  if (syncing) return;
  const pending = offline.getPendingOrders();
  if (pending.length === 0) return;

  syncing = true;
  const toastId = toast.loading(`Syncing ${pending.length} offline order(s)…`);

  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      // Get tenant_id for the order
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id || '')
        .single();

      const order = entry.order;
      const safeOrder: any = {
        total_amount: Number(order.total_amount) || 0,
        status: order.status || 'completed',
        payment_method: order.payment_method || 'cash',
        order_type: order.order_type || 'dine_in',
        register_id: isValidUUID(String(order.register_id)) ? String(order.register_id) : null,
        tenant_id: order.tenant_id || profile?.tenant_id || null,
        customer_id: isValidUUID(String(order.customer_id)) ? String(order.customer_id) : null,
        customer_address: order.customer_address || null,
        server_name: order.server_name || null,
        table_id: isValidUUID(String(order.table_id)) ? String(order.table_id) : null,
      };

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(safeOrder)
        .select()
        .maybeSingle();

      if (orderError || !newOrder) {
        console.error('[Sync] Failed to insert order:', orderError);
        failed++;
        continue;
      }

      // Insert items
      const items = entry.items.map((item: any) => ({
        order_id: newOrder.id,
        quantity: item.quantity,
        price: item.price,
        product_id: item.product_id || null,
        product_name: item.product_name,
        product_category: item.product_category,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(items);

      if (itemsError) {
        // Fallback: try without product_name/category
        const minimalItems = items.map(({ product_name, product_category, ...rest }: any) => rest);
        await supabase.from('order_items').insert(minimalItems);
      }

      offline.markOrderSynced(entry.id);
      synced++;
    } catch (err) {
      console.error('[Sync] Error syncing order:', entry.id, err);
      failed++;
    }
  }

  toast.dismiss(toastId);
  if (synced > 0) toast.success(`✅ ${synced} offline order(s) synced!`);
  if (failed > 0) toast.error(`❌ ${failed} order(s) failed to sync`);

  offline.clearSyncedOrders();
  offline.setLastSync();
  syncing = false;
}

export function useOfflineSync() {
  const queryClient = useQueryClient();
  const hasRun = useRef(false);

  useEffect(() => {
    const handleOnline = async () => {
      console.log('[Offline] Connectivity restored – syncing queued orders…');
      await syncPendingOrders();
      // Refresh all queries so UI picks up fresh data
      queryClient.invalidateQueries();
    };

    window.addEventListener('online', handleOnline);

    // Also try syncing on first mount if we're online and there are pending orders
    if (!hasRun.current && navigator.onLine && offline.getPendingOrders().length > 0) {
      hasRun.current = true;
      syncPendingOrders().then(() => queryClient.invalidateQueries());
    }

    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);
}
