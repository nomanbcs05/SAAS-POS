import { supabase } from '@/integrations/supabase/client';
import { isOnline } from './offlineStore';
import { inventoryApi, InventoryItem } from '@/modules/inventory/inventoryApi';

export interface SaleIngredientBreakdown {
  id?: string;
  sale_id: string;
  order_id?: string;
  ingredient_id: string;
  ingredient_name: string;
  qty_deducted: number;
  unit: string;
  tenant_id?: string | null;
  created_at?: string;
}

const LOCAL_BREAKDOWN_KEY = 'pos_sale_ingredient_breakdown';

const getLocalBreakdowns = (): SaleIngredientBreakdown[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_BREAKDOWN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalBreakdowns = (items: SaleIngredientBreakdown[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_BREAKDOWN_KEY, JSON.stringify(items));
};

export const inventoryConversionService = {
  /**
   * Process ingredient deduction by conversion rate for a completed sale.
   * For each product with linked_ingredient_id:
   * ingredient.stock = ingredient.stock - (product.quantity * product.deduction_qty)
   * Saves records in sale_ingredient_breakdown.
   */
  processSaleDeduction: async (
    saleId: string,
    orderItems: Array<{
      product_id?: string | null;
      quantity: number;
      product?: any;
      name?: string;
      product_name?: string;
    }>,
    tenantId?: string | null
  ): Promise<SaleIngredientBreakdown[]> => {
    if (!orderItems || orderItems.length === 0) return [];

    try {
      // 1. Fetch inventory items (ingredients)
      const allIngredients = await inventoryApi.items.getAll(tenantId || undefined);

      // 2. Fetch product details if not already present on items
      const productIdsToFetch = orderItems
        .filter(item => item.product_id && (!item.product || item.product.linked_ingredient_id === undefined))
        .map(item => item.product_id as string);

      let fetchedProductsMap = new Map<string, any>();
      if (productIdsToFetch.length > 0) {
        try {
          const { data: dbProducts } = await supabase
            .from('products')
            .select('id, name, linked_ingredient_id, deduction_qty')
            .in('id', productIdsToFetch);
          
          if (dbProducts) {
            dbProducts.forEach(p => fetchedProductsMap.set(p.id, p));
          }
        } catch (err) {
          console.warn('[InventoryConversion] Could not fetch products from DB, checking local cache:', err);
        }
      }

      // Map to aggregate deductions by ingredient_id
      const deductionsByIngredient = new Map<string, {
        ingredient: InventoryItem;
        totalQty: number;
      }>();

      for (const oItem of orderItems) {
        const soldQty = Number(oItem.quantity) || 1;
        const prod = oItem.product || (oItem.product_id ? fetchedProductsMap.get(oItem.product_id) : null);

        const linkedId = prod?.linked_ingredient_id;
        const deductionRate = prod?.deduction_qty != null ? Number(prod.deduction_qty) : null;

        // If product has linked_ingredient_id and deduction_qty > 0
        if (linkedId && deductionRate && deductionRate > 0) {
          const ingredient = allIngredients.find(ing => ing.id === linkedId);
          if (ingredient) {
            const deductAmount = soldQty * deductionRate;
            const existing = deductionsByIngredient.get(linkedId);
            if (existing) {
              existing.totalQty += deductAmount;
            } else {
              deductionsByIngredient.set(linkedId, {
                ingredient,
                totalQty: deductAmount
              });
            }
          }
        }
      }

      if (deductionsByIngredient.size === 0) {
        return [];
      }

      const breakdowns: SaleIngredientBreakdown[] = [];
      const now = new Date().toISOString();

      // 3. Deduct stock and prepare breakdown entries
      for (const [ingredientId, { ingredient, totalQty }] of deductionsByIngredient.entries()) {
        const roundedQty = Math.round(totalQty * 10000) / 10000;
        if (roundedQty <= 0) continue;

        const breakdownEntry: SaleIngredientBreakdown = {
          id: crypto.randomUUID ? crypto.randomUUID() : 'sib_' + Date.now() + Math.random().toString(36).substring(2),
          sale_id: saleId,
          order_id: saleId,
          ingredient_id: ingredientId,
          ingredient_name: ingredient.name,
          qty_deducted: roundedQty,
          unit: ingredient.unit || 'kg',
          tenant_id: tenantId || null,
          created_at: now
        };
        breakdowns.push(breakdownEntry);

        // Deduct from stock: ingredient.stock = ingredient.stock - (product.quantity * product.deduction_qty)
        try {
          await inventoryApi.adjustments.create({
            item_id: ingredientId,
            type: 'sale_deduction',
            quantity: -roundedQty,
            reason: `POS Sale auto-deduction (Order #${saleId.substring(0, 8)})`,
            created_by: 'POS Conversion Engine',
            tenant_id: tenantId || null
          });
        } catch (err) {
          console.warn(`[InventoryConversion] Failed to adjust stock for ${ingredient.name}:`, err);
        }
      }

      // 4. Save to local storage cache for offline / immediate print retrieval
      const existingLocal = getLocalBreakdowns();
      saveLocalBreakdowns([...existingLocal.filter(b => b.sale_id !== saleId), ...breakdowns]);

      // 5. Save to Supabase table sale_ingredient_breakdown
      if (isOnline()) {
        try {
          await supabase.from('sale_ingredient_breakdown' as any).insert(breakdowns);
        } catch (dbErr) {
          console.warn('[InventoryConversion] Could not sync to sale_ingredient_breakdown table:', dbErr);
        }
      }

      return breakdowns;
    } catch (err) {
      console.error('[InventoryConversion] Error processing sale deduction:', err);
      return [];
    }
  },

  /**
   * Fetch saved ingredient breakdown for an order/sale.
   */
  getBreakdownForSale: async (saleId: string): Promise<SaleIngredientBreakdown[]> => {
    if (!saleId) return [];

    // Check local cache first
    const local = getLocalBreakdowns().filter(b => b.sale_id === saleId || b.order_id === saleId);
    if (local.length > 0) {
      return local;
    }

    // Try fetching from Supabase
    if (isOnline()) {
      try {
        const { data, error } = await supabase
          .from('sale_ingredient_breakdown' as any)
          .select('*')
          .or(`sale_id.eq.${saleId},order_id.eq.${saleId}`);

        if (!error && data && data.length > 0) {
          return data as SaleIngredientBreakdown[];
        }
      } catch (err) {
        console.warn('[InventoryConversion] Cloud fetch breakdown error:', err);
      }
    }

    return [];
  }
};
