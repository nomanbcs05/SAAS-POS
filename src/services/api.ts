import { supabase } from '@/integrations/supabase/client';
import { supabaseSignup } from '@/integrations/supabase/supabaseAdmin';
import { Database } from '@/integrations/supabase/types';
import * as offline from './offlineStore';
import { isDesktop } from '@/lib/env';
import { shiftService } from './shiftService';

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
  cashier_name?: string;
}

// In-memory cache for daily order count to speed up receipt generation
let cachedDailyCount: { count: number; timestamp: number; registerId?: string } | null = null;
const COUNT_CACHE_TTL = 120000; // 2 minutes cache for daily count (speeds up KOT/Complete)

// Helper to refresh and cache products locally
const recacheProducts = async () => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    if (!error && data) {
      if (isDesktop() && window.electronAPI) {
        await window.electronAPI.cacheProducts(data as any[]);
      } else {
        offline.cacheProducts(data as any[]);
      }
    }
  } catch (err) {
    console.warn('[Sync] Failed to update products cache:', err);
  }
};

// Helper to refresh and cache categories locally
const recacheCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('categories' as any)
      .select('*')
      .order('name');
    if (!error && data) {
      offline.cacheCategories(data as Category[]);
    }
  } catch (err) {
    console.warn('[Sync] Failed to update categories cache:', err);
  }
};

export const api = {
  registers: {
    getOpen: async () => {
      return shiftService.getCurrentCashierOpenShift() as unknown as DailyRegister | null;
    },
    getActiveShifts: async () => {
      return shiftService.getActiveShifts();
    },
    start: async (startingAmount: number, cashierName?: string) => {
      return (await shiftService.openShift(startingAmount, cashierName)) as unknown as DailyRegister;
    },
    close: async (id: string, endingAmount?: number) => {
      return (await shiftService.closeShift(id, endingAmount)) as unknown as DailyRegister;
    }
  },
  categories: {
    getAll: async () => {
      try {
        if (offline.isOnline()) {
          const { data, error } = await supabase
            .from('categories' as any)
            .select('*')
            .order('name');
          if (error) throw error;
          await offline.cacheCategories(data as Category[]);
          return data as Category[];
        }
      } catch (err) {
        console.warn('[Categories] Failed to fetch online categories:', err);
      }

      // Fallback
      return await offline.getCachedCategories() as Category[];
    },
    create: async (category: Omit<Category, 'id'>) => {
      if (isDesktop() || !offline.isOnline()) {
        const categories = await offline.getCachedCategories();
        const newCategory = {
          ...category,
          id: crypto.randomUUID()
        } as Category;
        categories.push(newCategory);
        await offline.cacheCategories(categories);
        return newCategory;
      }

      const { data, error } = await supabase
        .from('categories')
        .insert(category as any)
        .select()
        .single();
      if (error) throw error;
      await recacheCategories();
      return data as unknown as Category;
    },
    update: async (id: string, category: Partial<Category>) => {
      if (isDesktop() || !offline.isOnline()) {
        const categories = await offline.getCachedCategories();
        const index = categories.findIndex((c: any) => c.id === id);
        if (index !== -1) {
          categories[index] = { ...categories[index], ...category };
          await offline.cacheCategories(categories);
          return categories[index];
        }
        throw new Error("Category not found locally");
      }

      const { data, error } = await supabase
        .from('categories')
        .update(category as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await recacheCategories();
      return data as unknown as Category;
    },
    delete: async (id: string) => {
      if (isDesktop() || !offline.isOnline()) {
        const categories = await offline.getCachedCategories();
        const filtered = categories.filter((c: any) => c.id !== id);
        await offline.cacheCategories(filtered);
        return;
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await recacheCategories();
    }
  },
  products: {
    seedRajputRestaurant: async () => {
      const rajputItems = [
        { sku: '61', name: 'Tea', price: 90, category: 'Soups' },
        { sku: '62', name: 'Lasi', price: 130, category: 'Fast Food' },
        { sku: '63', name: 'M-Water 1.5ltr', price: 120, category: 'English' },
        { sku: '64', name: 'M-Water 500mg', price: 60, category: 'English' },
        { sku: '65', name: 'S-drink (reg)', price: 60, category: 'Salads' },
        { sku: '66', name: 'S-Drink 500ml', price: 120, category: 'English' },
        { sku: '67', name: 'S-Drink 1.5ltr', price: 200, category: 'English' },
        { sku: '68', name: 'S-Drink ( Tin )', price: 120, category: 'English' },
        { sku: '69', name: 'Milk 500ml + Soda 250ml', price: 250, category: 'Beverage' },
        { sku: '70', name: 'Milk 1000ml + Soda 500ml', price: 500, category: 'Beverage' },
        { sku: '71', name: 'Milk (Sada) 250ml', price: 70, category: 'Beverage' },
        { sku: '72', name: 'Milk (Sugar) 250ml', price: 60, category: 'Beverage' },
        { sku: '73', name: 'Milk (Sada) 375ml', price: 90, category: 'Beverage' },
        { sku: '74', name: 'Milk 500ml', price: 140, category: 'Beverage' },
        { sku: '75', name: 'Milk (Sugar) 375ml', price: 110, category: 'Beverage' },
        { sku: '76', name: 'Milk (sada) 500ml', price: 120, category: 'Beverage' },
        { sku: '77', name: 'Dahi 250gm', price: 90, category: 'Beverage' },
        { sku: '78', name: 'Dahi 500gm', price: 180, category: 'Beverage' },
        { sku: '79', name: 'Dahi 1 Kg', price: 360, category: 'Beverage' },
        { sku: '80', name: 'Chapati', price: 15, category: 'Chinese' },
        { sku: '81', name: 'Roti', price: 20, category: 'Fast Food' },
        { sku: '82', name: 'Raita', price: 50, category: 'Fast Food' },
        { sku: '83', name: 'Salad', price: 50, category: 'Fast Food' },
        { sku: '84', name: 'Per Head', price: 200, category: 'Salads' },
        { sku: '85', name: 'Egg Omlate', price: 70, category: 'Fast Food' },
        { sku: '86', name: 'Egg Half fry', price: 70, category: 'Fast Food' },
        { sku: '88', name: 'Dal', price: 150, category: 'Pakistani' },
        { sku: '89', name: 'Dal Fry', price: 200, category: 'Pakistani' },
        { sku: '90', name: 'Chana', price: 180, category: 'Pakistani' },
        { sku: '91', name: 'Chana Fry', price: 220, category: 'Pakistani' },
        { sku: '94', name: 'Ch: Qurma', price: 250, category: 'Pakistani' },
        { sku: '96', name: 'Dal (100)', price: 100, category: 'Pakistani' },
        { sku: '99', name: 'Anda Garabe', price: 150, category: 'Pakistani' },
        { sku: '100', name: 'Ch: Karahi (Q)', price: 500, category: 'Pakistani' },
        { sku: '101', name: 'Ch: Karahi (H)', price: 1000, category: 'Pakistani' },
        { sku: '102', name: 'Ch:Karahi (F)', price: 2000, category: 'Pakistani' },
        { sku: '103', name: 'Ch: White Karahi (Q)', price: 550, category: 'Pakistani' },
        { sku: '104', name: 'Ch: White Karahi (H)', price: 1100, category: 'Pakistani' },
        { sku: '105', name: 'Ch: White Karahi (F)', price: 2200, category: 'Pakistani' },
        { sku: '106', name: 'Ch: Green Karahi (Q)', price: 550, category: 'Pakistani' },
        { sku: '107', name: 'Ch: Green Karahi (H)', price: 1100, category: 'Pakistani' },
        { sku: '108', name: 'Ch: Green Karahi (F)', price: 2200, category: 'Pakistani' },
        { sku: '109', name: 'Ch: Brown (Q)', price: 500, category: 'Pakistani' },
        { sku: '110', name: 'Ch: Brown (H)', price: 1000, category: 'Pakistani' },
        { sku: '111', name: 'Ch: Brown (F)', price: 2000, category: 'Pakistani' },
        { sku: '112', name: 'Ch:white Bonless (750)', price: 2100, category: 'Pakistani' },
        { sku: '113', name: 'Ch:white Bonless (H)', price: 1400, category: 'Pakistani' },
        { sku: '114', name: 'Ch:handi Bonless 3 (pao)', price: 2100, category: 'Beverage' },
        { sku: '115', name: 'Ch: Handi Bonless (Q)', price: 700, category: 'Pakistani' },
        { sku: '116', name: 'Ch: Handi Bonless (H)', price: 1400, category: 'Pakistani' },
        { sku: '117', name: 'Ch: Handi Bonless (F)', price: 2800, category: 'Pakistani' },
        { sku: '118', name: 'Mutton Karahi (Q)', price: 1000, category: 'Chinese' },
        { sku: '119', name: 'Mutton Karahi (H)', price: 2000, category: 'Chinese' },
        { sku: '120', name: 'Mutton Karahi (F)', price: 4000, category: 'Chinese' },
        { sku: '121', name: 'Mutton Brown (Q)', price: 1000, category: 'Chinese' },
        { sku: '122', name: 'Mutton Brown (H)', price: 2000, category: 'Chinese' },
        { sku: '123', name: 'Mutton Brown (F)', price: 4000, category: 'Chinese' },
        { sku: '166', name: 'Bun', price: 60, category: 'Fast Food' },
        { sku: '168', name: 'Milk (Sugar) 1ltr', price: 280, category: 'Beverage' },
        { sku: '170', name: 'Tika Bihari', price: 400, category: 'Pakistani' },
        { sku: '187', name: 'Chapati', price: 15, category: 'Chinese' },
        { sku: '212', name: 'Labour Salan', price: 0, category: 'Pakistani' },
        { sku: '213', name: 'Haff Cutt Labour', price: 0, category: 'Pakistani' },
        { sku: '214', name: 'Labour Roti', price: 0, category: 'Fast Food' },
      ];

      try {
        if (offline.isOnline()) {
          const insertPayloads = rajputItems.map((item) => ({
            name: item.name,
            sku: item.sku,
            price: item.price,
            cost: Math.round(item.price * 0.6),
            stock: 999,
            category: item.category,
          }));

          const { data, error } = await supabase
            .from('products')
            .upsert(insertPayloads, { onConflict: 'sku' })
            .select('*');

          if (!error && data && data.length > 0) {
            await offline.cacheProducts(data as any[]);
            return true;
          }
        }
      } catch (err) {
        console.warn('Supabase upsert failed, caching locally:', err);
      }

      // Offline fallback
      const cached = (await offline.getCachedProducts()) || [];
      const updatedList = [...cached];
      rajputItems.forEach((item) => {
        if (!updatedList.some((p: any) => p.sku === item.sku)) {
          updatedList.push({
            id: crypto.randomUUID(),
            name: item.name,
            sku: item.sku,
            price: item.price,
            cost: Math.round(item.price * 0.6),
            stock: 999,
            category: item.category,
            created_at: new Date().toISOString(),
          } as any);
        }
      });
      await offline.cacheProducts(updatedList);
      return true;
    },
    seedPizzaBurgerHouse: async () => {
      console.log("Seeding PizzaBurgerHouse disabled.");
      return true;
    },
    seedArabicBroast: async () => {
      console.log("Seeding ArabicBroast disabled.");
      return true;
    },
    getAll: async () => {
      try {
        if (offline.isOnline()) {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name');
          if (error) throw error;
          
          if (!data || data.length === 0) {
            // Auto seed Rajput Restaurant items if table is empty
            await api.products.seedRajputRestaurant();
            const { data: seededData } = await supabase.from('products').select('*').order('name');
            if (seededData && seededData.length > 0) {
              await offline.cacheProducts(seededData as any[]);
              return seededData as any[];
            }
          }

          await offline.cacheProducts(data as any[]);
          return data as any[];
        }
      } catch (err) {
        console.warn('[Products] Failed to fetch online products:', err);
      }

      // Fallback
      const cached = await offline.getCachedProducts();
      if (!cached || cached.length === 0) {
        await api.products.seedRajputRestaurant();
        return await offline.getCachedProducts();
      }
      return cached;
    },
    create: async (product: ProductInsert) => {
      if (isDesktop() || !offline.isOnline()) {
        const products = await offline.getCachedProducts();
        const newProduct = {
          ...product,
          id: product.id || crypto.randomUUID(),
          created_at: new Date().toISOString()
        } as Product;
        products.push(newProduct);
        await offline.cacheProducts(products);
        return newProduct;
      }

      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();
      if (error) throw error;
      await recacheProducts();
      return data;
    },
    update: async (id: string, product: ProductUpdate) => {
      if (isDesktop() || !offline.isOnline()) {
        const products = await offline.getCachedProducts();
        const index = products.findIndex((p: any) => p.id === id);
        if (index !== -1) {
          products[index] = { ...products[index], ...product };
          await offline.cacheProducts(products);
          return products[index];
        }
        throw new Error("Product not found locally");
      }

      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await recacheProducts();
      return data;
    },
    decrementStock: async (orderItems: Array<{ product_id: string | null | undefined; name?: string; quantity: number }>) => {
      try {
        // ALWAYS run ingredient deduction (BOM recipe or smart auto-matching)
        try {
          const { deductIngredientsForSoldProducts } = await import('@/modules/inventory/inventoryApi');
          await deductIngredientsForSoldProducts(orderItems);
        } catch (invErr) {
          console.error('[Inventory Hook] Failed to deduct raw materials:', invErr);
        }

        const validItems = orderItems.filter(
          (item) => item.product_id && isValidUUID(item.product_id as string)
        );
        if (validItems.length === 0) return;

        if (isDesktop() || !offline.isOnline()) {
          const products = await offline.getCachedProducts();
          let modified = false;
          for (const item of validItems) {
            const product = products.find((p: any) => p.id === item.product_id);
            if (product && product.stock !== null && product.stock !== undefined) {
              product.stock = Math.max(0, (product.stock || 0) - item.quantity);
              modified = true;
            }
          }
          if (modified) {
            await offline.cacheProducts(products);
          }
          return;
        }

        const ids = [...new Set(validItems.map((i) => i.product_id as string))];

        // Fetch current stock for all sold products in one query
        const { data: products, error } = await supabase
          .from('products')
          .select('id, stock')
          .in('id', ids);

        if (error || !products || products.length === 0) return;

        // Decrement each product's stock (floor at 0)
        await Promise.all(
          products.map(async (product: any) => {
            if (product.stock === null || product.stock === undefined) return;
            const soldQty = validItems
              .filter((i) => i.product_id === product.id)
              .reduce((sum, i) => sum + i.quantity, 0);
            const newStock = Math.max(0, (product.stock || 0) - soldQty);
            await supabase
              .from('products')
              .update({ stock: newStock })
              .eq('id', product.id);
          })
        );

        // Refresh local cache so POS dashboard shows updated stock instantly
        await recacheProducts();
      } catch (err) {
        // Never block the sale — log silently
        console.error('[Stock] Failed to decrement stock after sale:', err);
      }
    },
    incrementStock: async (orderItems: Array<{ product_id: string | null | undefined; quantity: number }>) => {
      try {
        const validItems = orderItems.filter(
          (item) => item.product_id && isValidUUID(item.product_id as string)
        );
        if (validItems.length === 0) return;

        if (isDesktop() || !offline.isOnline()) {
          const products = await offline.getCachedProducts();
          let modified = false;
          for (const item of validItems) {
            const product = products.find((p: any) => p.id === item.product_id);
            if (product && product.stock !== null && product.stock !== undefined) {
              product.stock = (product.stock || 0) + item.quantity;
              modified = true;
            }
          }
          if (modified) {
            await offline.cacheProducts(products);
          }
          return;
        }

        const ids = [...new Set(validItems.map((i) => i.product_id as string))];

        // Fetch current stock for all sold products in one query
        const { data: products, error } = await supabase
          .from('products')
          .select('id, stock')
          .in('id', ids);

        if (error || !products || products.length === 0) return;

        // Increment each product's stock
        await Promise.all(
          products.map(async (product: any) => {
            const soldQty = validItems
              .filter((i) => i.product_id === product.id)
              .reduce((sum, i) => sum + i.quantity, 0);
            const newStock = (product.stock || 0) + soldQty;
            await supabase
              .from('products')
              .update({ stock: newStock })
              .eq('id', product.id);
          })
        );

        // Refresh local cache
        await recacheProducts();
      } catch (err) {
        console.error('[Stock] Failed to increment stock after cancellation:', err);
      }
    },
    delete: async (id: string) => {
      // 1. Remove from local offline cache
      const products = await offline.getCachedProducts();
      const filtered = (products || []).filter((p: any) => p.id !== id);
      await offline.cacheProducts(filtered);

      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (!isDesktop() && offline.isOnline() && isValidUUID) {
        try {
          // Clean up foreign key references in order_items and recipe_items before deleting
          await supabase.from('inventory_recipes' as any).delete().eq('product_id', id).catch(() => {});
          await supabase.from('order_items').update({ product_id: null }).eq('product_id', id).catch(() => {});
          
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
          if (error) {
            console.warn('[Products] DB delete error, product removed locally:', error.message);
          }
        } catch (err) {
          console.warn('[Products] DB delete failed:', err);
        }
      }
      await recacheProducts();
    },
    uploadImage: async (file: File) => {
      if (isDesktop() || !offline.isOnline()) {
        // Return a base64 data URL for local storage
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to read file as data URL"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

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
      try {
        if (offline.isOnline()) {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name');
          if (error) throw error;
          
          await offline.cacheProducts(data as any[]);
          return data as any[];
        }
      } catch (err) {
        console.warn('[Products] Failed to fetch online products with details:', err);
      }

      // Fallback
      return await offline.getCachedProducts();
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
      if (isDesktop() || !offline.isOnline()) {
        console.log('[Desktop/Offline] Using offline customers');
        return await offline.getCachedCustomers();
      }

      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .order('name');
        if (error) throw error;
        await offline.cacheCustomers(data);
        return data;
      } catch (err) {
        console.warn('[Offline] Using cached customers');
        return await offline.getCachedCustomers();
      }
    },
    create: async (customer: CustomerInsert) => {
      if (isDesktop() || !offline.isOnline()) {
        const customers = await offline.getCachedCustomers();
        const newCustomer = {
          ...customer,
          id: customer.id || crypto.randomUUID(),
          created_at: new Date().toISOString()
        } as Customer;
        customers.push(newCustomer);
        await offline.cacheCustomers(customers);
        return newCustomer;
      }

      const { data, error } = await supabase
        .from('customers')
        .insert(customer)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, customer: CustomerUpdate) => {
      if (isDesktop() || !offline.isOnline()) {
        const customers = await offline.getCachedCustomers();
        const index = customers.findIndex((c: any) => c.id === id);
        if (index !== -1) {
          customers[index] = { ...customers[index], ...customer };
          await offline.cacheCustomers(customers);
          return customers[index];
        }
        throw new Error("Customer not found locally");
      }

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
      if (isDesktop() || !offline.isOnline()) {
        const customers = await offline.getCachedCustomers();
        const filtered = customers.filter((c: any) => c.id !== id);
        await offline.cacheCustomers(filtered);
        return;
      }

      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },
  tables: {
    getAll: async () => {
      if (isDesktop() || !offline.isOnline()) {
        return await offline.getCachedTables();
      }

      try {
        const { data, error } = await supabase
          .from('restaurant_tables')
          .select('*')
          .order('table_number');
        if (error) {
          console.warn('[Tables] restaurant_tables query failed:', error.message);
          return [];
        }
        await offline.cacheTables(data ?? []);
        return data ?? [];
      } catch (err) {
        console.warn('[Tables] Failed to fetch restaurant_tables:', err);
        return [];
      }
    },
    create: async (table: { table_number: string; section: string; capacity: number }) => {
      if (isDesktop() || !offline.isOnline()) {
        const tables = await offline.getCachedTables();
        const newTable = {
          ...table,
          id: crypto.randomUUID(),
          status: 'available'
        };
        tables.push(newTable);
        await offline.cacheTables(tables);
        return newTable;
      }

      try {
        const { data, error } = await supabase
          .from('restaurant_tables')
          .insert(table)
          .select()
          .single();
        if (error) {
          throw error;
        }
        return data;
      } catch (err) {
        console.warn('[Tables] restaurant_tables create error, returning virtual table:', err);
        return { ...table, id: crypto.randomUUID(), status: 'available', isVirtual: true };
      }
    },
    bulkCreate: async (newTables: { table_number: string; section: string; capacity: number }[]) => {
      if (isDesktop() || !offline.isOnline()) {
        const tables = await offline.getCachedTables();
        const added = newTables.map(t => ({
          ...t,
          id: crypto.randomUUID(),
          status: 'available'
        }));
        const merged = [...tables, ...added];
        await offline.cacheTables(merged);
        return added;
      }

      try {
        const { data, error } = await supabase
          .from('restaurant_tables')
          .insert(newTables)
          .select();
        if (error) throw error;
        return data ?? [];
      } catch (err) {
        console.warn('[Tables] restaurant_tables bulkCreate error:', err);
        return [];
      }
    },
    updateStatus: async (id: string, status: 'available' | 'occupied' | 'reserved' | 'cleaning') => {
      if (isDesktop() || !offline.isOnline()) {
        const tables = await offline.getCachedTables();
        const index = tables.findIndex((t: any) => t.id === id);
        if (index !== -1) {
          tables[index].status = status;
          await offline.cacheTables(tables);
          return tables[index];
        }
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('restaurant_tables')
          .update({ status })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[Tables] restaurant_tables updateStatus error:', err);
        return null;
      }
    },
    clearReserved: async () => {
      if (isDesktop() || !offline.isOnline()) {
        const tables = await offline.getCachedTables();
        let modified = false;
        for (const t of tables) {
          if (t.status === 'reserved') {
            t.status = 'available';
            modified = true;
          }
        }
        if (modified) {
          await offline.cacheTables(tables);
        }
        return;
      }

      try {
        const { error } = await supabase
          .from('restaurant_tables')
          .update({ status: 'available' })
          .eq('status', 'reserved');
        if (error) console.warn('[Tables] clearReserved failed:', error.message);
      } catch (err) {
        console.warn('[Tables] restaurant_tables clearReserved error:', err);
      }
    },
    delete: async (id: string) => {
      // Always filter out from local cache immediately
      try {
        const cached = await offline.getCachedTables();
        const filtered = cached.filter((t: any) =>
          t.id !== id &&
          t.table_number !== id &&
          String(t.id) !== String(id) &&
          String(t.table_number) !== String(id)
        );
        await offline.cacheTables(filtered);
      } catch (e) {
        console.warn('[Tables] Failed updating local cache on delete:', e);
      }

      if (isDesktop() || !offline.isOnline()) {
        return true;
      }

      try {
        // Delete by ID
        await supabase
          .from('restaurant_tables')
          .delete()
          .eq('id', id);
        
        // Delete by table_number (handles cases where ID passed is table number string)
        await supabase
          .from('restaurant_tables')
          .delete()
          .eq('table_number', id);

        return true;
      } catch (err) {
        console.warn('[Tables] restaurant_tables delete error:', err);
        return false;
      }
    },
    deleteAll: async () => {
      await offline.cacheTables([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pos_offline_tables');
        localStorage.setItem('pos_tables_seeded_v1', 'true');
      }
      try {
        const { error } = await supabase
          .from('restaurant_tables')
          .delete()
          .not('id', 'is', null);

        if (error) {
          console.warn('[Tables] restaurant_tables deleteAll not.is.null failed, retrying with gt:', error.message);
          await supabase
            .from('restaurant_tables')
            .delete()
            .gt('table_number', '');
        }
      } catch (err) {
        console.warn('[Tables] deleteAll catch error:', err);
      }
      return true;
    }
  },
  staff: {
    getAll: async () => {
      if (isDesktop() || !offline.isOnline()) {
        const localUsers = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        return localUsers.map((u: any) => ({
          id: u.id,
          name: u.full_name,
          role: u.role || 'cashier'
        }));
      }

      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
    create: async (staff: { name: string; role?: string }) => {
      if (isDesktop() || !offline.isOnline()) {
        const localUsers = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        const newUser = {
          id: crypto.randomUUID(),
          email: `${staff.name.toLowerCase().replace(/\s+/g, '')}@offline.pos`,
          password: 'password123',
          full_name: staff.name,
          role: staff.role || 'cashier'
        };
        localUsers.push(newUser);
        localStorage.setItem('pos_local_users', JSON.stringify(localUsers));
        return {
          id: newUser.id,
          name: newUser.full_name,
          role: newUser.role
        };
      }

      const { data, error } = await supabase
        .from('staff')
        .insert(staff)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      if (isDesktop() || !offline.isOnline()) {
        const localUsers = JSON.parse(localStorage.getItem('pos_local_users') || '[]');
        const filtered = localUsers.filter((u: any) => u.id !== id);
        localStorage.setItem('pos_local_users', JSON.stringify(filtered));
        return;
      }

      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },
  drivers: {
    getAll: async () => {
      if (isDesktop() || !offline.isOnline()) {
        return await offline.getCachedDrivers();
      }

      const { data, error } = await supabase
        .from('delivery_drivers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
    create: async (driver: { name: string; phone?: string; vehicle_type?: string }) => {
      if (isDesktop() || !offline.isOnline()) {
        const drivers = await offline.getCachedDrivers();
        const newDriver = {
          id: crypto.randomUUID(),
          name: driver.name,
          phone: driver.phone || '0000000000',
          vehicle_type: driver.vehicle_type || 'Bike'
        };
        drivers.push(newDriver);
        await offline.cacheDrivers(drivers);
        return newDriver;
      }

      const { data, error } = await supabase
        .from('delivery_drivers')
        .insert({
          ...driver,
          phone: driver.phone || '0000000000',
          vehicle_type: driver.vehicle_type || 'Bike'
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      if (isDesktop() || !offline.isOnline()) {
        const drivers = await offline.getCachedDrivers();
        const filtered = drivers.filter((d: any) => d.id !== id);
        await offline.cacheDrivers(filtered);
        return;
      }

      const { error } = await supabase
        .from('delivery_drivers')
        .delete()
        .eq('id', id);
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
        .select('*, customers(name, phone), restaurant_tables(table_number)')
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
    getNextDailyId: async (registerId?: string) => {
      const activeShift = shiftService.getCurrentCashierOpenShift();
      const targetRegisterId = registerId || activeShift?.id;

      // Force SQLite for desktop app
      if (isDesktop() && window.electronAPI) {
        const all = await window.electronAPI.getAllOrders();
        let shiftOrders: any[] = [];
        if (targetRegisterId && isValidUUID(targetRegisterId)) {
          shiftOrders = all.filter(o => o.register_id === targetRegisterId);
        } else if (activeShift?.opened_at) {
          shiftOrders = all.filter(o => o.created_at && o.created_at >= activeShift.opened_at);
        } else {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          shiftOrders = all.filter(o => o.created_at && new Date(o.created_at) >= todayStart);
        }
        const maxDailyId = shiftOrders.reduce((max, o) => Math.max(max, Number(o.daily_id) || 0), 0);
        const nextId = Math.max(maxDailyId, offline.getDailyCounter()) + 1;
        offline.setDailyCounter(nextId);
        return nextId;
      }
      
      if (!offline.isOnline()) {
        return offline.incrementDailyCounter();
      }

      let maxDbId = 0;
      const todayStartIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const startTime = activeShift?.opened_at
        ? new Date(activeShift.opened_at).toISOString()
        : todayStartIso;

      try {
        let query = supabase
          .from('orders')
          .select('daily_id')
          .order('daily_id', { ascending: false })
          .limit(1);

        if (targetRegisterId && isValidUUID(targetRegisterId)) {
          query = query.eq('register_id', targetRegisterId);
        } else {
          query = query.gte('created_at', startTime);
        }

        const { data, error } = await Promise.race([
          query,
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);

        if (!error && Array.isArray(data) && data.length > 0 && data[0]?.daily_id) {
          maxDbId = Number(data[0].daily_id) || 0;
        }
      } catch (err) {
        console.warn('Timeout or error fetching highest daily_id:', err);
      }

      const currentOffline = offline.getDailyCounter();
      const nextId = Math.max(maxDbId, currentOffline) + 1;
      localStorage.setItem('pos_daily_counter', nextId.toString());
      return nextId;
    },
    getDailyCount: async (registerId?: string) => {
      const activeShift = shiftService.getCurrentCashierOpenShift();
      const targetRegisterId = registerId || activeShift?.id;

      if (isDesktop() && window.electronAPI) {
        const all = await window.electronAPI.getAllOrders();
        if (targetRegisterId && isValidUUID(targetRegisterId)) {
          return all.filter(o => o.register_id === targetRegisterId).length;
        }
        if (activeShift?.opened_at) {
          return all.filter(o => o.created_at && o.created_at >= activeShift.opened_at).length;
        }
        return offline.getDailyCounter();
      }
      
      if (!offline.isOnline()) {
        return offline.getDailyCounter();
      }

      const todayStartIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const startTime = activeShift?.opened_at
        ? new Date(activeShift.opened_at).toISOString()
        : todayStartIso;

      try {
        let query = supabase
          .from('orders')
          .select('daily_id')
          .order('daily_id', { ascending: false })
          .limit(1);

        if (targetRegisterId && isValidUUID(targetRegisterId)) {
          query = query.eq('register_id', targetRegisterId);
        } else {
          query = query.gte('created_at', startTime);
        }

        const { data, error } = await Promise.race([
          query,
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]);

        if (!error && Array.isArray(data) && data.length > 0 && data[0]?.daily_id) {
          const maxDbId = Number(data[0].daily_id) || 0;
          return Math.max(maxDbId, offline.getDailyCounter());
        }
      } catch (err) {
        console.warn('Timeout or error fetching shift order count, using local sequence');
      }

      return offline.getDailyCounter();
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
          daily_id: queued.order?.daily_id,
          orderNumber: queued.order?.daily_id?.toString().padStart(2, '0')
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
      
      const activeShift = shiftService.getCurrentCashierOpenShift();
      const targetRegisterId = order.register_id || activeShift?.id || null;

      // Ensure daily_id is valid and collision-free
      let dailyId = Number(order.daily_id);
      if (!dailyId || isNaN(dailyId) || dailyId <= 0) {
        try {
          dailyId = await api.orders.getNextDailyId(targetRegisterId || undefined);
        } catch {
          dailyId = offline.incrementDailyCounter();
        }
      } else {
        localStorage.setItem('pos_daily_counter', dailyId.toString());
      }

      // Clean order data to match actual Supabase schema
      const safeOrder: any = {
        total_amount: Number(order.total_amount) || 0,
        status: order.status || 'completed',
        payment_method: order.payment_method || 'cash',
        order_type: order.order_type || 'dine_in',
        register_id: (targetRegisterId && isValidUUID(String(targetRegisterId))) ? String(targetRegisterId) : null,
        daily_id: dailyId,
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
      if (safeOrder.total_amount === undefined || safeOrder.total_amount === null || typeof safeOrder.total_amount !== 'number' || isNaN(safeOrder.total_amount) || safeOrder.total_amount < 0) {
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
          daily_id,
          customer_id,
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

      // Sync local sequence counter when successfully saved to Supabase
      if (safeOrder.daily_id) {
        localStorage.setItem('pos_daily_counter', safeOrder.daily_id.toString());
      }

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

      if (safeOrder.payment_method === 'credit' && safeOrder.customer_id) {
        try {
          const { data: customerData } = await supabase
            .from('customers')
            .select('credit_balance')
            .eq('id', safeOrder.customer_id)
            .single();
            
          const currentBalance = customerData?.credit_balance || 0;
          await supabase
            .from('customers')
            .update({ credit_balance: Number(currentBalance) + Number(safeOrder.total_amount) })
            .eq('id', safeOrder.customer_id);
            
          // Add ledger entry
          await supabase
            .from('ledger_entries')
            .insert({
              entity_type: 'customer',
              customer_id: safeOrder.customer_id,
              type: 'credit',
              amount: Number(safeOrder.total_amount),
              description: `Credit purchase (Order #${safeOrder.daily_id || newOrder.id.substring(0, 8)})`,
              tenant_id: safeOrder.tenant_id || null
            });
        } catch (e) {
          console.error('Failed to update customer credit balance', e);
        }
      }

      // Increment cached count if present
      if (cachedDailyCount && cachedDailyCount.registerId === safeOrder.register_id) {
        cachedDailyCount.count++;
      }

      // Decrement stock if order is created as completed
      if (safeOrder.status === 'completed') {
        try {
          await api.products.decrementStock(items);
        } catch (err) {
          console.error('[Stock] Failed to decrement stock on order creation:', err);
        }
      }

      return {
        ...newOrder,
        daily_id: newOrder.daily_id || safeOrder.daily_id,
        orderNumber: (newOrder.daily_id || safeOrder.daily_id)?.toString().padStart(2, '0')
      };
    },
    update: async (orderId: string, order: any, items: OrderItemInsert[]) => {
      const activeShift = shiftService.getCurrentCashierOpenShift();
      const targetRegisterId = order.register_id || activeShift?.id || null;

      // Clean order data to match actual Supabase schema
      const safeOrder: any = {
        total_amount: Number(order.total_amount) || 0,
        status: order.status || 'pending',
        payment_method: order.payment_method || 'cash',
        order_type: order.order_type || 'dine_in',
        register_id: (targetRegisterId && isValidUUID(String(targetRegisterId))) ? String(targetRegisterId) : null,
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
      if (isDesktop() && window.electronAPI) {
        console.log('[SQLite] Updating order and items locally');
        await window.electronAPI.updateItems(orderId, items, safeOrder.total_amount);
        await window.electronAPI.updateStatus(orderId, safeOrder.status);
        return { 
          id: orderId, 
          status: safeOrder.status,
          total_amount: safeOrder.total_amount,
          daily_id: safeOrder.daily_id || null,
          orderNumber: safeOrder.daily_id ? safeOrder.daily_id.toString().padStart(2, '0') : undefined,
        };
      }

      if (!offline.isOnline()) {
        return enqueueOfflineUpdate();
      }

      // Fetch previous order details before update to verify existence
      let prevOrder: any = null;
      if (isValidUUID(orderId)) {
        try {
          const { data } = await supabase
            .from('orders')
            .select('id, status, payment_method, total_amount, customer_id, tenant_id')
            .eq('id', orderId)
            .maybeSingle();
          prevOrder = data;
        } catch (err) {
          console.warn('Failed to fetch previous order state:', err);
        }
      }

      // If order does not exist in Supabase database, fallback to create
      if (!prevOrder) {
        console.warn(`Order ID ${orderId} does not exist in Supabase DB. Creating order instead.`);
        return api.orders.create(order, items);
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
          daily_id,
          customer_id,
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

      // 1.5 Handle credit purchase updates (update customer credit balance and add ledger entry)
      const isBecomingCreditCompleted = 
        safeOrder.status === 'completed' && 
        safeOrder.payment_method === 'credit' && 
        safeOrder.customer_id && 
        (!prevOrder || prevOrder.status !== 'completed' || prevOrder.payment_method !== 'credit');

      if (isBecomingCreditCompleted) {
        try {
          const { data: customerData } = await supabase
            .from('customers')
            .select('credit_balance')
            .eq('id', safeOrder.customer_id)
            .single();
            
          const currentBalance = customerData?.credit_balance || 0;
          await supabase
            .from('customers')
            .update({ credit_balance: Number(currentBalance) + Number(safeOrder.total_amount) })
            .eq('id', safeOrder.customer_id);
            
          // Add ledger entry
          await supabase
            .from('ledger_entries')
            .insert({
              entity_type: 'customer',
              customer_id: safeOrder.customer_id,
              type: 'credit',
              amount: Number(safeOrder.total_amount),
              description: `Credit purchase (Order #${safeOrder.daily_id || orderId.substring(0, 8)})`,
              tenant_id: prevOrder?.tenant_id || safeOrder.tenant_id || null
            });
        } catch (e) {
          console.error('Failed to update customer credit balance on update:', e);
        }
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

      // Fetch updated order to return daily_id so callers can display correct KOT number
      try {
        const { data: updatedOrder } = await supabase
          .from('orders')
          .select('id, daily_id')
          .eq('id', orderId)
          .maybeSingle();
        if (updatedOrder) {
          return {
            id: orderId,
            daily_id: updatedOrder.daily_id,
            orderNumber: updatedOrder.daily_id
              ? updatedOrder.daily_id.toString().padStart(2, '0')
              : undefined,
          };
        }
      } catch (_) { /* ignore – fall through */ }
      return { id: orderId, daily_id: safeOrder.daily_id || null, orderNumber: safeOrder.daily_id ? safeOrder.daily_id.toString().padStart(2, '0') : undefined };
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
            .in('status', ['pending', 'preparing', 'ready'])
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
      // Helper function to auto-release table if present
      const releaseTableIfPresent = async (tableId?: string | null) => {
        if ((status === 'completed' || status === 'cancelled') && tableId) {
          try {
            await api.tables.updateStatus(tableId, 'available');
          } catch (tErr) {
            console.warn('[Table Auto-Release] Failed to release table:', tErr);
          }
        }
      };

      // Force SQLite for desktop
      if (isDesktop() && window.electronAPI) {
        await window.electronAPI.updateStatus(id, status);
        const records = await window.electronAPI.getAllOrders();
        const target = records.find((r: any) => r.id === id);
        if (target) {
          try {
            const data = JSON.parse(target.data || '{}');
            await releaseTableIfPresent(data.table_id);
          } catch (e) {
            // ignore
          }
        }
        return { id, status };
      }

      // If offline, update the local queue
      if (!offline.isOnline()) {
        const success = offline.updateOrderStatus(id, status);
        const pending = offline.getPendingOrders();
        const found = pending.find(p => p.id === id);
        if (found?.order?.table_id) {
          await releaseTableIfPresent(found.order.table_id);
        }
        if (success) return { id, status, _offline: true };
      }

      try {
        // Fetch current status and table_id before updating
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('status, table_id')
          .eq('id', id)
          .maybeSingle();

        const wasCompleted = existingOrder?.status === 'completed';

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
          console.warn('Network error during status update, falling back to offline update');
          offline.updateOrderStatus(id, status);
          if (existingOrder?.table_id) {
            await releaseTableIfPresent(existingOrder.table_id);
          }
          return { id, status, _offline: true };
        }

        // Auto-release table when order is completed or cancelled
        await releaseTableIfPresent(existingOrder?.table_id || data?.table_id);


        // If transitioning to completed and was not completed before, decrement stock
        if (status === 'completed' && !wasCompleted) {
          try {
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('product_id, product_name, quantity')
              .eq('order_id', id);

            if (orderItems && orderItems.length > 0) {
              await api.products.decrementStock(orderItems);
            }
          } catch (err) {
            console.error('[Stock] Failed to decrement stock during status update:', err);
          }
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
        // Fetch order details and items first before deleting them
        const { data: order } = await supabase
          .from('orders')
          .select('status')
          .eq('id', id)
          .maybeSingle();

        const { data: orderItems } = await supabase
          .from('order_items')
          .select('product_id, quantity')
          .eq('order_id', id);

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

        // If the order was completed, restore/increment stock!
        if (order && order.status === 'completed' && orderItems && orderItems.length > 0) {
          try {
            await api.products.incrementStock(orderItems);
          } catch (err) {
            console.error('[Stock] Failed to restore stock during order deletion:', err);
          }
        }

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

      // Clear local offline queue for pending orders
      offline.clearAllToday();

      if (!offline.isOnline()) return true;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      try {
        // Only target pending/ongoing orders to cancel or clear from running list
        const { data: orders, error: fetchError } = await Promise.race([
          supabase
            .from('orders')
            .select('id')
            .in('status', ['pending', 'preparing', 'ready'])
            .gte('created_at', startOfDay.toISOString()),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);

        if (fetchError) throw fetchError;
        if (!orders || orders.length === 0) return true;

        const orderIds = orders.map(o => o.id);

        // Delete order items for pending orders
        const { error: itemsError } = await Promise.race([
          supabase
            .from('order_items')
            .delete()
            .in('order_id', orderIds),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);

        if (itemsError) throw itemsError;

        // Delete only pending orders
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
  vendors: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('vendors' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      return data as any[];
    },
    create: async (vendor: any) => {
      const { data, error } = await supabase
        .from('vendors' as any)
        .insert(vendor)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, vendor: any) => {
      const { data, error } = await supabase
        .from('vendors' as any)
        .update(vendor)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase
        .from('vendors' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },
  accounts: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('accounts' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      return data as any[];
    },
    create: async (account: any) => {
      const { data, error } = await supabase
        .from('accounts' as any)
        .insert(account)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, account: any) => {
      const { data, error } = await supabase
        .from('accounts' as any)
        .update(account)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase
        .from('accounts' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },
  ledger: {
    getAll: async (entityType?: string, entityId?: string) => {
      let query = supabase
        .from('ledger_entries' as any)
        .select('*, customers(name), vendors(name), accounts(name)')
        .order('date', { ascending: false });
      
      if (entityType) query = query.eq('entity_type', entityType);
      if (entityId) {
        if (entityType === 'customer') query = query.eq('customer_id', entityId);
        if (entityType === 'vendor') query = query.eq('vendor_id', entityId);
        if (entityType === 'account') query = query.eq('account_id', entityId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    create: async (entry: any) => {
      const { data, error } = await supabase
        .from('ledger_entries' as any)
        .insert(entry)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    update: async (id: string, entry: any) => {
      const { data, error } = await supabase
        .from('ledger_entries' as any)
        .update(entry)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    delete: async (id: string) => {
      const { error } = await supabase
        .from('ledger_entries' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
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
