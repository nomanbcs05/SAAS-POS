import { supabase } from '@/integrations/supabase/client';
import { supabaseSignup } from '@/integrations/supabase/supabaseAdmin';
import { Database } from '@/integrations/supabase/types';
import * as offline from './offlineStore';

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
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name');
        if (error) throw error;
        offline.cacheProducts(data as any[]);
        return data as any[];
      } catch (err) {
        if (!offline.isOnline()) {
          console.warn('[Offline] Using cached products');
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
      const { data, error } = await supabase
        .from('orders')
        .select('*, customers(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    getByIdWithItems: async (id: string) => {
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
      // If we have a valid registerId UUID, count orders in that shift
      if (registerId && isValidUUID(registerId)) {
        const { count, error } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('register_id', registerId);

        if (!error) return count || 0;
        // If error (e.g. column missing), fallback to daily count
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString());

      if (error) {
        console.error('Error fetching daily order count:', error);
        return 0;
      }

      return count || 0;
    },
    create: async (order: any, items: OrderItemInsert[]) => {
      // If offline, queue the order locally and return a placeholder
      if (!offline.isOnline()) {
        console.warn('[Offline] Queuing order locally for later sync');
        const queued = offline.queueOrder(order, items as any[]);
        return { id: queued.id, _offline: true, created_at: queued.createdAt };
      }

      // Use provided tenant_id or fetch it if missing
      let tenantId = order.tenant_id;
      
      if (!tenantId) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user?.id || '').single();
        tenantId = profile?.tenant_id;
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
      let { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert(safeOrder)
        .select()
        .maybeSingle();

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

      // 1. Update order with fallback
      let { error: orderError } = await supabase
        .from('orders')
        .update(safeOrder)
        .eq('id', orderId);

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
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
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
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    updateStatus: async (id: string, status: string) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      // 1. Delete associated order items first
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', id);

      if (itemsError) throw itemsError;

      // 2. Delete the order
      const { error: orderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (orderError) throw orderError;
      return true;
    },
    clearAllToday: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: orders, error: fetchError } = await supabase
        .from('orders')
        .select('id')
        .gte('created_at', startOfDay.toISOString());

      if (fetchError) throw fetchError;
      if (!orders || orders.length === 0) return;

      const orderIds = orders.map(o => o.id);

      // Delete order items first
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', orderIds);

      if (itemsError) throw itemsError;

      // Delete orders
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .in('id', orderIds);

      if (ordersError) throw ordersError;
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
