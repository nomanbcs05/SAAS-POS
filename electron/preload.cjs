const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Orders
  saveOrder: (order, items) => ipcRenderer.invoke('db:save-order', order, items),
  getUnsyncedOrders: () => ipcRenderer.invoke('db:get-unsynced-orders'),
  markAsSynced: (id) => ipcRenderer.invoke('db:mark-synced', id),
  updateStatus: (id, status) => ipcRenderer.invoke('db:update-status', id, status),
  updateItems: (id, items, total, serverName) => ipcRenderer.invoke('db:update-items', id, items, total, serverName),
  getAllOrders: () => ipcRenderer.invoke('db:get-all-orders'),
  getOrderById: (id) => ipcRenderer.invoke('db:get-order-by-id', id),
  deleteOrder: (id) => ipcRenderer.invoke('db:delete-order', id),

  // Products
  cacheProducts: (products) => ipcRenderer.invoke('db:cache-products', products),
  getCachedProducts: () => ipcRenderer.invoke('db:get-cached-products'),

  // Key-value cache store
  getItem: (key) => ipcRenderer.invoke('db:get-item', key),
  setItem: (key, value) => ipcRenderer.invoke('db:set-item', key, value),
  removeItem: (key) => ipcRenderer.invoke('db:remove-item', key),
  clearAllToday: () => ipcRenderer.invoke('db:clear-all-today'),

  // Environment info
  isDesktop: true,
  appVersion: process.env.npm_package_version
});
