const CACHE_KEYS = {
  CATEGORIES: 'pos_offline_categories',
  PRODUCTS: 'pos_offline_products',
  CUSTOMERS: 'pos_offline_customers',
  PENDING_ORDERS: 'pos_offline_orders',
  LAST_SYNC: 'pos_last_sync',
  SESSION: 'pos_offline_session',
  PROFILE: 'pos_offline_profile',
  TENANT: 'pos_offline_tenant'
};

export const isOnline = () => navigator.onLine;

// Categories
export const cacheCategories = (categories: any[]) => {
  localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories));
};

export const getCachedCategories = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEYS.CATEGORIES) || '[]');
  } catch {
    return [];
  }
};

// Products
export const cacheProducts = (products: any[]) => {
  localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(products));
};

export const getCachedProducts = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEYS.PRODUCTS) || '[]');
  } catch {
    return [];
  }
};

// Customers
export const cacheCustomers = (customers: any[]) => {
  localStorage.setItem(CACHE_KEYS.CUSTOMERS, JSON.stringify(customers));
};

export const getCachedCustomers = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEYS.CUSTOMERS) || '[]');
  } catch {
    return [];
  }
};

// Orders Queue
export interface PendingOrder {
  id: string;
  order: any;
  items: any[];
  createdAt: string;
  synced: boolean;
}

export const queueOrder = (order: any, items: any[]) => {
  const pending = getPendingOrders();
  const newOrder: PendingOrder = {
    id: crypto.randomUUID(),
    order,
    items,
    createdAt: new Date().toISOString(),
    synced: false
  };
  pending.push(newOrder);
  localStorage.setItem(CACHE_KEYS.PENDING_ORDERS, JSON.stringify(pending));
  return newOrder;
};

export const getPendingOrders = (): PendingOrder[] => {
  try {
    const data = localStorage.getItem(CACHE_KEYS.PENDING_ORDERS);
    return data ? JSON.parse(data).filter((o: PendingOrder) => !o.synced) : [];
  } catch {
    return [];
  }
};

export const markOrderSynced = (id: string) => {
  try {
    let pending = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_ORDERS) || '[]');
    pending = pending.map((o: PendingOrder) => o.id === id ? { ...o, synced: true } : o);
    localStorage.setItem(CACHE_KEYS.PENDING_ORDERS, JSON.stringify(pending));
  } catch (err) {
    console.error('Error marking order synced', err);
  }
};

export const clearSyncedOrders = () => {
  try {
    let pending = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_ORDERS) || '[]');
    pending = pending.filter((o: PendingOrder) => !o.synced);
    localStorage.setItem(CACHE_KEYS.PENDING_ORDERS, JSON.stringify(pending));
  } catch (err) {
    console.error('Error clearing synced orders', err);
  }
};

export const setLastSync = () => {
  localStorage.setItem(CACHE_KEYS.LAST_SYNC, new Date().toISOString());
};

// Session
export const cacheSession = (session: any) => {
  if (session) {
    localStorage.setItem(CACHE_KEYS.SESSION, JSON.stringify(session));
  } else {
    localStorage.removeItem(CACHE_KEYS.SESSION);
  }
};

export const getCachedSession = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEYS.SESSION) || 'null');
  } catch {
    return null;
  }
};

// Profile
export const cacheProfile = (profile: any) => {
  if (profile) {
    localStorage.setItem(CACHE_KEYS.PROFILE, JSON.stringify(profile));
  } else {
    localStorage.removeItem(CACHE_KEYS.PROFILE);
  }
};

export const getCachedProfile = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEYS.PROFILE) || 'null');
  } catch {
    return null;
  }
};

// Tenant
export const cacheTenant = (tenant: any) => {
  if (tenant) {
    localStorage.setItem(CACHE_KEYS.TENANT, JSON.stringify(tenant));
  } else {
    localStorage.removeItem(CACHE_KEYS.TENANT);
  }
};

export const getCachedTenant = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEYS.TENANT) || 'null');
  } catch {
    return null;
  }
};
