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
ipcMain.handle('db:update-items', async (event, id, items, total, serverName) => db.updateOrderItems(id, items, total, serverName));
ipcMain.handle('db:get-all-orders', async () => db.getAllOrders());
ipcMain.handle('db:get-order-by-id', async (event, id) => db.getOrderById(id));
ipcMain.handle('db:delete-order', async (event, id) => db.deleteOrder(id));
ipcMain.handle('db:cache-products', async (event, products) => db.cacheProducts(products));
ipcMain.handle('db:get-cached-products', async () => db.getCachedProducts());
ipcMain.handle('db:get-item', async (event, key) => db.getItem(key));
ipcMain.handle('db:set-item', async (event, key, value) => db.setItem(key, value));
ipcMain.handle('db:remove-item', async (event, key) => db.removeItem(key));
ipcMain.handle('db:clear-all-today', async () => db.clearAllOrders());

// ─── PRINTER DISCOVERY & TARGETED PRINTING IPC ─────────────────────────────
ipcMain.handle('printer:get-list', async () => {
  try {
    const wins = BrowserWindow.getAllWindows();
    const targetWin = wins[0];
    if (!targetWin || !targetWin.webContents) {
      return [];
    }
    const printers = await targetWin.webContents.getPrintersAsync();
    return (printers || []).map(p => ({
      name: p.name,
      displayName: p.displayName || p.name,
      description: p.description || '',
      status: typeof p.status === 'number' ? p.status : 0,
      isDefault: Boolean(p.isDefault)
    }));
  } catch (err) {
    console.error('[Electron Printer Discovery Error]:', err && err.message ? err.message : err);
    return [];
  }
});

ipcMain.handle('printer:print-targeted', async (event, request) => {
  const req = request || {};
  const jobId = typeof req.jobId === 'string' ? req.jobId : 'unknown_job';
  const rawDeviceName = typeof req.deviceName === 'string' ? req.deviceName.trim() : '';
  const html = typeof req.html === 'string' ? req.html : '';

  // Log minimal metadata
  console.log(`[Print IPC] Job requested: id=${jobId}, printer="${rawDeviceName}"`);

  // 1. Validation
  if (!rawDeviceName) {
    console.warn(`[Print IPC] Validation failed: Empty deviceName for job ${jobId}`);
    return {
      success: false,
      jobId,
      printerName: '',
      error: {
        code: 'EMPTY_DEVICE_NAME',
        message: 'Target printer deviceName must be a non-empty string.'
      }
    };
  }

  if (!html || !html.trim()) {
    console.warn(`[Print IPC] Validation failed: Empty HTML payload for job ${jobId}`);
    return {
      success: false,
      jobId,
      printerName: rawDeviceName,
      error: {
        code: 'EMPTY_HTML',
        message: 'Print HTML payload must be a non-empty string.'
      }
    };
  }

  if (html.length > 2 * 1024 * 1024) {
    console.warn(`[Print IPC] Validation failed: HTML payload exceeds limit for job ${jobId}`);
    return {
      success: false,
      jobId,
      printerName: rawDeviceName,
      error: {
        code: 'HTML_TOO_LARGE',
        message: 'Print HTML payload exceeds 2MB maximum size limit.'
      }
    };
  }

  // 2. Validate device exists in installed Windows printers
  const wins = BrowserWindow.getAllWindows();
  const mainWin = wins[0];
  let installedPrinters = [];
  if (mainWin && mainWin.webContents) {
    try {
      installedPrinters = await mainWin.webContents.getPrintersAsync();
    } catch (err) {
      console.warn(`[Print IPC] Could not query printers async:`, err && err.message ? err.message : err);
    }
  }

  const matchedPrinter = (installedPrinters || []).find(
    p => p.name.toLowerCase() === rawDeviceName.toLowerCase() ||
         (p.displayName && p.displayName.toLowerCase() === rawDeviceName.toLowerCase())
  );

  if (installedPrinters.length > 0 && !matchedPrinter) {
    console.warn(`[Print IPC] Printer not found: "${rawDeviceName}" for job ${jobId}`);
    return {
      success: false,
      jobId,
      printerName: rawDeviceName,
      error: {
        code: 'PRINTER_NOT_FOUND',
        message: `Printer "${rawDeviceName}" was not found in installed operating system printers.`
      }
    };
  }

  const effectivePrinterName = matchedPrinter ? matchedPrinter.name : rawDeviceName;

  // 3. Isolated Print Execution
  return new Promise((resolve) => {
    let printWin = null;
    let isSettled = false;

    const cleanup = () => {
      if (printWin && !printWin.isDestroyed()) {
        try {
          printWin.destroy();
        } catch (_) {}
      }
      printWin = null;
    };

    const finish = (result) => {
      if (!isSettled) {
        isSettled = true;
        cleanup();
        if (result.success) {
          console.log(`[Print IPC] Print success: job=${result.jobId}, printer="${result.printerName}"`);
        } else {
          console.error(`[Print IPC] Print failed: job=${result.jobId}, printer="${result.printerName}", error=${result.error ? result.error.message : 'Unknown'}`);
        }
        resolve(result);
      }
    };

    // Safety timeout (15 seconds)
    const timeout = setTimeout(() => {
      finish({
        success: false,
        jobId,
        printerName: effectivePrinterName,
        error: {
          code: 'PRINT_TIMEOUT',
          message: `Print operation timed out after 15 seconds for printer "${effectivePrinterName}".`
        }
      });
    }, 15000);

    try {
      printWin = new BrowserWindow({
        show: false,
        width: 350,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          javascript: false, // Security: Disable JS execution inside print container
          webSecurity: true
        }
      });

      printWin.webContents.on('did-finish-load', () => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: effectivePrinterName,
            margins: { marginType: 'none' }
          },
          (success, failureReason) => {
            clearTimeout(timeout);
            if (success) {
              finish({
                success: true,
                jobId,
                printerName: effectivePrinterName,
                error: null
              });
            } else {
              finish({
                success: false,
                jobId,
                printerName: effectivePrinterName,
                error: {
                  code: 'PRINT_FAILED',
                  message: failureReason || 'Physical printer print job failed or was cancelled by spooler.'
                }
              });
            }
          }
        );
      });

      printWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        clearTimeout(timeout);
        finish({
          success: false,
          jobId,
          printerName: effectivePrinterName,
          error: {
            code: 'LOAD_FAILED',
            message: `Failed to load print HTML payload: ${errorDescription} (${errorCode})`
          }
        });
      });

      // Load HTML securely via data URI
      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    } catch (err) {
      clearTimeout(timeout);
      finish({
        success: false,
        jobId,
        printerName: effectivePrinterName,
        error: {
          code: 'INIT_FAILED',
          message: err && err.message ? err.message : 'Failed to initialize isolated print window'
        }
      });
    }
  });
});

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
