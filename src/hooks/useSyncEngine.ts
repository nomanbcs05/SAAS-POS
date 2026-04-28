import { useEffect } from 'react';
import { api } from '@/services/api';
import { isDesktop } from '@/lib/env';
import { toast } from 'sonner';

export const useSyncEngine = () => {
  useEffect(() => {
    if (!isDesktop()) return;

    const syncOrders = async () => {
      if (!window.electronAPI) return;

      try {
        const unsynced = await window.electronAPI.getUnsyncedOrders();
        if (unsynced.length === 0) return;

        console.log(`[Sync Engine] Found ${unsynced.length} unsynced orders`);

        for (const record of unsynced) {
          const order = JSON.parse(record.data);
          const items = JSON.parse(record.items);

          try {
            // Attempt to push to Supabase
            // We use a clean copy of the data
            const result = await api.orders.create(order, items);
            
            if (result && !result._offline) {
              await window.electronAPI.markAsSynced(record.id);
              console.log(`[Sync Engine] Successfully synced order ${record.id}`);
            }
          } catch (err) {
            console.error(`[Sync Engine] Failed to sync order ${record.id}:`, err);
          }
        }
      } catch (err) {
        console.error('[Sync Engine] Critical error in sync loop:', err);
      }
    };

    // Run sync every 30 seconds
    const interval = setInterval(syncOrders, 30000);
    
    // Also run immediately on mount
    syncOrders();

    return () => clearInterval(interval);
  }, []);
};
