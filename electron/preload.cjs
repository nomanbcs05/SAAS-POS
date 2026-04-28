const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Orders
  saveOrder: (order, items) => ipcRenderer.invoke('db:save-order', order, items),
  getUnsyncedOrders: () => ipcRenderer.invoke('db:get-unsynced-orders'),
  markAsSynced: (id) => ipcRenderer.invoke('db:mark-synced', id),
  updateStatus: (id, status) => ipcRenderer.invoke('db:update-status', id, status),
  updateItems: (id, items, total) => ipcRenderer.invoke('db:update-items', id, items, total),
  getAllOrders: () => ipcRenderer.invoke('db:get-all-orders'),
  getOrderById: (id) => ipcRenderer.invoke('db:get-order-by-id', id),
  deleteOrder: (id) => ipcRenderer.invoke('db:delete-order', id),

  // Products
  cacheProducts: (products) => ipcRenderer.invoke('db:cache-products', products),
  getCachedProducts: () => ipcRenderer.invoke('db:get-cached-products'),

  // Environment info
  isDesktop: true,
  appVersion: process.env.npm_package_version
});
