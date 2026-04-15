/**
 * Offline Storage & Sync Queue
 * 
 * Caches data locally so the POS works without internet.
 * Queues orders created offline and syncs them when connectivity returns.
 */

const KEYS = {
  PRODUCTS: 'offline_cache_products',
  CATEGORIES: 'offline_cache_categories',
  CUSTOMERS: 'offline_cache_customers',
  TENANT: 'offline_cache_tenant',
  PROFILE: 'offline_cache_profile',
  SESSION: 'offline_cache_session',
  ORDER_QUEUE: 'offline_order_queue',
  REGISTER: 'offline_cache_register',
  LAST_SYNC: 'offline_last_sync',
};

export interface QueuedOrder {
  id: string; // local UUID
  order: any;
  items: any[];
  createdAt: string;
  synced: boolean;
}

// ---------- Generic helpers ----------

function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setJSON(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('offlineStore: localStorage full or unavailable', e);
  }
}

// ---------- Online detection ----------

export function isOnline(): boolean {
  return navigator.onLine;
}

// ---------- Products ----------

export function cacheProducts(products: any[]) {
  setJSON(KEYS.PRODUCTS, products);
}

export function getCachedProducts(): any[] {
  return getJSON<any[]>(KEYS.PRODUCTS, []);
}

// ---------- Categories ----------

export function cacheCategories(categories: any[]) {
  setJSON(KEYS.CATEGORIES, categories);
}

export function getCachedCategories(): any[] {
  return getJSON<any[]>(KEYS.CATEGORIES, []);
}

// ---------- Customers ----------

export function cacheCustomers(customers: any[]) {
  setJSON(KEYS.CUSTOMERS, customers);
}

export function getCachedCustomers(): any[] {
  return getJSON<any[]>(KEYS.CUSTOMERS, []);
}

// ---------- Tenant / Profile / Session ----------

export function cacheTenant(tenant: any) {
  setJSON(KEYS.TENANT, tenant);
}

export function getCachedTenant(): any | null {
  return getJSON<any>(KEYS.TENANT, null);
}

export function cacheProfile(profile: any) {
  setJSON(KEYS.PROFILE, profile);
}

export function getCachedProfile(): any | null {
  return getJSON<any>(KEYS.PROFILE, null);
}

export function cacheSession(session: any) {
  // Only cache the pieces we need for ProtectedRoute (avoid storing tokens)
  if (session) {
    setJSON(KEYS.SESSION, {
      user: { id: session.user?.id, email: session.user?.email },
      _cached: true,
    });
  }
}

export function getCachedSession(): any | null {
  return getJSON<any>(KEYS.SESSION, null);
}

// ---------- Register ----------

export function cacheRegister(register: any) {
  setJSON(KEYS.REGISTER, register);
}

export function getCachedRegister(): any | null {
  return getJSON<any>(KEYS.REGISTER, null);
}

// ---------- Order Queue ----------

function generateLocalId(): string {
  return 'offline-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

export function queueOrder(order: any, items: any[]): QueuedOrder {
  const queue = getJSON<QueuedOrder[]>(KEYS.ORDER_QUEUE, []);
  const entry: QueuedOrder = {
    id: generateLocalId(),
    order,
    items,
    createdAt: new Date().toISOString(),
    synced: false,
  };
  queue.push(entry);
  setJSON(KEYS.ORDER_QUEUE, queue);
  return entry;
}

export function getPendingOrders(): QueuedOrder[] {
  return getJSON<QueuedOrder[]>(KEYS.ORDER_QUEUE, []).filter(o => !o.synced);
}

export function markOrderSynced(localId: string) {
  const queue = getJSON<QueuedOrder[]>(KEYS.ORDER_QUEUE, []);
  const idx = queue.findIndex(o => o.id === localId);
  if (idx !== -1) {
    queue[idx].synced = true;
    setJSON(KEYS.ORDER_QUEUE, queue);
  }
}

export function clearSyncedOrders() {
  const queue = getJSON<QueuedOrder[]>(KEYS.ORDER_QUEUE, []);
  setJSON(KEYS.ORDER_QUEUE, queue.filter(o => !o.synced));
}

// ---------- Sync timestamp ----------

export function setLastSync() {
  localStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
}

export function getLastSync(): string | null {
  return localStorage.getItem(KEYS.LAST_SYNC);
}
