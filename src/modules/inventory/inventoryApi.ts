import { supabase } from '@/integrations/supabase/client';
import { isDesktop } from '@/lib/env';
import * as offline from '@/services/offlineStore';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// TypeScript Interfaces
// ---------------------------------------------------------------------------
export interface InventoryItem {
    id: string;
    name: string;
    sku?: string;
    category: 'raw_material' | 'consumable' | 'packaging';
    unit: string;
    current_stock: number;
    min_stock: number;
    cost_price: number;
    tenant_id?: string | null;
    created_at?: string;
}

export interface InventoryVendor {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    tenant_id?: string | null;
    created_at?: string;
}

export interface InventoryPurchase {
    id: string;
    invoice_number: string;
    vendor_id: string;
    purchase_date: string;
    total_amount: number;
    status: 'Pending' | 'Approved';
    tenant_id?: string | null;
    created_at?: string;
    vendor_name?: string; // hydrated
}

export interface InventoryPurchaseItem {
    id?: string;
    purchase_id: string;
    item_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    tenant_id?: string | null;
    item_name?: string; // hydrated
    item_unit?: string; // hydrated
}

export interface InventoryRecipe {
    id?: string;
    product_id: string;
    item_id: string;
    quantity: number;
    tenant_id?: string | null;
    created_at?: string;
    item_name?: string; // hydrated
    item_unit?: string; // hydrated
}

export interface InventoryAdjustment {
    id: string;
    item_id: string;
    type: 'manual_adjustment' | 'waste' | 'expired' | 'transfer' | 'sale_deduction' | 'purchase_addition';
    quantity: number;
    reason?: string;
    created_by?: string;
    tenant_id?: string | null;
    created_at?: string;
    item_name?: string; // hydrated
    item_unit?: string; // hydrated
}

// ---------------------------------------------------------------------------
// Fallback & Offline State
// ---------------------------------------------------------------------------
const TABLE_OK: Record<string, boolean> = {
    inventory_items: true,
    inventory_vendors: true,
    inventory_purchases: true,
    inventory_purchase_items: true,
    inventory_recipes: true,
    inventory_adjustments: true,
};

const LOCAL_STORAGE_SESSION_KEY = 'pos_inventory_tables_missing';

const loadPersistedFlags = () => {
    try {
        const raw = sessionStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        if (raw) {
            const missing: string[] = JSON.parse(raw);
            missing.forEach(t => { TABLE_OK[t] = false; });
        }
    } catch { /* ignore */ }
};
loadPersistedFlags();

const markTableMissing = (tableName: string) => {
    if (TABLE_OK[tableName] === false) return;
    TABLE_OK[tableName] = false;

    try {
        const raw = sessionStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        const existing: string[] = raw ? JSON.parse(raw) : [];
        if (!existing.includes(tableName)) {
            existing.push(tableName);
            sessionStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(existing));
        }
    } catch { /* ignore */ }

    console.warn(`[Inventory] Table "${tableName}" missing — using local storage fallback.`);
};

const markAllTablesMissing = () => {
    Object.keys(TABLE_OK).forEach(markTableMissing);
    toast.warning('Inventory database tables not set up yet.', {
        description: 'Running in offline/local storage mode. Run the SQL setup migration to enable cloud sync.',
        duration: 8000,
        id: 'inventory-tables-missing',
    });
};

export const probeInventorySchema = async (): Promise<boolean> => {
    if (isDesktop() || !offline.isOnline()) return false;
    try {
        const { error } = await supabase
            .from('inventory_items' as any)
            .select('id')
            .limit(0);

        if (error) {
            markAllTablesMissing();
            return false;
        }

        Object.keys(TABLE_OK).forEach(t => { TABLE_OK[t] = true; });
        try { sessionStorage.removeItem(LOCAL_STORAGE_SESSION_KEY); } catch { /* ignore */ }
        return true;
    } catch {
        markAllTablesMissing();
        return false;
    }
};

const isSchemaMissing = (error: any): boolean => {
    if (!error) return false;
    const status = Number(error.status ?? 0);
    const code = String(error.code ?? '');
    const msg = String(error.message ?? error.details ?? '').toLowerCase();
    return (
        status === 404 ||
        status === 400 ||
        code === '42P01' ||
        code === '42703' ||
        code === 'PGRST116' ||
        code === 'PGRST200' ||
        code === 'PGRST204' ||
        msg.includes('not found') ||
        msg.includes('could not find') ||
        msg.includes('does not exist') ||
        msg.includes('schema cache') ||
        msg.includes('relation') ||
        msg.includes('column')
    );
};

const useLocal = (tableName: string): boolean =>
    isDesktop() || !offline.isOnline() || TABLE_OK[tableName] === false;

// ---------------------------------------------------------------------------
// Local Storage Helper Keys
// ---------------------------------------------------------------------------
const LOCAL_KEYS = {
    ITEMS: 'pos_local_inventory_items',
    VENDORS: 'pos_local_inventory_vendors',
    PURCHASES: 'pos_local_inventory_purchases',
    PURCHASE_ITEMS: 'pos_local_inventory_purchase_items',
    RECIPES: 'pos_local_inventory_recipes',
    ADJUSTMENTS: 'pos_local_inventory_adjustments',
};

const getLocalData = <T>(key: string): T[] => {
    try {
        return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
        return [];
    }
};

const setLocalData = <T>(key: string, data: T[]) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to set localStorage key', key, e);
    }
};

// ---------------------------------------------------------------------------
// Core Inventory Service Controller
// ---------------------------------------------------------------------------
export const inventoryApi = {
    items: {
        getAll: async (tenantId?: string): Promise<InventoryItem[]> => {
            if (useLocal('inventory_items')) {
                return getLocalData<InventoryItem>(LOCAL_KEYS.ITEMS);
            }
            try {
                let q = supabase.from('inventory_items').select('*');
                if (tenantId) q = q.eq('tenant_id', tenantId);
                const { data, error } = await q.order('name');
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_items'); return getLocalData<InventoryItem>(LOCAL_KEYS.ITEMS); }
                    throw error;
                }
                return data as InventoryItem[];
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_items'); return getLocalData<InventoryItem>(LOCAL_KEYS.ITEMS); }
                throw err;
            }
        },

        create: async (item: Omit<InventoryItem, 'id' | 'created_at'>): Promise<InventoryItem> => {
            if (useLocal('inventory_items')) {
                const list = getLocalData<InventoryItem>(LOCAL_KEYS.ITEMS);
                const newItem: InventoryItem = {
                    ...item,
                    id: crypto.randomUUID(),
                    created_at: new Date().toISOString()
                };
                list.push(newItem);
                setLocalData(LOCAL_KEYS.ITEMS, list);
                return newItem;
            }
            try {
                const { data, error } = await supabase.from('inventory_items').insert(item).select().single();
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_items'); return inventoryApi.items.create(item); }
                    throw error;
                }
                return data as InventoryItem;
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_items'); return inventoryApi.items.create(item); }
                throw err;
            }
        },

        update: async (id: string, itemData: Partial<InventoryItem>): Promise<InventoryItem> => {
            if (useLocal('inventory_items')) {
                const list = getLocalData<InventoryItem>(LOCAL_KEYS.ITEMS);
                const index = list.findIndex(i => i.id === id);
                if (index === -1) throw new Error('Inventory item not found');
                list[index] = { ...list[index], ...itemData };
                setLocalData(LOCAL_KEYS.ITEMS, list);
                return list[index];
            }
            try {
                const { data, error } = await supabase.from('inventory_items').update(itemData).eq('id', id).select().single();
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_items'); return inventoryApi.items.update(id, itemData); }
                    throw error;
                }
                return data as InventoryItem;
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_items'); return inventoryApi.items.update(id, itemData); }
                throw err;
            }
        },

        delete: async (id: string): Promise<void> => {
            if (useLocal('inventory_items')) {
                const list = getLocalData<InventoryItem>(LOCAL_KEYS.ITEMS);
                setLocalData(LOCAL_KEYS.ITEMS, list.filter(i => i.id !== id));
                return;
            }
            try {
                const { error } = await supabase.from('inventory_items').delete().eq('id', id);
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_items'); return inventoryApi.items.delete(id); }
                    throw error;
                }
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_items'); return inventoryApi.items.delete(id); }
                throw err;
            }
        },

        adjustStock: async (adjustment: Omit<InventoryAdjustment, 'id' | 'created_at'>): Promise<InventoryAdjustment> => {
            const qtyChange = Number(adjustment.quantity);
            
            // 1. Update the item's current stock
            const item = await inventoryApi.items.updateStockQuantity(adjustment.item_id, qtyChange);

            // 2. Log the adjustment
            if (useLocal('inventory_adjustments')) {
                const list = getLocalData<InventoryAdjustment>(LOCAL_KEYS.ADJUSTMENTS);
                const newAdj: InventoryAdjustment = {
                    ...adjustment,
                    id: crypto.randomUUID(),
                    created_at: new Date().toISOString(),
                    item_name: item.name,
                    item_unit: item.unit
                };
                list.push(newAdj);
                setLocalData(LOCAL_KEYS.ADJUSTMENTS, list);
                return newAdj;
            }
            try {
                const { data, error } = await supabase.from('inventory_adjustments').insert(adjustment).select().single();
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_adjustments'); return inventoryApi.items.adjustStock(adjustment); }
                    throw error;
                }
                return data as InventoryAdjustment;
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_adjustments'); return inventoryApi.items.adjustStock(adjustment); }
                throw err;
            }
        },

        updateStockQuantity: async (itemId: string, qtyChange: number): Promise<InventoryItem> => {
            const items = await inventoryApi.items.getAll();
            const target = items.find(i => i.id === itemId);
            if (!target) throw new Error('Inventory item not found');
            const newQty = Math.max(0, target.current_stock + qtyChange);
            return await inventoryApi.items.update(itemId, { current_stock: newQty });
        }
    },

    vendors: {
        getAll: async (tenantId?: string): Promise<InventoryVendor[]> => {
            if (useLocal('inventory_vendors')) {
                return getLocalData<InventoryVendor>(LOCAL_KEYS.VENDORS);
            }
            try {
                let q = supabase.from('inventory_vendors').select('*');
                if (tenantId) q = q.eq('tenant_id', tenantId);
                const { data, error } = await q.order('name');
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_vendors'); return getLocalData<InventoryVendor>(LOCAL_KEYS.VENDORS); }
                    throw error;
                }
                return data as InventoryVendor[];
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_vendors'); return getLocalData<InventoryVendor>(LOCAL_KEYS.VENDORS); }
                throw err;
            }
        },

        create: async (vendor: Omit<InventoryVendor, 'id' | 'created_at'>): Promise<InventoryVendor> => {
            if (useLocal('inventory_vendors')) {
                const list = getLocalData<InventoryVendor>(LOCAL_KEYS.VENDORS);
                const newVendor: InventoryVendor = {
                    ...vendor,
                    id: crypto.randomUUID(),
                    created_at: new Date().toISOString()
                };
                list.push(newVendor);
                setLocalData(LOCAL_KEYS.VENDORS, list);
                return newVendor;
            }
            try {
                const { data, error } = await supabase.from('inventory_vendors').insert(vendor).select().single();
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_vendors'); return inventoryApi.vendors.create(vendor); }
                    throw error;
                }
                return data as InventoryVendor;
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_vendors'); return inventoryApi.vendors.create(vendor); }
                throw err;
            }
        },

        update: async (id: string, vendorData: Partial<InventoryVendor>): Promise<InventoryVendor> => {
            if (useLocal('inventory_vendors')) {
                const list = getLocalData<InventoryVendor>(LOCAL_KEYS.VENDORS);
                const index = list.findIndex(v => v.id === id);
                if (index === -1) throw new Error('Vendor not found');
                list[index] = { ...list[index], ...vendorData };
                setLocalData(LOCAL_KEYS.VENDORS, list);
                return list[index];
            }
            try {
                const { data, error } = await supabase.from('inventory_vendors').update(vendorData).eq('id', id).select().single();
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_vendors'); return inventoryApi.vendors.update(id, vendorData); }
                    throw error;
                }
                return data as InventoryVendor;
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_vendors'); return inventoryApi.vendors.update(id, vendorData); }
                throw err;
            }
        },

        delete: async (id: string): Promise<void> => {
            if (useLocal('inventory_vendors')) {
                const list = getLocalData<InventoryVendor>(LOCAL_KEYS.VENDORS);
                setLocalData(LOCAL_KEYS.VENDORS, list.filter(v => v.id !== id));
                return;
            }
            try {
                const { error } = await supabase.from('inventory_vendors').delete().eq('id', id);
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_vendors'); return inventoryApi.vendors.delete(id); }
                    throw error;
                }
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_vendors'); return inventoryApi.vendors.delete(id); }
                throw err;
            }
        }
    },

    purchases: {
        getAll: async (tenantId?: string): Promise<InventoryPurchase[]> => {
            const localVendors = getLocalData<InventoryVendor>(LOCAL_KEYS.VENDORS);
            const getLocal = () => {
                const purchases = getLocalData<InventoryPurchase>(LOCAL_KEYS.PURCHASES);
                return purchases.map(p => {
                    const v = localVendors.find(vend => vend.id === p.vendor_id);
                    return { ...p, vendor_name: v?.name || 'Unknown Vendor' };
                });
            };

            if (useLocal('inventory_purchases')) return getLocal();

            try {
                let q = supabase.from('inventory_purchases').select('*, vendor:vendor_id(name)');
                if (tenantId) q = q.eq('tenant_id', tenantId);
                const { data, error } = await q.order('created_at', { ascending: false });
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_purchases'); return getLocal(); }
                    throw error;
                }
                return (data ?? []).map((p: any) => ({
                    id: p.id,
                    invoice_number: p.invoice_number,
                    vendor_id: p.vendor_id,
                    purchase_date: p.purchase_date,
                    total_amount: Number(p.total_amount),
                    status: p.status,
                    tenant_id: p.tenant_id,
                    created_at: p.created_at,
                    vendor_name: p.vendor?.name || 'Unknown Vendor'
                }));
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_purchases'); return getLocal(); }
                throw err;
            }
        },

        getItems: async (purchaseId: string): Promise<InventoryPurchaseItem[]> => {
            const localItems = getLocalData<InventoryItem>(LOCAL_KEYS.ITEMS);
            const getLocal = () => {
                const list = getLocalData<InventoryPurchaseItem>(LOCAL_KEYS.PURCHASE_ITEMS);
                return list.filter(pi => pi.purchase_id === purchaseId).map(pi => {
                    const item = localItems.find(i => i.id === pi.item_id);
                    return { ...pi, item_name: item?.name || 'Unknown Item', item_unit: item?.unit || '' };
                });
            };

            if (useLocal('inventory_purchase_items')) return getLocal();

            try {
                const { data, error } = await supabase
                    .from('inventory_purchase_items')
                    .select('*, item:item_id(name, unit)')
                    .eq('purchase_id', purchaseId);

                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_purchase_items'); return getLocal(); }
                    throw error;
                }

                return (data ?? []).map((pi: any) => ({
                    id: pi.id,
                    purchase_id: pi.purchase_id,
                    item_id: pi.item_id,
                    quantity: Number(pi.quantity),
                    unit_price: Number(pi.unit_price),
                    total_price: Number(pi.total_price),
                    tenant_id: pi.tenant_id,
                    item_name: pi.item?.name || 'Unknown Item',
                    item_unit: pi.item?.unit || ''
                }));
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_purchase_items'); return getLocal(); }
                throw err;
            }
        },

        create: async (
            purchase: Omit<InventoryPurchase, 'id' | 'created_at' | 'status'>,
            purchaseItems: Array<Omit<InventoryPurchaseItem, 'purchase_id'>>
        ): Promise<InventoryPurchase> => {
            if (useLocal('inventory_purchases')) {
                const pList = getLocalData<InventoryPurchase>(LOCAL_KEYS.PURCHASES);
                const piList = getLocalData<InventoryPurchaseItem>(LOCAL_KEYS.PURCHASE_ITEMS);
                
                const pId = crypto.randomUUID();
                const newPurchase: InventoryPurchase = {
                    ...purchase,
                    id: pId,
                    status: 'Pending',
                    created_at: new Date().toISOString()
                };

                const newPurchaseItems = purchaseItems.map(item => ({
                    ...item,
                    purchase_id: pId,
                    id: crypto.randomUUID()
                }));

                pList.push(newPurchase);
                piList.push(...newPurchaseItems);
                
                setLocalData(LOCAL_KEYS.PURCHASES, pList);
                setLocalData(LOCAL_KEYS.PURCHASE_ITEMS, piList);

                return newPurchase;
            }

            try {
                // 1. Insert invoice header
                const { data: newP, error: pErr } = await supabase
                    .from('inventory_purchases')
                    .insert({ ...purchase, status: 'Pending' })
                    .select()
                    .single();

                if (pErr) throw pErr;

                // 2. Insert items
                const itemsToInsert = purchaseItems.map(item => ({
                    ...item,
                    purchase_id: newP.id,
                    tenant_id: purchase.tenant_id
                }));

                const { error: itemsErr } = await supabase
                    .from('inventory_purchase_items')
                    .insert(itemsToInsert);

                if (itemsErr) throw itemsErr;

                return newP as InventoryPurchase;
            } catch (err: any) {
                if (isSchemaMissing(err)) {
                    markTableMissing('inventory_purchases');
                    return inventoryApi.purchases.create(purchase, purchaseItems);
                }
                throw err;
            }
        },

        approve: async (purchaseId: string, createdBy?: string): Promise<void> => {
            // 1. Fetch purchase invoice details
            const purchases = await inventoryApi.purchases.getAll();
            const target = purchases.find(p => p.id === purchaseId);
            if (!target) throw new Error('Purchase invoice not found');
            if (target.status === 'Approved') throw new Error('Purchase is already approved');

            const purchaseItems = await inventoryApi.purchases.getItems(purchaseId);

            // 2. Process WAC Stock Valuation & Increment stock for each item
            for (const pItem of purchaseItems) {
                const item = await inventoryApi.items.updateStockQuantity(pItem.item_id, 0); // Fetch latest item state
                const currentQty = Number(item.current_stock);
                const currentCost = Number(item.cost_price);
                const newQty = currentQty + pItem.quantity;

                // Weighted Average Cost (WAC) formula
                let newWacCost = pItem.unit_price;
                if (newQty > 0) {
                    newWacCost = ((currentQty * currentCost) + (pItem.quantity * pItem.unit_price)) / newQty;
                }
                newWacCost = Math.round(newWacCost * 100) / 100; // Round to 2 decimals

                // Update inventory item current_stock & cost_price
                await inventoryApi.items.update(pItem.item_id, {
                    current_stock: newQty,
                    cost_price: newWacCost
                });

                // Log adjustment transaction
                await inventoryApi.items.adjustStock({
                    item_id: pItem.item_id,
                    type: 'purchase_addition',
                    quantity: pItem.quantity,
                    reason: `Purchase addition (Invoice #${target.invoice_number})`,
                    created_by: createdBy || 'System',
                    tenant_id: target.tenant_id
                });
            }

            // 3. Mark invoice as Approved
            if (useLocal('inventory_purchases')) {
                const pList = getLocalData<InventoryPurchase>(LOCAL_KEYS.PURCHASES);
                const idx = pList.findIndex(p => p.id === purchaseId);
                if (idx !== -1) {
                    pList[idx].status = 'Approved';
                    setLocalData(LOCAL_KEYS.PURCHASES, pList);
                }
                return;
            }

            try {
                const { error } = await supabase
                    .from('inventory_purchases')
                    .update({ status: 'Approved' })
                    .eq('id', purchaseId);

                if (error) throw error;
            } catch (err: any) {
                if (isSchemaMissing(err)) {
                    markTableMissing('inventory_purchases');
                    // Retry under local Storage mode
                    const pList = getLocalData<InventoryPurchase>(LOCAL_KEYS.PURCHASES);
                    const idx = pList.findIndex(p => p.id === purchaseId);
                    if (idx !== -1) {
                        pList[idx].status = 'Approved';
                        setLocalData(LOCAL_KEYS.PURCHASES, pList);
                    }
                    return;
                }
                throw err;
            }
        }
    },

    recipes: {
        getAll: async (tenantId?: string): Promise<InventoryRecipe[]> => {
            const localItems = getLocalData<InventoryItem>(LOCAL_KEYS.ITEMS);
            const getLocal = () => {
                const recipes = getLocalData<InventoryRecipe>(LOCAL_KEYS.RECIPES);
                return recipes.map(r => {
                    const item = localItems.find(i => i.id === r.item_id);
                    return { ...r, item_name: item?.name || 'Unknown Item', item_unit: item?.unit || '' };
                });
            };

            if (useLocal('inventory_recipes')) return getLocal();

            try {
                let q = supabase.from('inventory_recipes').select('*, item:item_id(name, unit)');
                if (tenantId) q = q.eq('tenant_id', tenantId);
                const { data, error } = await q;
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_recipes'); return getLocal(); }
                    throw error;
                }
                return (data ?? []).map((r: any) => ({
                    id: r.id,
                    product_id: r.product_id,
                    item_id: r.item_id,
                    quantity: Number(r.quantity),
                    tenant_id: r.tenant_id,
                    created_at: r.created_at,
                    item_name: r.item?.name || 'Unknown Item',
                    item_unit: r.item?.unit || ''
                }));
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_recipes'); return getLocal(); }
                throw err;
            }
        },

        saveRecipeItems: async (productId: string, ingredients: Array<{ item_id: string; quantity: number }>, tenantId?: string): Promise<void> => {
            if (useLocal('inventory_recipes')) {
                const list = getLocalData<InventoryRecipe>(LOCAL_KEYS.RECIPES);
                const rest = list.filter(r => r.product_id !== productId);
                const newItems = ingredients.map(ing => ({
                    product_id: productId,
                    item_id: ing.item_id,
                    quantity: ing.quantity,
                    tenant_id: tenantId || null
                }));
                setLocalData(LOCAL_KEYS.RECIPES, [...rest, ...newItems]);
                return;
            }

            try {
                // Delete existing mappings
                const { error: delErr } = await supabase
                    .from('inventory_recipes')
                    .delete()
                    .eq('product_id', productId);

                if (delErr) throw delErr;

                if (ingredients.length === 0) return;

                // Insert new mappings
                const records = ingredients.map(ing => ({
                    product_id: productId,
                    item_id: ing.item_id,
                    quantity: ing.quantity,
                    tenant_id: tenantId
                }));

                const { error: insErr } = await supabase
                    .from('inventory_recipes')
                    .insert(records);

                if (insErr) throw insErr;
            } catch (err: any) {
                if (isSchemaMissing(err)) {
                    markTableMissing('inventory_recipes');
                    return inventoryApi.recipes.saveRecipeItems(productId, ingredients, tenantId);
                }
                throw err;
            }
        }
    },

    adjustments: {
        getAll: async (tenantId?: string): Promise<InventoryAdjustment[]> => {
            const localItems = getLocalData<InventoryItem>(LOCAL_KEYS.ITEMS);
            const getLocal = () => {
                const adjustments = getLocalData<InventoryAdjustment>(LOCAL_KEYS.ADJUSTMENTS);
                return adjustments.map(a => {
                    const item = localItems.find(i => i.id === a.item_id);
                    return { ...a, item_name: item?.name || 'Unknown Item', item_unit: item?.unit || '' };
                });
            };

            if (useLocal('inventory_adjustments')) return getLocal();

            try {
                let q = supabase.from('inventory_adjustments').select('*, item:item_id(name, unit)');
                if (tenantId) q = q.eq('tenant_id', tenantId);
                const { data, error } = await q.order('created_at', { ascending: false });
                if (error) {
                    if (isSchemaMissing(error)) { markTableMissing('inventory_adjustments'); return getLocal(); }
                    throw error;
                }
                return (data ?? []).map((a: any) => ({
                    id: a.id,
                    item_id: a.item_id,
                    type: a.type,
                    quantity: Number(a.quantity),
                    reason: a.reason,
                    created_by: a.created_by,
                    tenant_id: a.tenant_id,
                    created_at: a.created_at,
                    item_name: a.item?.name || 'Unknown Item',
                    item_unit: a.item?.unit || ''
                }));
            } catch (err: any) {
                if (isSchemaMissing(err)) { markTableMissing('inventory_adjustments'); return getLocal(); }
                throw err;
            }
        }
    },

    reports: {
        getStockAlerts: async (): Promise<InventoryItem[]> => {
            const items = await inventoryApi.items.getAll();
            return items.filter(i => i.current_stock <= i.min_stock);
        },

        getValuation: async (): Promise<{ totalItems: number; totalValue: number }> => {
            const items = await inventoryApi.items.getAll();
            let totalValue = 0;
            items.forEach(i => {
                totalValue += i.current_stock * i.cost_price;
            });
            return {
                totalItems: items.length,
                totalValue: Math.round(totalValue * 100) / 100
            };
        }
    }
};

// ---------------------------------------------------------------------------
// POS Checkout Integration Hook
// ---------------------------------------------------------------------------
export const deductIngredientsForSoldProducts = async (
    orderItems: Array<{ product_id: string | null | undefined; quantity: number }>
): Promise<void> => {
    try {
        console.log('[Inventory Hook] Triggering ingredient deductions for orderItems:', orderItems);
        
        // 1. Fetch recipes mapped to the products sold
        const recipes = await inventoryApi.recipes.getAll();
        const itemsToDeduct: Array<{ item_id: string; totalQty: number; product_id: string }> = [];

        for (const oItem of orderItems) {
            if (!oItem.product_id) continue;
            
            // Get recipes for this product
            const productRecipes = recipes.filter(r => r.product_id === oItem.product_id);
            for (const rec of productRecipes) {
                const deductionQty = rec.quantity * oItem.quantity;
                itemsToDeduct.push({
                    item_id: rec.item_id,
                    totalQty: deductionQty,
                    product_id: oItem.product_id
                });
            }
        }

        if (itemsToDeduct.length === 0) return;

        // 2. Perform stock deductions and adjustment logs
        for (const deduct of itemsToDeduct) {
            try {
                // Log adjustment transaction (negative quantity for sale deduction)
                await inventoryApi.items.adjustStock({
                    item_id: deduct.item_id,
                    type: 'sale_deduction',
                    quantity: -deduct.totalQty,
                    reason: `Sales deduction (Product ID: ${deduct.product_id})`,
                    created_by: 'POS Cashier'
                });
            } catch (err) {
                console.error(`[Inventory Hook] Failed to deduct item ${deduct.item_id}:`, err);
            }
        }

        console.log('[Inventory Hook] Successfully completed ingredient deductions.');
    } catch (err) {
        console.error('[Inventory Hook] Global deduction process failed:', err);
    }
};
