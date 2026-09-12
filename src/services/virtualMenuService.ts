/**
 * virtualMenuService.ts
 *
 * Single source of truth for the POS Virtual Menu.
 * Both Admin and Cashier read from the SAME virtual menu.
 * Admin manages (adds/edits/removes) categories and items.
 * Cashier POS reads and displays only what is configured here.
 *
 * Storage: localStorage keyed by tenant_id + realtime event broadcasts
 * for live updates without page reload.
 */

export interface VirtualMenuItem {
  id: string;
  name: string;
  price: number;
  sizes?: Record<string, number>;
  image?: string;
  productId?: string | null; // reference to master products table
  category?: string;
}

export interface VirtualMenuCategory {
  id: string;
  key: string;       // localStorage key: pos_menu_${key}
  name: string;
  iconName: string;
  visible: boolean;  // Admin toggle: true = visible on POS, false = hidden
  sortOrder: number;
  items?: VirtualMenuItem[];
}

const VM_CATEGORIES_KEY_PREFIX = 'pos_vm_categories_';
const VM_ITEMS_KEY_PREFIX = 'pos_vm_items_';
const UPDATE_EVENT = 'pos-virtual-menu-updated';

/** Default POS Virtual Menu categories (restaurant package) */
const DEFAULT_CATEGORIES: Omit<VirtualMenuCategory, 'items'>[] = [
  { id: 'karahi',           key: 'pos_menu_karahi',           name: 'Karahi',            iconName: 'Flame',       visible: true, sortOrder: 9 },
  { id: 'barbq',            key: 'pos_menu_barbq_menu',       name: 'Bar.B.Q',           iconName: 'Flame',       visible: true, sortOrder: 8 },
  { id: 'handi',            key: 'pos_menu_handi',            name: 'Handi',             iconName: 'ChefHat',     visible: true, sortOrder: 7 },
  { id: 'side_items',       key: 'pos_menu_side_items',       name: 'Side Items',        iconName: 'Package',     visible: true, sortOrder: 6 },
  { id: 'salad_raita',      key: 'pos_menu_salad_raita',      name: 'Salad & Raita',     iconName: 'Utensils',    visible: true, sortOrder: 5 },
  { id: 'chinese',          key: 'pos_menu_chinese',          name: 'Chinese',           iconName: 'Utensils',    visible: true, sortOrder: 4 },
  { id: 'beverages_menu',   key: 'pos_menu_beverages_menu',   name: 'Beverages',         iconName: 'Coffee',      visible: true, sortOrder: 3 },
  { id: 'ice_cream_drinks', key: 'pos_menu_ice_cream_drinks', name: 'Ice Cream & Drinks',iconName: 'Coffee',      visible: true, sortOrder: 2 },
  { id: 'tandoor_bread',    key: 'pos_menu_tandoor_bread',    name: 'Tandoor / Bread',   iconName: 'Layers',      visible: true, sortOrder: 1 },
];

function categoriesStorageKey(tenantId: string) {
  return `${VM_CATEGORIES_KEY_PREFIX}${tenantId}`;
}

function itemsStorageKey(tenantId: string, categoryId: string) {
  return `${VM_ITEMS_KEY_PREFIX}${tenantId}_${categoryId}`;
}

function broadcastUpdate() {
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

/**
 * Get all virtual menu categories for a tenant.
 * Merges saved custom categories with defaults.
 */
export function getVirtualMenuCategories(tenantId: string): VirtualMenuCategory[] {
  if (!tenantId) return [];
  try {
    const raw = localStorage.getItem(categoriesStorageKey(tenantId));
    if (raw) {
      const parsed: VirtualMenuCategory[] = JSON.parse(raw);
      // Ensure new defaults are merged if not already present
      const existingIds = new Set(parsed.map(c => c.id));
      DEFAULT_CATEGORIES.forEach(def => {
        if (!existingIds.has(def.id)) {
          parsed.push({ ...def });
        }
      });
      return parsed.sort((a, b) => b.sortOrder - a.sortOrder);
    }
  } catch {
    // fallback to defaults
  }
  // First load: initialize with defaults
  const defaultCats = DEFAULT_CATEGORIES.map(d => ({ ...d }));
  saveVirtualMenuCategories(tenantId, defaultCats);
  return defaultCats;
}

/**
 * Get only the visible categories (Admin toggles these on/off).
 */
export function getVisibleCategories(tenantId: string): VirtualMenuCategory[] {
  return getVirtualMenuCategories(tenantId).filter(c => c.visible);
}

/**
 * Save the full categories list.
 */
export function saveVirtualMenuCategories(tenantId: string, categories: VirtualMenuCategory[]) {
  if (!tenantId) return;
  localStorage.setItem(categoriesStorageKey(tenantId), JSON.stringify(categories));
  broadcastUpdate();
}

/**
 * Toggle a category's visibility.
 */
export function toggleCategoryVisibility(tenantId: string, categoryId: string): void {
  const cats = getVirtualMenuCategories(tenantId);
  const idx = cats.findIndex(c => c.id === categoryId);
  if (idx >= 0) {
    cats[idx].visible = !cats[idx].visible;
    saveVirtualMenuCategories(tenantId, cats);
  }
}

/**
 * Add a new custom category.
 */
export function addVirtualMenuCategory(tenantId: string, name: string, iconName = 'Package'): VirtualMenuCategory {
  const cats = getVirtualMenuCategories(tenantId);
  const id = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now();
  const key = 'pos_menu_' + id;
  const newCat: VirtualMenuCategory = {
    id,
    key,
    name,
    iconName,
    visible: true,
    sortOrder: Math.max(...cats.map(c => c.sortOrder), 0) + 1,
  };
  cats.unshift(newCat);
  saveVirtualMenuCategories(tenantId, cats);
  return newCat;
}

/**
 * Remove a category.
 */
export function removeVirtualMenuCategory(tenantId: string, categoryId: string): void {
  const cats = getVirtualMenuCategories(tenantId).filter(c => c.id !== categoryId);
  // also clean up items
  localStorage.removeItem(itemsStorageKey(tenantId, categoryId));
  saveVirtualMenuCategories(tenantId, cats);
}

/**
 * Get items for a category.
 */
export function getVirtualMenuItems(tenantId: string, categoryId: string): VirtualMenuItem[] {
  if (!tenantId || !categoryId) return [];
  try {
    // Check tenant-scoped key first (new format)
    const tenantRaw = localStorage.getItem(itemsStorageKey(tenantId, categoryId));
    if (tenantRaw) {
      return JSON.parse(tenantRaw);
    }
    // Fallback: legacy key (e.g. pos_menu_karahi)
    const cats = getVirtualMenuCategories(tenantId);
    const cat = cats.find(c => c.id === categoryId);
    if (cat?.key) {
      const legacyRaw = localStorage.getItem(cat.key);
      if (legacyRaw) {
        const items = JSON.parse(legacyRaw);
        // Migrate to new format
        saveVirtualMenuItems(tenantId, categoryId, items);
        return items;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Save items for a category.
 */
export function saveVirtualMenuItems(tenantId: string, categoryId: string, items: VirtualMenuItem[]): void {
  if (!tenantId || !categoryId) return;
  localStorage.setItem(itemsStorageKey(tenantId, categoryId), JSON.stringify(items));
  broadcastUpdate();
}

/**
 * Add an item to a category.
 */
export function addItemToCategory(tenantId: string, categoryId: string, item: Omit<VirtualMenuItem, 'id'>): VirtualMenuItem {
  const items = getVirtualMenuItems(tenantId, categoryId);
  const newItem: VirtualMenuItem = { ...item, id: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2) };
  items.push(newItem);
  saveVirtualMenuItems(tenantId, categoryId, items);
  return newItem;
}

/**
 * Update an item in a category.
 */
export function updateItemInCategory(tenantId: string, categoryId: string, itemId: string, updates: Partial<VirtualMenuItem>): void {
  const items = getVirtualMenuItems(tenantId, categoryId);
  const idx = items.findIndex(i => i.id === itemId);
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...updates };
    saveVirtualMenuItems(tenantId, categoryId, items);
  }
}

/**
 * Remove an item from a category.
 */
export function removeItemFromCategory(tenantId: string, categoryId: string, itemId: string): void {
  const items = getVirtualMenuItems(tenantId, categoryId).filter(i => i.id !== itemId);
  saveVirtualMenuItems(tenantId, categoryId, items);
}

/**
 * Get all virtual menu data for POS rendering:
 * Returns an array of visible categories with their items.
 */
export function getPosVirtualMenu(tenantId: string): VirtualMenuCategory[] {
  if (!tenantId) return [];
  const cats = getVisibleCategories(tenantId);
  return cats.map(cat => ({
    ...cat,
    items: getVirtualMenuItems(tenantId, cat.id),
  }));
}

/**
 * Subscribe to Virtual Menu updates.
 * Returns unsubscribe function.
 */
export function onVirtualMenuUpdate(callback: () => void): () => void {
  window.addEventListener(UPDATE_EVENT, callback);
  return () => window.removeEventListener(UPDATE_EVENT, callback);
}

/**
 * Initialize virtual menu defaults for a tenant (first-time setup).
 * Imports items from legacy restaurantMenuData localStorage if found.
 */
export function initVirtualMenuForTenant(tenantId: string): void {
  if (!tenantId) return;
  const cats = getVirtualMenuCategories(tenantId);
  // Categories already initialized by getVirtualMenuCategories
  // Now ensure items are migrated from legacy keys
  cats.forEach(cat => {
    const tenantKey = itemsStorageKey(tenantId, cat.id);
    if (!localStorage.getItem(tenantKey) && cat.key) {
      const legacyRaw = localStorage.getItem(cat.key);
      if (legacyRaw) {
        localStorage.setItem(tenantKey, legacyRaw);
      }
    }
  });
}
