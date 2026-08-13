const CACHE_KEYS = {
  CATEGORIES: 'pos_offline_categories',
  PRODUCTS: 'pos_offline_products',
  CUSTOMERS: 'pos_offline_customers',
  PENDING_ORDERS: 'pos_offline_orders',
  LAST_SYNC: 'pos_last_sync',
  SESSION: 'pos_offline_session',
  PROFILE: 'pos_offline_profile',
  TENANT: 'pos_offline_tenant',
  DAILY_COUNTER: 'pos_daily_counter',
  PENDING_UPDATES: 'pos_offline_updates',
  PENDING_DELETIONS: 'pos_offline_deletions'
};

export const isOnline = () => {
  if (typeof navigator === 'undefined') return false;
  // If running in Desktop app, force offline mode to run everything locally
  if (typeof window !== 'undefined' && window.electronAPI) {
    return false;
  }
  return navigator.onLine;
};

// Categories
export const cacheCategories = async (categories: any[]) => {
  if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.setItem === 'function') {
    await window.electronAPI.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories));
  } else {
    localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories));
  }
};

export const getCachedCategories = async () => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.getItem === 'function') {
      const val = await window.electronAPI.getItem(CACHE_KEYS.CATEGORIES);
      return JSON.parse(val || '[]');
    }
    return JSON.parse(localStorage.getItem(CACHE_KEYS.CATEGORIES) || '[]');
  } catch {
    return [];
  }
};

// Products
export const cacheProducts = async (products: any[]) => {
  if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.setItem === 'function') {
    await window.electronAPI.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(products));
  } else {
    localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(products));
  }
};

export const getCachedProducts = async () => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.getItem === 'function') {
      const val = await window.electronAPI.getItem(CACHE_KEYS.PRODUCTS);
      return JSON.parse(val || '[]');
    }
    return JSON.parse(localStorage.getItem(CACHE_KEYS.PRODUCTS) || '[]');
  } catch {
    return [];
  }
};

// Customers
export const cacheCustomers = async (customers: any[]) => {
  if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.setItem === 'function') {
    await window.electronAPI.setItem(CACHE_KEYS.CUSTOMERS, JSON.stringify(customers));
  } else {
    localStorage.setItem(CACHE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }
};

export const getCachedCustomers = async () => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.getItem === 'function') {
      const val = await window.electronAPI.getItem(CACHE_KEYS.CUSTOMERS);
      return JSON.parse(val || '[]');
    }
    return JSON.parse(localStorage.getItem(CACHE_KEYS.CUSTOMERS) || '[]');
  } catch {
    return [];
  }
};

// Tables
export const cacheTables = async (tables: any[]) => {
  if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.setItem === 'function') {
    await window.electronAPI.setItem('pos_offline_tables', JSON.stringify(tables));
  } else {
    localStorage.setItem('pos_offline_tables', JSON.stringify(tables));
  }
};

export const getCachedTables = async () => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.getItem === 'function') {
      const val = await window.electronAPI.getItem('pos_offline_tables');
      return JSON.parse(val || '[]');
    }
    return JSON.parse(localStorage.getItem('pos_offline_tables') || '[]');
  } catch {
    return [];
  }
};

// Drivers
export const cacheDrivers = async (drivers: any[]) => {
  if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.setItem === 'function') {
    await window.electronAPI.setItem('pos_offline_drivers', JSON.stringify(drivers));
  } else {
    localStorage.setItem('pos_offline_drivers', JSON.stringify(drivers));
  }
};

export const getCachedDrivers = async () => {
  try {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.getItem === 'function') {
      const val = await window.electronAPI.getItem('pos_offline_drivers');
      return JSON.parse(val || '[]');
    }
    return JSON.parse(localStorage.getItem('pos_offline_drivers') || '[]');
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

export const queueOrder = (order: any, items: any[], existingId?: string) => {
  const pending = getPendingOrders();
  
  // If updating an existing offline order
  if (existingId) {
    const index = pending.findIndex(o => o.id === existingId);
    if (index !== -1) {
      pending[index] = {
        ...pending[index],
        order: { ...order, daily_id: pending[index].order?.daily_id },
        items,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(CACHE_KEYS.PENDING_ORDERS, JSON.stringify(pending));
      return pending[index];
    }
  }

  const nextCount = incrementDailyCounter();
  const newOrder: PendingOrder = {
    id: existingId || crypto.randomUUID(),
    order: { ...order, daily_id: nextCount }, // Attach daily ID for printing
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

export const queueUpdate = (id: string, update: { status?: string; items?: any[]; total_amount?: number }) => {
  try {
    // 1. Check if it's an offline order
    let pending = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_ORDERS) || '[]');
    const isOfflineOrder = pending.some((o: PendingOrder) => o.id === id);
    
    if (isOfflineOrder) {
      pending = pending.map((o: PendingOrder) => {
        if (o.id === id) {
          const newOrder = { ...o.order };
          if (update.status) newOrder.status = update.status;
          if (update.total_amount !== undefined) newOrder.total_amount = update.total_amount;
          
          return {
            ...o,
            order: newOrder,
            items: update.items || o.items
          };
        }
        return o;
      });
      localStorage.setItem(CACHE_KEYS.PENDING_ORDERS, JSON.stringify(pending));
      return true;
    }

    // 2. If it's an online order, queue the update
    let updates = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_UPDATES) || '{}');
    updates[id] = {
      ...(updates[id] || {}),
      ...update,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(CACHE_KEYS.PENDING_UPDATES, JSON.stringify(updates));
    return true;
  } catch (err) {
    console.error('Error queuing update', err);
    return false;
  }
};

export const updateOrderStatus = (id: string, status: string) => {
  return queueUpdate(id, { status });
};

export const getPendingUpdates = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_UPDATES) || '{}');
  } catch (err) {
    console.error('Error getting pending updates', err);
    return {};
  }
};

export const clearPendingUpdate = (id: string) => {
  try {
    const updates = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_UPDATES) || '{}');
    delete updates[id];
    localStorage.setItem(CACHE_KEYS.PENDING_UPDATES, JSON.stringify(updates));
  } catch (err) {
    console.error('Error clearing pending update', err);
  }
};

export const deleteOrder = (id: string) => {
  try {
    // 1. Check if it's an offline order
    let pending = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_ORDERS) || '[]');
    const isOfflineOrder = pending.some((o: PendingOrder) => o.id === id);

    if (isOfflineOrder) {
      pending = pending.filter((o: PendingOrder) => o.id !== id);
      localStorage.setItem(CACHE_KEYS.PENDING_ORDERS, JSON.stringify(pending));
      return true;
    }

    // 2. If it's an online order, queue the deletion
    let deletions = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_DELETIONS) || '[]');
    if (!deletions.includes(id)) {
      deletions.push(id);
      localStorage.setItem(CACHE_KEYS.PENDING_DELETIONS, JSON.stringify(deletions));
    }
    return true;
  } catch (err) {
    console.error('Error deleting order', err);
    return false;
  }
};

export const getPendingDeletions = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_DELETIONS) || '[]');
  } catch (err) {
    console.error('Error getting pending deletions', err);
    return [];
  }
};

export const clearPendingDeletion = (id: string) => {
  try {
    let deletions = JSON.parse(localStorage.getItem(CACHE_KEYS.PENDING_DELETIONS) || '[]');
    deletions = deletions.filter((did: string) => did !== id);
    localStorage.setItem(CACHE_KEYS.PENDING_DELETIONS, JSON.stringify(deletions));
  } catch (err) {
    console.error('Error clearing pending deletion', err);
  }
};

export const clearAllToday = () => {
  try {
    localStorage.setItem(CACHE_KEYS.PENDING_ORDERS, '[]');
    localStorage.setItem(CACHE_KEYS.PENDING_UPDATES, '{}');
    localStorage.setItem(CACHE_KEYS.PENDING_DELETIONS, '[]');
    return true;
  } catch (err) {
    console.error('Error clearing all today offline', err);
    return false;
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

// Daily Counter
export const getDailyCounter = () => {
  const stored = localStorage.getItem(CACHE_KEYS.DAILY_COUNTER);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Support old format { date, count } but ignore the date check
      if (parsed && typeof parsed.count === 'number') {
        return parsed.count;
      }
    } catch {
      // It's a plain number string
      return parseInt(stored, 10) || 0;
    }
  }
  return 0;
};

export const resetDailyCounter = () => {
  localStorage.setItem(CACHE_KEYS.DAILY_COUNTER, '0');
  return 0;
};

export const incrementDailyCounter = () => {
  const current = getDailyCounter();
  const next = current + 1;
  // Just store the plain number
  localStorage.setItem(CACHE_KEYS.DAILY_COUNTER, next.toString());
  return next;
};

