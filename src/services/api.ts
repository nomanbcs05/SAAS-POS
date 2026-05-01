import { supabase } from '@/integrations/supabase/client';
import { supabaseSignup } from '@/integrations/supabase/supabaseAdmin';
import { Database } from '@/integrations/supabase/types';
import * as offline from './offlineStore';
import { isDesktop } from '@/lib/env';

declare global {
  interface Window {
    electronAPI?: {
      saveOrder: (order: any, items: any[]) => Promise<any>;
      getUnsyncedOrders: () => Promise<any[]>;
      markAsSynced: (id: string) => Promise<any>;
      updateStatus: (id: string, status: string) => Promise<any>;
      updateItems: (id: string, items: any[], total: number) => Promise<any>;
      getAllOrders: () => Promise<any[]>;
      getOrderById: (id: string) => Promise<any>;
      deleteOrder: (id: string) => Promise<any>;
      cacheProducts: (products: any[]) => Promise<any>;
      getCachedProducts: () => Promise<any[]>;
      isDesktop: boolean;
    };
  }
}

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

type Customer = Database['public']['Tables']['customers']['Row'];
type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
type CustomerUpdate = Database['public']['Tables']['customers']['Update'];

type Order = Database['public']['Tables']['orders']['Row'];
type OrderInsert = Database['public']['Tables']['orders']['Insert'];

type OrderItem = Database['public']['Tables']['order_items']['Row'];
type OrderItemInsert = Database['public']['Tables']['order_items']['Insert'] & {
  product_name?: string;
  product_category?: string;
};

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

// Helper to validate UUID - simplified to be more robust
const isValidUUID = (uuid: string) => {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  price: number;
  available: boolean;
  created_at: string;
}

export interface ProductAddon {
  id: string;
  name: string;
  price: number;
  created_at: string;
}

export interface Kitchen {
  id: string;
  name: string;
  created_at: string;
}

export interface DailyRegister {
  id: string;
  opened_at: string;
  closed_at: string | null;
  starting_amount: number;
  ending_amount: number | null;
  status: 'open' | 'closed';
  notes: string | null;
}

// In-memory cache for daily order count to speed up receipt generation
let cachedDailyCount: { count: number; timestamp: number; registerId?: string } | null = null;
const COUNT_CACHE_TTL = 30000; // 30 seconds cache for daily count

export const api = {
  registers: {
    getOpen: async () => {
      // Return a stable placeholder to bypass the shift management system entirely
      return {
        id: 'automatic-session',
        status: 'open',
        opened_at: new Date().toISOString(),
        starting_amount: 0,
      } as DailyRegister;
    },
    start: async (startingAmount: number, openedAt?: string) => {
      // Mock success for any start calls (though they should be gone from UI)
      return {
        id: 'automatic-session',
        status: 'open',
        opened_at: openedAt || new Date().toISOString(),
        starting_amount: startingAmount
      } as DailyRegister;
    },
    close: async (id: string, endingAmount: number, notes?: string) => {
      return { id, status: 'closed' } as any;
    }
  },
  categories: {
    getAll: async () => {
      // Force offline for desktop app to avoid any internet waiting
      if (isDesktop()) {
        console.log('[Desktop] Using offline categories');
        return offline.getCachedCategories() as Category[];
      }

      try {
        const { data, error } = await supabase
          .from('categories' as any)
          .select('*')
          .order('name');
        if (error) throw error;
        offline.cacheCategories(data as Category[]);
        return data as Category[];
      } catch (err) {
        if (!offline.isOnline()) {
          console.warn('[Offline] Using cached categories');
          return offline.getCachedCategories() as Category[];
        }
        throw err;
      }
    },
    create: async (category: Omit<Category, 'id'>) => {
      const { data, error } = await supabase
        .from('categories')
        .insert(category as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Category;
    },
    update: async (id: string, category: Partial<Category>) => {
      const { data, error } = await supabase
        .from('categories')
        .update(category as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Category;
    },
    delete: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },
  products: {
    seedPizzaBurgerHouse: async () => {
      // Products seeding disabled to ensure a clean slate for new restaurants
      console.log("Seeding PizzaBurgerHouse disabled.");
      return true;
    },
    seedArabicBroast: async () => {
      // Products seeding disabled to ensure a clean slate for new restaurants
      console.log("Seeding ArabicBroast disabled.");
      return true;
    },
    getAll: async () => {
      // Force SQLite for desktop app
      if (isDesktop() && window.electronAPI) {
        console.log('[SQLite] Fetching products');
        return await window.electronAPI.getCachedProducts();
      }

      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name');
        if (error) throw error;
        
        if (isDesktop() && window.electronAPI) {
          window.electronAPI.cacheProducts(data as any[]);
        } else {
          offline.cacheProducts(data as any[]);
        }
        return data as any[];
      } catch (err) {
        if (isDesktop() && window.electronAPI) {
          return await window.electronAPI.getCachedProducts();
        }
        if (!offline.isOnline()) {
          return offline.getCachedProducts();
        }
        throw err;
      }
    },
    create: async (product: ProductInsert) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, product: ProductUpdate) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    uploadImage: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    },
    getWithDetails: async () => {
      // Force offline for desktop
      if (isDesktop()) {
        return offline.getCachedProducts();
      }

      // Missing tables fix: Only fetch products, ignore variants/addons
      const { data, error } = await supabase
        .from('products')
        .select('*') // Removed '*, product_variants(*), product_addons(*)'
        .order('name');

      if (error) throw error;
      return data;
    }
  },
  addons: {
    getAll: async () => {
      // Missing table fix: Return empty array immediately
      return [] as ProductAddon[];
    },
    create: async (addon: Omit<ProductAddon, 'id' | 'created_at'>) => {
      // Mock implementation or throw error
      throw new Error("Addons table not implemented");
    },
    delete: async (id: string) => {
      throw new Error("Addons table not implemented");
    }
  },
  kitchens: {
    getAll: async () => {
      // Missing table fix: Return empty array immediately
      return [] as Kitchen[];
    },
    create: async (name: string) => {
      throw new Error("Kitchens table not implemented");
    }
  },
  customers: {
    getAll: async () => {
      // Force offline for desktop app
      if (isDesktop()) {
        console.log('[Desktop] Using offline customers');
        return offline.getCachedCustomers();
      }

      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('name');
        if (error) throw error;
        offline.cacheCustomers(data);
        return data;
      } catch (err) {
        if (!offline.isOnline()) {
          console.warn('[Offline] Using cached customers');
          return offline.getCachedCustomers();
        }
        throw err;
      }
    },
    create: async (customer: CustomerInsert) => {
      const { data, error } = await supabase
        .from('customers')
        .insert(customer)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, customer: CustomerUpdate) => {
      const { data, error } = await supabase
        .from('customers')
        .update(customer)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },
  tables: {
    getAll: async () => {
      // Force offline for desktop
      if (isDesktop()) {
        return [];
      }

      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .order('table_number');
      if (error) throw error;
      return data;
    },
    updateStatus: async (id: string, status: 'available' | 'occupied' | 'reserved' | 'cleaning') => {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    clearReserved: async () => {
      const { error } = await supabase
        .from('restaurant_tables')
        .update({ status: 'available' })
        .eq('status', 'reserved');
      if (error) throw error;
    }
  },
  orders: {
    getAll: async () => {
      // Force SQLite for desktop
      if (isDesktop() && window.electronAPI) {
        try {
          const records = await window.electronAPI.getAllOrders();
          if (!Array.isArray(records)) return [];
          
          return records.map(r => {
            let data = {};
            try { data = JSON.parse(r.data); } catch (e) { console.error('Parse error for order', r.id); }
            
            // Normalize created_at for Date constructor
            let createdAt = r.created_at;
            if (createdAt && typeof createdAt === 'string' && !createdAt.includes('T')) {
              createdAt = createdAt.replace(' ', 'T');
            }

            return {
              ...data,
              id: r.id,
              created_at: createdAt,
              synced: r.synced === 1
            };
          });
        } catch (err) {
          console.error('[SQLite] Failed to fetch orders:', err);
          return [];
        }
      }

      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    getByIdWithItems: async (id: string) => {
      // Force SQLite for desktop
      if (isDesktop() && window.electronAPI) {
        const record = await window.electronAPI.getOrderById(id);
        if (record) {
          let data: any = {};
          let items: any[] = [];
          try { 
            data = JSON.parse(record.data); 
            items = JSON.parse(record.items);
          } catch (e) { console.error('Parse error for order detail', id); }
          
          // Normalize created_at
          let createdAt = record.created_at;
          if (createdAt && typeof createdAt === 'string' && !createdAt.includes('T')) {
            createdAt = createdAt.replace(' ', 'T');
          }

          return {
            ...data,
            id: record.id,
            created_at: createdAt,
            order_items: items.map(item => ({
              ...item,
              products: { name: item.product_name, image: null }
            }))
          };
        }
        throw new Error('Order not found in local database');
      }

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          customers(name, phone, email),
          restaurant_tables(table_number),
          order_items(
            *,
            products(id, name, price, image, category, cost, stock)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    getDailyCount: async (registerId?: string) => {
      // Force SQLite for desktop app
      if (isDesktop() && window.electronAPI) {
        const all = await window.electronAPI.getAllOrders();
        // Return count of orders created today
        const today = new Date().toISOString().split('T')[0];
        return all.filter(o => o.created_at.startsWith(today)).length;
      }
      
      if (!offline.isOnline()) {
        return offline.getDailyCounter();
      }

      // If we have a valid registerId UUID, count orders in that shift
      if (registerId && isValidUUID(registerId)) {
        // 1.5-second timeout for quick offline fallback
        const fetchPromise = supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('register_id', registerId);
        
        try {
          const result = await Promise.race([
            fetchPromise,
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
          ]);

          if (result && !result.error) return result.count || 0;
        } catch (err) {
          console.warn('Timeout or error fetching daily count, falling back to offline count');
          return offline.getDailyCounter();
        }
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      try {
        const { count, error } = await Promise.race([
          supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfDay.toISOString()),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);

        if (error) {
          console.error('Error fetching daily order count:', error);
          return offline.getDailyCounter();
        }

        return count || 0;
      } catch (err) {
        console.warn('Timeout fetching fallback daily count');
        return offline.getDailyCounter();
      }
    },
    create: async (order: any, items: OrderItemInsert[]) => {
      // Helper function to queue order locally
      const enqueueOffline = () => {
        console.warn('[Offline] Queuing order locally for later sync');
        const queued = offline.queueOrder(order, items as any[]);
        return { 
          id: queued.id, 
          _offline: true, 
          created_at: queued.createdAt,
          daily_id: queued.order.daily_id,
          orderNumber: queued.order.daily_id.toString().padStart(2, '0')
        };
      };

      // Force SQLite for desktop app
      if (isDesktop() && window.electronAPI) {
        console.warn('[SQLite] Saving order locally');
        // Ensure order has an ID and timestamp
        const desktopOrder = {
          ...order,
          id: order.id || crypto.randomUUID(),
          created_at: order.created_at || new Date().toISOString()
        };
        await window.electronAPI.saveOrder(desktopOrder, items);
        // For desktop, we might need a daily ID too
        const nextCount = offline.incrementDailyCounter();
        return { 
          id: desktopOrder.id, 
          _offline: true, 
          created_at: desktopOrder.created_at,
          daily_id: nextCount,
          orderNumber: nextCount.toString().padStart(2, '0')
        };
      }

      // If offline, queue the order locally and return a placeholder
      if (!offline.isOnline()) {
        return enqueueOffline();
      }

      // Use provided tenant_id or fetch it if missing
      let tenantId = order.tenant_id;
      
      try {
        if (!tenantId) {
          // Check cache first
          const cachedTenant = offline.getCachedTenant();
          if (cachedTenant?.id) {
            tenantId = cachedTenant.id;
          } else {
            // Timeout the getUser call
            const userPromise = supabase.auth.getUser();
            const authData = await Promise.race([
              userPromise,
              new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
            ]);
            
            if (authData.data?.user) {
              const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', authData.data.user.id).single();
              tenantId = profile?.tenant_id;
            }
          }
        }
      } catch (err) {
        console.warn('Network timeout during auth fetch, falling back to offline mode');
        return enqueueOffline();
      }
      
      // Clean order data to match actual Supabase schema
      // Note: discount_amount, service_charges_amount, delivery_fee columns
      // do not exist in the orders table — do NOT include them
      const safeOrder: any = {
        total_amount: Number(order.total_amount) || 0,
        status: order.status || 'completed',
        payment_method: order.payment_method || 'cash',
        order_type: order.order_type || 'dine_in',
        register_id: isValidUUID(String(order.register_id)) ? String(order.register_id) : null,
        daily_id: order.daily_id || null,
        tenant_id: tenantId || null,
        customer_id: order.customer_id || null,
        customer_address: order.customer_address || null,
        server_name: order.server_name || null,
        table_id: order.table_id || null,
      };

      if (order.server_name) {
        safeOrder.server_name = order.server_name;
      }

      // Add customer_address if present
      if (order.customer_address) {
        safeOrder.customer_address = order.customer_address;
      }

      // Handle customer_id
      if (order.customer_id) {
        const candidate = String(order.customer_id);
        if (isValidUUID(candidate)) {
          safeOrder.customer_id = candidate;
        }
      }

      // Handle table_id if present
      if (order.table_id) {
        const candidate = String(order.table_id);
        if (isValidUUID(candidate)) {
          safeOrder.table_id = candidate;
        }
      }

      // Validate safeOrder object before inserting
      if (!safeOrder.total_amount || typeof safeOrder.total_amount !== 'number') {
        throw new Error('Invalid or missing total_amount');
      }
      if (!safeOrder.payment_method || typeof safeOrder.payment_method !== 'string') {
        throw new Error('Invalid or missing payment_method');
      }

      console.log("Attempting order insertion with safeOrder:", safeOrder);

      // Attempt to insert order into Supabase
      let newOrder: any;
      let orderError: any;
      
      try {
        const insertPromise = supabase
          .from('orders')
          .insert(safeOrder)
          .select()
          .maybeSingle();
          
        const result = await Promise.race([
          insertPromise,
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        
        newOrder = result.data;
        orderError = result.error;
      } catch (err: any) {
        if (err.message === 'timeout' || err.message?.includes('Failed to fetch') || err.message?.includes('FetchError')) {
          console.warn('Network error during insert, falling back to offline mode', err);
          return enqueueOffline();
        }
        orderError = err;
      }
      // Fallback logic for missing columns
      if (orderError && (orderError.code === 'PGRST204' || orderError.message.includes('Could not find the'))) {
        console.warn("Retrying order creation without optional columns (schema mismatch):", orderError.message);
        
        // Strip ALL potentially missing columns
        const { 
          customer_address, 
          server_name, 
          table_id, 
          register_id, 
          tenant_id,
          ...minimalOrder 
        } = safeOrder;
        
        const { data: retryData, error: retryError } = await supabase
          .from('orders')
          .insert(minimalOrder)
          .select()
          .maybeSingle();
          
        if (retryError) {
          console.error("Retry failed even with minimal data:", retryError);
          throw retryError;
        }
        newOrder = retryData;
      } else if (orderError) {
        console.error("Supabase Order Insert Error:", {
          message: orderError.message,
          details: orderError.details,
          hint: orderError.hint,
          code: orderError.code,
          payload: safeOrder
        });
        throw orderError;
      }

      if (!newOrder) throw new Error('Failed to create order - no data returned');

      const itemsWithOrderIdFull = items.map(item => {
        const candidate = (item as any).product_id;
        const dbItem: any = {
          order_id: newOrder.id,
          quantity: item.quantity,
          price: item.price,
          product_name: (item as any).product_name,
          product_category: (item as any).product_category
        };
        if (candidate != null && isValidUUID(String(candidate))) {
          dbItem.product_id = String(candidate);
        }
        return dbItem;
      });

      // Try inserting with product_name/category; if columns don't exist, fallback to minimal shape
      const { error: firstTryError } = await supabase
        .from('order_items')
        .insert(itemsWithOrderIdFull);

      if (firstTryError) {
        console.warn("Enhanced tracking columns (product_name/category) missing in DB. Falling back to basic storage.");
        // Fallback without product_name/category
        const itemsWithOrderId = itemsWithOrderIdFull.map(({ product_name, product_category, ...rest }) => rest);
        const { error: fallbackError } = await supabase
          .from('order_items')
          .insert(itemsWithOrderId);
        if (fallbackError) {
          throw fallbackError;
        }
      }

      // Increment cached count if present
      if (cachedDailyCount && cachedDailyCount.registerId === safeOrder.register_id) {
        cachedDailyCount.count++;
      }

      return newOrder;
    },
    update: async (orderId: string, order: any, items: OrderItemInsert[]) => {
      // Clean order data to match actual Supabase schema
      const safeOrder: any = {
        total_amount: Number(order.total_amount) || 0,
        status: order.status || 'pending',
        payment_method: order.payment_method || 'cash',
        order_type: order.order_type || 'dine_in',
        register_id: isValidUUID(String(order.register_id)) ? String(order.register_id) : null,
        daily_id: order.daily_id || null,
      };

      if (order.server_name) {
        safeOrder.server_name = order.server_name;
      }

      if (order.customer_address) {
        safeOrder.customer_address = order.customer_address;
      }

      if (order.customer_id) {
        const candidate = String(order.customer_id);
        if (isValidUUID(candidate)) {
          safeOrder.customer_id = candidate;
        }
      }

      if (order.table_id) {
        const candidate = String(order.table_id);
        if (isValidUUID(candidate)) {
          safeOrder.table_id = candidate;
        }
      }

      // Helper function to queue offline
      const enqueueOfflineUpdate = () => {
        console.warn('[Offline] Queuing order UPDATE locally for later sync');
        
        // Use queueUpdate which handles both pending and online orders correctly
        const success = offline.queueUpdate(orderId, { 
          status: safeOrder.status, 
          items: items as any[],
          total_amount: safeOrder.total_amount 
        });

        // For UI feedback, we need to return something that looks like an order
        // We try to find the daily_id from existing orders if possible
        return { 
          id: orderId, 
          _offline: true, 
          status: safeOrder.status,
          total_amount: safeOrder.total_amount
        };
      };

      // Force offline for desktop app
      if (isDesktop()) {
        return enqueueOfflineUpdate();
      }

      if (!offline.isOnline()) {
        return enqueueOfflineUpdate();
      }

      // 1. Update order with fallback
      let orderError: any;
      try {
        const updatePromise = supabase
          .from('orders')
          .update(safeOrder)
          .eq('id', orderId);
          
        const result = await Promise.race([
          updatePromise,
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);
        
        orderError = result.error;
      } catch (err: any) {
        if (err.message === 'timeout' || err.message?.includes('Failed to fetch') || err.message?.includes('FetchError')) {
          console.warn('Network error during update, falling back to offline mode', err);
          return enqueueOfflineUpdate();
        }
        orderError = err;
      }

      if (orderError && (orderError.code === 'PGRST204' || orderError.message.includes('Could not find the'))) {
        console.warn("Retrying order update without optional columns:", orderError.message);
        const { 
          customer_address, 
          server_name, 
          table_id, 
          register_id, 
          tenant_id,
          ...minimalOrder 
        } = safeOrder;
        
        const { error: retryError } = await supabase
          .from('orders')
          .update(minimalOrder)
          .eq('id', orderId);
        if (retryError) throw retryError;
      } else if (orderError) {
        throw orderError;
      }

      // 2. Delete existing items
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      if (deleteError) throw deleteError;

      // 3. Insert new items
      const itemsWithOrderIdFull = items.map(item => {
        const candidate = (item as any).product_id;
        const dbItem: any = {
          order_id: orderId,
          quantity: item.quantity,
          price: item.price,
          product_name: (item as any).product_name,
          product_category: (item as any).product_category
        };
        if (candidate != null && isValidUUID(String(candidate))) {
          dbItem.product_id = String(candidate);
        }
        return dbItem;
      });

      // Insert new items with strict snapshotting
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsWithOrderIdFull);

      if (itemsError) throw itemsError;
      return true;
    },
    getOngoing: async () => {
      // Force SQLite for desktop
      if (isDesktop() && window.electronAPI) {
        const records = await window.electronAPI.getAllOrders();
        if (!Array.isArray(records)) return [];
        
        return records
          .map(r => {
            let data: any = {};
            let items: any[] = [];
            try { 
              data = JSON.parse(r.data); 
              items = JSON.parse(r.items);
            } catch (e) { console.error('Parse error for ongoing order', r.id); }
            
            // Normalize created_at
            let createdAt = r.created_at;
            if (createdAt && typeof createdAt === 'string' && !createdAt.includes('T')) {
              createdAt = createdAt.replace(' ', 'T');
            }

            return {
              ...data,
              id: r.id,
              created_at: createdAt,
              order_items: items.map(item => ({
                ...item,
                products: { name: item.product_name, image: null }
              }))
            };
          })
          .filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready');
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      let onlineOrders: any[] = [];
      try {
        const { data, error } = await Promise.race([
          supabase
            .from('orders')
            .select(`
              *,
              customers(name, phone),
              restaurant_tables(table_number),
              order_items(
                *,
                products(name, image)
              )
            `)
            .gte('created_at', startOfDay.toISOString())
            .order('created_at', { ascending: false }),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);

        if (!error && data) onlineOrders = data;
      } catch (err) {
        console.warn('Timeout or error fetching ongoing orders, using empty online list');
      }

      // Merge with offline pending orders
      const pending = offline.getPendingOrders();
      const updates = offline.getPendingUpdates();
      const deletions = offline.getPendingDeletions();

      const offlineOrders = pending
        .filter(p => p.order.status !== 'completed' && !deletions.includes(p.id))
        .map(p => ({
          ...p.order,
          id: p.id,
          created_at: p.createdAt,
          _offline: true,
          order_items: p.items.map(item => ({
            ...item,
            products: { name: item.product_name || 'Item', image: null }
          }))
        }));

      // Apply pending updates and filter out deletions for online orders
      const updatedOnlineOrders = onlineOrders
        .filter(order => !deletions.includes(order.id))
        .map(order => {
          const update = updates[order.id];
          if (update) {
            const updatedOrder = { ...order, ...update, _offline_update: true };
            if (update.items) {
              updatedOrder.order_items = update.items.map((item: any) => ({
                ...item,
                products: { name: item.product_name || 'Item', image: null }
              }));
            }
            return updatedOrder;
          }
          return order;
        });

      // Combine and sort by created_at desc
      const allOrders = [...offlineOrders, ...updatedOnlineOrders].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return allOrders;
    },
    getCompleted: async () => {
      // Force SQLite for desktop
      if (isDesktop() && window.electronAPI) {
        const records = await window.electronAPI.getAllOrders();
        if (!Array.isArray(records)) return [];
        
        return records
          .map(r => {
            let data: any = {};
            let items: any[] = [];
            try { 
              data = JSON.parse(r.data); 
              items = JSON.parse(r.items);
            } catch (e) { console.error('Parse error for completed order', r.id); }
            
            // Normalize created_at
            let createdAt = r.created_at;
            if (createdAt && typeof createdAt === 'string' && !createdAt.includes('T')) {
              createdAt = createdAt.replace(' ', 'T');
            }

            return {
              ...data,
              id: r.id,
              created_at: createdAt,
              order_items: items.map(item => ({
                ...item,
                products: { name: item.product_name, image: null }
              }))
            };
          })
          .filter(o => o.status === 'completed');
      }

      let onlineOrders: any[] = [];
      try {
        const { data, error } = await Promise.race([
          supabase
            .from('orders')
            .select(`
              *,
              customers(name, phone),
              restaurant_tables(table_number),
              order_items(
                *,
                products(name, image)
              )
            `)
            .eq('status', 'completed')
            .order('created_at', { ascending: false }),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);

        if (!error && data) onlineOrders = data;
      } catch (err) {
        console.warn('Timeout or error fetching completed orders, using empty online list');
      }

      // Merge with offline pending orders that are completed
      const pending = offline.getPendingOrders();
      const updates = offline.getPendingUpdates();

      const offlineOrders = pending
        .filter(p => p.order.status === 'completed')
        .map(p => ({
          ...p.order,
          id: p.id,
          created_at: p.createdAt,
          _offline: true,
          order_items: p.items.map(item => ({
            ...item,
            products: { name: item.product_name || 'Item', image: null }
          }))
        }));

      // Find online orders that were completed offline
      const offlineCompletedOnlineOrders = onlineOrders
        .filter(order => updates[order.id]?.status === 'completed')
        .map(order => ({ ...order, status: 'completed', _offline_update: true }));

      const allOrders = [...offlineOrders, ...offlineCompletedOnlineOrders, ...onlineOrders.filter(o => !updates[o.id] || updates[o.id].status !== 'completed')].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return allOrders;
    },
    updateItems: async (orderId: string, items: any[]) => {
      // Force SQLite for desktop
      if (isDesktop() && window.electronAPI) {
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        await window.electronAPI.updateItems(orderId, items, total);
        return true;
      }

      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // If offline, update the local queue
      if (!offline.isOnline()) {
        const success = offline.queueUpdate(orderId, { items, total_amount: total });
        return success;
      }

      try {
        // Delete existing items
        const { error: deleteError } = await Promise.race([
          supabase
            .from('order_items')
            .delete()
            .eq('order_id', orderId),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);

        if (deleteError) throw deleteError;

        // Insert new items
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const itemsToInsert = items.map(item => {
          const row: any = {
            order_id: orderId,
            quantity: item.quantity,
            price: item.price,
            product_name: item.product_name ?? item.products?.name ?? null,
            product_category: item.product_category ?? item.products?.category ?? null,
          };
          if (typeof item.product_id === 'string' && uuidRegex.test(item.product_id)) {
            row.product_id = item.product_id;
          }
          return row;
        });

        const { error: insertError } = await Promise.race([
          supabase
            .from('order_items')
            .insert(itemsToInsert),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);

        if (insertError) throw insertError;

        // Update order total
        const { error: updateError } = await Promise.race([
          supabase
            .from('orders')
            .update({ total_amount: total })
            .eq('id', orderId),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);

        if (updateError) throw updateError;
        return true;
      } catch (err) {
        console.warn('Timeout or error during updateItems, attempting offline update');
        return offline.queueUpdate(orderId, { items, total_amount: total });
      }
    },
    updateStatus: async (id: string, status: string) => {
      // Force SQLite for desktop
      if (isDesktop() && window.electronAPI) {
        await window.electronAPI.updateStatus(id, status);
        return { id, status };
      }

      // If offline, update the local queue
      if (!offline.isOnline()) {
        const success = offline.updateOrderStatus(id, status);
        if (success) return { id, status, _offline: true };
      }

      try {
        const { data, error } = await Promise.race([
          supabase
            .from('orders')
            .update({ status })
            .eq('id', id)
            .select()
            .maybeSingle(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);

        if (error) {
          // If it's a network error, try updating offline
          console.warn('Network error during status update, falling back to offline update');
          offline.updateOrderStatus(id, status);
          return { id, status, _offline: true };
        }
        return data || { id, status };
      } catch (err) {
        console.warn('Timeout or error during status update, falling back to offline update');
        offline.updateOrderStatus(id, status);
        return { id, status, _offline: true };
      }
    },
    delete: async (id: string) => {
      // Force SQLite for desktop
      if (isDesktop() && window.electronAPI) {
        return await window.electronAPI.deleteOrder(id);
      }

      // If offline, delete from local queue
      if (!offline.isOnline()) {
        return offline.deleteOrder(id);
      }

      try {
        // 1. Delete associated order items first
        const { error: itemsError } = await Promise.race([
          supabase
            .from('order_items')
            .delete()
            .eq('order_id', id),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);

        if (itemsError) throw itemsError;

        // 2. Delete the order
        const { error: orderError } = await Promise.race([
          supabase
            .from('orders')
            .delete()
            .eq('id', id),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]);

        if (orderError) throw orderError;
        return true;
      } catch (err) {
        console.warn('Timeout or error during delete, attempting offline delete');
        return offline.deleteOrder(id);
      }
    },
    clearAllToday: async () => {
      // Force SQLite for desktop
      if (isDesktop() && window.electronAPI) {
        return await window.electronAPI.clearAllToday();
      }

      // Clear local offline queue first
      offline.clearAllToday();

      if (!offline.isOnline()) return true;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      try {
        const { data: orders, error: fetchError } = await Promise.race([
          supabase
            .from('orders')
            .select('id')
            .gte('created_at', startOfDay.toISOString()),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);

        if (fetchError) throw fetchError;
        if (!orders || orders.length === 0) return true;

        const orderIds = orders.map(o => o.id);

        // Delete order items first
        const { error: itemsError } = await Promise.race([
          supabase
            .from('order_items')
            .delete()
            .in('order_id', orderIds),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);

        if (itemsError) throw itemsError;

        // Delete orders
        const { error: orderError } = await Promise.race([
          supabase
            .from('orders')
            .delete()
            .in('id', orderIds),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);

        if (orderError) throw orderError;
        return true;
      } catch (err) {
        console.warn('Timeout or error during clearAllToday, already cleared offline queue');
        return true;
      }
    },
    deleteTodayOrders: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // 1. Get IDs of orders to delete
      const { data: orders, error: fetchError } = await supabase
        .from('orders')
        .select('id')
        .gte('created_at', startOfDay.toISOString());

      if (fetchError) throw fetchError;

      if (!orders || orders.length === 0) return;

      const orderIds = orders.map(o => (o as any).id);

      // 2. Delete associated order items first (Manual Cascade)
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', orderIds);

      if (itemsError) throw itemsError;

      // 3. Delete the orders
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .in('id', orderIds);

      if (ordersError) throw ordersError;
    },
    deleteAllOrders: async () => {
      // 1. Delete ALL order items first (Manual Cascade)
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (itemsError) throw itemsError;

      // 2. Delete ALL orders
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (ordersError) throw ordersError;
    },
    fixOrphanedOrders: async () => {
      // 1. Get current user and profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) return 0;

      const tenantId = profile.tenant_id;
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      console.log('Starting deep restoration for tenant:', tenantId);

      // 2. Find ALL orders from today that might belong to this user
      // We look for: tenant_id IS NULL OR tenant_id is some "default" or "legacy" value
      // Since RLS is now relaxed for NULL tenant_id, we can see those.
      const { data: orphaned, error: fetchError } = await supabase
        .from('orders')
        .select('id, tenant_id')
        .gte('created_at', startOfDay.toISOString());

      if (fetchError || !orphaned) {
        console.error('Error fetching orders for restoration:', fetchError);
        return 0;
      }

      // Filter for orders that need claiming (tenant_id is null)
      const toClaim = orphaned.filter(o => !o.tenant_id);
      
      if (toClaim.length === 0) {
        console.log('No orphaned orders found to claim.');
        return 0;
      }

      const ids = toClaim.map(o => o.id);
      console.log(`Claiming ${ids.length} orders for tenant ${tenantId}`);

      // 3. Update orders
      const { error: updateError } = await supabase
        .from('orders')
        .update({ tenant_id: tenantId })
        .in('id', ids);

      if (updateError) {
        console.error('Error updating orphaned orders:', updateError);
        throw updateError;
      }
      
      // 4. Update order items
      const { error: itemsError } = await supabase
        .from('order_items')
        .update({ tenant_id: tenantId })
        .in('order_id', ids);

      if (itemsError) {
        console.warn('Error updating order items (might not have tenant_id column):', itemsError);
      }

      // 5. Restore Tenant Settings (Logo, etc.) from legacy 'restaurants' table if needed
      try {
        const { data: legacyRestaurant } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', tenantId)
          .single();
        
        if (legacyRestaurant) {
          console.log('Found legacy restaurant data, syncing to tenants table...');
          await supabase
            .from('tenants')
            .update({
              restaurant_name: legacyRestaurant.name,
              logo_url: legacyRestaurant.logo_url,
              address: legacyRestaurant.address,
              phone: legacyRestaurant.phone,
              city: legacyRestaurant.city,
              // Add other fields if they exist in both tables
            })
            .eq('id', tenantId);
        }
      } catch (err) {
        console.warn('Legacy settings restoration skipped:', err);
      }

      return toClaim.length;
    }
  },
  reports: {
    getDashboardStats: async () => {
      if (isDesktop() && window.electronAPI) {
        const records = await window.electronAPI.getAllOrders();
        const orders = records.map(r => {
          let data: any = {};
          let items: any[] = [];
          try { 
            data = JSON.parse(r.data); 
            items = JSON.parse(r.items);
          } catch (e) { console.error('Parse error for report order', r.id); }
          
          // Ensure created_at is ISO format (replace space with T if needed)
          let createdAt = r.created_at;
          if (createdAt && !createdAt.includes('T')) {
            createdAt = createdAt.replace(' ', 'T');
          }

          return {
            ...data,
            id: r.id,
            created_at: createdAt || new Date().toISOString(),
            order_items: items.map(item => ({
              ...item,
              products: { name: item.product_name, category: item.product_category }
            }))
          };
        });

        const customers = await api.customers.getAll();

        return {
          orders: orders || [],
          customers: customers || []
        };
      }

      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*, order_items(*, products(*))')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('*');

      if (customersError) throw customersError;

      return {
        orders: orders || [],
        customers: customers || []
      };
    },
    saveGeneratedReport: async (type: string, date: string, data: any) => {
      const { data: result, error } = await supabase
        .from('generated_reports')
        .insert({
          report_type: type,
          report_date: date,
          report_data: data
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    getSavedReports: async (type?: string) => {
      let query = supabase.from('generated_reports').select('*').order('created_at', { ascending: false });
      if (type) query = query.eq('report_type', type);
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  },
  profiles: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data as Profile[];
    },
    getByTenant: async (tenantId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`tenant_id.eq.${tenantId},restaurant_id.eq.${tenantId}`)
        .order('full_name');
      if (error) throw error;
      return data as Profile[];
    },
    update: async (id: string, profile: ProfileUpdate) => {
      const { data, error } = await supabase
        .from('profiles')
        .update(profile)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    },
    delete: async (id: string) => {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    createStaff: async ({ email, password, full_name, role, tenant_id, restaurant_id }: any) => {
      // 1. Sign up the user (isolated from current session)
      const { data: authData, error: authError } = await supabaseSignup.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name,
            role: role || 'cashier',
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      // 2. Create the profile entry
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          full_name,
          email,
          role: role || 'cashier',
          tenant_id: tenant_id || restaurant_id,
          restaurant_id: restaurant_id || tenant_id,
        })
        .select()
        .single();

      if (profileError) throw profileError;
      return profileData;
    },
    changePassword: async (newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return true;
    }
  }
};
