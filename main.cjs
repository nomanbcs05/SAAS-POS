const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./electron/db.cjs');

app.commandLine.appendSwitch('kiosk-printing');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public/app-icon.jpg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron/preload.cjs')
    }
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173'); // Vite default
  }
}

// IPC Handlers for Database
ipcMain.handle('db:save-order', async (event, order, items) => db.saveOrder(order, items));
ipcMain.handle('db:get-unsynced-orders', async () => db.getUnsyncedOrders());
ipcMain.handle('db:mark-synced', async (event, id) => db.markAsSynced(id));
ipcMain.handle('db:update-status', async (event, id, status) => db.updateOrderStatus(id, status));
ipcMain.handle('db:update-items', async (event, id, items, total) => db.updateOrderItems(id, items, total));
ipcMain.handle('db:get-all-orders', async () => db.getAllOrders());
ipcMain.handle('db:get-order-by-id', async (event, id) => db.getOrderById(id));
ipcMain.handle('db:delete-order', async (event, id) => db.deleteOrder(id));
ipcMain.handle('db:cache-products', async (event, products) => db.cacheProducts(products));
ipcMain.handle('db:get-cached-products', async () => db.getCachedProducts());

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
