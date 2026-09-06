import {
  shouldUseMultiPrinterKOT,
  executeMultiPrinterKOTFlow,
  mapCartItemsToPrintable,
  buildKOTOrderContext,
} from '../kotCartIntegration';
import { TenantPrinter, PrinterCategoryRoute } from '@/types/printer';
import { ElectronPrintingAPI } from '../kotPrintDispatcher';
import { TargetedPrintRequest, TargetedPrintResult } from '@/types/electronPrinting';

// ─── TEST FIXTURES ────────────────────────────────────────────────────────────

const MOCK_TENANT_ENABLED = {
  id: 'tenant_101',
  multi_printer_kot_enabled: true,
};

const MOCK_TENANT_DISABLED = {
  id: 'tenant_101',
  multi_printer_kot_enabled: false,
};

const MOCK_DEFAULT_PRINTER: TenantPrinter = {
  id: 'printer_default',
  tenant_id: 'tenant_101',
  name: 'Default Windows Printer',
  printer_type: 'system',
  device_name: 'POS-80 Default',
  is_default: true,
  is_active: true,
};

const MOCK_KITCHEN_PRINTER: TenantPrinter = {
  id: 'printer_kitchen',
  tenant_id: 'tenant_101',
  name: 'Kitchen Station Printer',
  printer_type: 'usb',
  device_name: 'POS-80 Kitchen',
  is_default: false,
  is_active: true,
};

const MOCK_BAR_PRINTER: TenantPrinter = {
  id: 'printer_bar',
  tenant_id: 'tenant_101',
  name: 'Bar Station Printer',
  printer_type: 'network',
  device_name: 'POS-80 Bar',
  is_default: false,
  is_active: true,
};

const MOCK_ROUTES: PrinterCategoryRoute[] = [
  {
    id: 'route_1',
    tenant_id: 'tenant_101',
    category_name: 'karahi',
    printer_id: 'printer_kitchen',
  },
  {
    id: 'route_2',
    tenant_id: 'tenant_101',
    category_name: 'beverages',
    printer_id: 'printer_bar',
  },
];

const MOCK_ELECTRON_API: ElectronPrintingAPI = {
  printTargeted: async (req: TargetedPrintRequest): Promise<TargetedPrintResult> => ({
    success: true,
    jobId: req.jobId,
    printerName: req.deviceName,
    error: null,
  }),
};

export async function runCartIntegrationTests(): Promise<
  { name: string; passed: boolean; details?: string }[]
> {
  const results: { name: string; passed: boolean; details?: string }[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    results.push({ name, passed: condition, details });
    if (!condition) {
      console.error(`❌ TEST FAILED: ${name}`, details);
    } else {
      console.log(`✅ TEST PASSED: ${name}`);
    }
  }

  // TEST 1: Feature flag OFF -> shouldUseMultiPrinterKOT returns false
  {
    const canUse = shouldUseMultiPrinterKOT({
      tenant: MOCK_TENANT_DISABLED,
      printers: [MOCK_DEFAULT_PRINTER],
      routes: [],
      isDesktopEnv: true,
      electronApi: MOCK_ELECTRON_API,
    });
    assert('TEST 1: Feature flag OFF -> shouldUseMultiPrinterKOT returns false', canUse === false);
  }

  // TEST 2: Browser environment (non-desktop) -> returns false
  {
    const canUse = shouldUseMultiPrinterKOT({
      tenant: MOCK_TENANT_ENABLED,
      printers: [MOCK_DEFAULT_PRINTER],
      routes: [],
      isDesktopEnv: false, // In browser
      electronApi: MOCK_ELECTRON_API,
    });
    assert('TEST 2: Browser environment (non-desktop) -> returns false', canUse === false);
  }

  // TEST 3: Electron IPC unavailable -> returns false
  {
    const canUse = shouldUseMultiPrinterKOT({
      tenant: MOCK_TENANT_ENABLED,
      printers: [MOCK_DEFAULT_PRINTER],
      routes: [],
      isDesktopEnv: true,
      electronApi: undefined, // Missing IPC
    });
    assert('TEST 3: Electron IPC unavailable -> returns false', canUse === false);
  }

  // TEST 4: Empty printer configuration -> returns false
  {
    const canUse = shouldUseMultiPrinterKOT({
      tenant: MOCK_TENANT_ENABLED,
      printers: [], // No printers in settings
      routes: [],
      isDesktopEnv: true,
      electronApi: MOCK_ELECTRON_API,
    });
    assert('TEST 4: Empty printer configuration -> returns false', canUse === false);
  }

  // TEST 5: No active default printer -> returns false
  {
    const noDefaultPrinter: TenantPrinter = {
      ...MOCK_KITCHEN_PRINTER,
      is_default: false,
    };
    const canUse = shouldUseMultiPrinterKOT({
      tenant: MOCK_TENANT_ENABLED,
      printers: [noDefaultPrinter],
      routes: [],
      isDesktopEnv: true,
      electronApi: MOCK_ELECTRON_API,
    });
    assert('TEST 5: No active default printer -> returns false', canUse === false);
  }

  // TEST 6: Valid setup with ONLY default printer (no routes) -> returns true, and all items route to default
  {
    const canUse = shouldUseMultiPrinterKOT({
      tenant: MOCK_TENANT_ENABLED,
      printers: [MOCK_DEFAULT_PRINTER],
      routes: [],
      isDesktopEnv: true,
      electronApi: MOCK_ELECTRON_API,
    });

    const printedJobs: TargetedPrintRequest[] = [];
    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => {
        printedJobs.push(req);
        return { success: true, jobId: req.jobId, printerName: req.deviceName, error: null };
      },
    };

    let completedItemsCount = 0;
    let fallbackCalled = false;

    await executeMultiPrinterKOTFlow({
      orderData: { id: 'order_1', orderNumber: '05', orderType: 'dine_in', tableId: 'T1' },
      newKotItems: [
        { product: { id: 'p1', name: 'Karahi', category: 'Karahi', price: 1000 }, quantity: 1 },
        { product: { id: 'p2', name: 'Pepsi', category: 'Beverages', price: 100 }, quantity: 2 },
      ],
      printers: [MOCK_DEFAULT_PRINTER],
      routes: [],
      tenantId: 'tenant_101',
      onLegacyFallback: () => {
        fallbackCalled = true;
      },
      onComplete: (items) => {
        completedItemsCount = items.length;
      },
      dispatchOptions: {
        electronAPI: mockApi,
        delayBetweenJobsMs: 0,
      },
    });

    assert(
      'TEST 6: Valid setup with only default printer -> routes all items to default printer',
      canUse === true &&
        fallbackCalled === false &&
        completedItemsCount === 2 &&
        printedJobs.length === 1 &&
        printedJobs[0].deviceName === 'POS-80 Default' &&
        printedJobs[0].html.includes('Karahi') &&
        printedJobs[0].html.includes('Pepsi')
    );
  }

  // TEST 7: Valid setup with category routes -> routes items to respective stations and default
  {
    const printedJobs: TargetedPrintRequest[] = [];
    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => {
        printedJobs.push(req);
        return { success: true, jobId: req.jobId, printerName: req.deviceName, error: null };
      },
    };

    let completedCount = 0;
    await executeMultiPrinterKOTFlow({
      orderData: { id: 'order_2', orderNumber: '06', orderType: 'dine_in', tableId: 'T2' },
      newKotItems: [
        { product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi', price: 1200 }, quantity: 1 },
        { product: { id: 'p2', name: 'Cold Pepsi', category: 'Beverages', price: 100 }, quantity: 2 },
        { product: { id: 'p3', name: 'French Fries', category: 'Fast Food', price: 300 }, quantity: 1 }, // Unassigned category -> default
      ],
      printers: [MOCK_DEFAULT_PRINTER, MOCK_KITCHEN_PRINTER, MOCK_BAR_PRINTER],
      routes: MOCK_ROUTES,
      tenantId: 'tenant_101',
      onLegacyFallback: () => {},
      onComplete: (items) => {
        completedCount = items.length;
      },
      dispatchOptions: {
        electronAPI: mockApi,
        delayBetweenJobsMs: 0,
      },
    });

    const kitchenJob = printedJobs.find((j) => j.deviceName === 'POS-80 Kitchen');
    const barJob = printedJobs.find((j) => j.deviceName === 'POS-80 Bar');
    const defaultJob = printedJobs.find((j) => j.deviceName === 'POS-80 Default');

    assert(
      'TEST 7: Category routes -> routes items to respective stations and unassigned to default',
      completedCount === 3 &&
        printedJobs.length === 3 &&
        kitchenJob !== undefined &&
        kitchenJob.html.includes('Chicken Karahi') &&
        !kitchenJob.html.includes('Cold Pepsi') &&
        barJob !== undefined &&
        barJob.html.includes('Cold Pepsi') &&
        !barJob.html.includes('Chicken Karahi') &&
        defaultJob !== undefined &&
        defaultJob.html.includes('French Fries')
    );
  }

  // TEST 8: Station printer failure -> redirects only failed items to default printer without duplicate print
  {
    const printedJobs: TargetedPrintRequest[] = [];
    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => {
        printedJobs.push(req);
        // Bar printer fails
        if (req.deviceName === 'POS-80 Bar') {
          return {
            success: false,
            jobId: req.jobId,
            printerName: req.deviceName,
            error: { code: 'PRINTER_NOT_FOUND', message: 'Bar printer offline' },
          };
        }
        return { success: true, jobId: req.jobId, printerName: req.deviceName, error: null };
      },
    };

    let legacyFallbackCalled = false;
    let completedItems: unknown[] = [];

    await executeMultiPrinterKOTFlow({
      orderData: { id: 'order_3', orderNumber: '07', orderType: 'dine_in', tableId: 'T3' },
      newKotItems: [
        { product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi', price: 1200 }, quantity: 1 },
        { product: { id: 'p2', name: 'Fresh Lime', category: 'Beverages', price: 150 }, quantity: 1 },
        { product: { id: 'p3', name: 'Fries', category: 'Sides', price: 300 }, quantity: 1 },
      ],
      printers: [MOCK_DEFAULT_PRINTER, MOCK_KITCHEN_PRINTER, MOCK_BAR_PRINTER],
      routes: MOCK_ROUTES,
      tenantId: 'tenant_101',
      onLegacyFallback: () => {
        legacyFallbackCalled = true;
      },
      onComplete: (items) => {
        completedItems = items;
      },
      dispatchOptions: {
        electronAPI: mockApi,
        delayBetweenJobsMs: 0,
      },
    });

    // Kitchen printed Karahi, Bar failed for Fresh Lime -> Fresh Lime redirected to Default Printer
    const defaultJobs = printedJobs.filter((j) => j.deviceName === 'POS-80 Default');
    const kitchenJobs = printedJobs.filter((j) => j.deviceName === 'POS-80 Kitchen');

    // Default printer should have received the initial Fries job AND the fallback Fresh Lime job
    const hasFreshLimeOnDefault = defaultJobs.some((j) => j.html.includes('Fresh Lime'));
    const kitchenPrintedOnce = kitchenJobs.length === 1;

    assert(
      'TEST 8: Station printer failure -> redirects only failed items to default without duplicating successful items',
      legacyFallbackCalled === false &&
        kitchenPrintedOnce &&
        hasFreshLimeOnDefault &&
        completedItems.length === 3
    );
  }

  // TEST 9: Total station dispatch failure before printing -> triggers onLegacyFallback
  {
    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => ({
        success: false,
        jobId: req.jobId,
        printerName: req.deviceName,
        error: { code: 'ELECTRON_IPC_ERROR', message: 'IPC crashed' },
      }),
    };

    let legacyFallbackCalled = false;

    await executeMultiPrinterKOTFlow({
      orderData: { id: 'order_4', orderNumber: '08' },
      newKotItems: [
        { product: { id: 'p1', name: 'Karahi', category: 'Karahi' }, quantity: 1 },
      ],
      printers: [MOCK_DEFAULT_PRINTER, MOCK_KITCHEN_PRINTER],
      routes: MOCK_ROUTES,
      tenantId: 'tenant_101',
      onLegacyFallback: () => {
        legacyFallbackCalled = true;
      },
      onComplete: () => {},
      dispatchOptions: {
        electronAPI: mockApi,
        delayBetweenJobsMs: 0,
      },
    });

    assert(
      'TEST 9: Total dispatch failure before printing -> triggers onLegacyFallback',
      legacyFallbackCalled === true
    );
  }

  // TEST 10: Delta / revision item tracking -> only new delta items are dispatched
  {
    const printedJobs: TargetedPrintRequest[] = [];
    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => {
        printedJobs.push(req);
        return { success: true, jobId: req.jobId, printerName: req.deviceName, error: null };
      },
    };

    // Revision order: newlyAddedItems contains only the newly added Pepsi, not the previously printed Karahi
    const deltaItems = [
      { product: { id: 'p2', name: 'Pepsi', category: 'Beverages', price: 100 }, quantity: 2 },
    ];

    await executeMultiPrinterKOTFlow({
      orderData: {
        id: 'order_rev_5',
        orderNumber: '09',
        revisionNumber: 2,
        isRevision: true,
        previousItems: [{ product: { id: 'p1', name: 'Karahi' }, quantity: 1 }],
      },
      newKotItems: deltaItems,
      printers: [MOCK_DEFAULT_PRINTER, MOCK_KITCHEN_PRINTER, MOCK_BAR_PRINTER],
      routes: MOCK_ROUTES,
      tenantId: 'tenant_101',
      onLegacyFallback: () => {},
      onComplete: () => {},
      dispatchOptions: {
        electronAPI: mockApi,
        delayBetweenJobsMs: 0,
      },
    });

    assert(
      'TEST 10: Delta / revision printing -> only newly added items are sent to station printers',
      printedJobs.length === 1 &&
        printedJobs[0].deviceName === 'POS-80 Bar' &&
        printedJobs[0].html.includes('Pepsi') &&
        !printedJobs[0].html.includes('Karahi')
    );
  }

  // TEST 11: Exact KOT data preservation in order context
  {
    const rawOrderData = {
      id: 'order_ctx_1',
      orderNumber: '42',
      orderType: 'delivery',
      tableId: 'T-10',
      serverName: '[waiter] Anas',
      rider: { name: 'Kashif Rider' },
      customer: { name: 'VIP Guest', phone: '03009999999' },
      cashierName: 'Super Cashier',
      notes: 'Less spicy please',
      revisionNumber: 3,
    };

    const ctx = buildKOTOrderContext(rawOrderData);
    assert(
      'TEST 11: Exact KOT data preservation in buildKOTOrderContext',
      ctx.orderNumber === '42' &&
        ctx.orderType === 'delivery' &&
        ctx.tableId === 'T-10' &&
        ctx.serverName === '[waiter] Anas' &&
        ctx.rider?.name === 'Kashif Rider' &&
        ctx.customer?.name === 'VIP Guest' &&
        ctx.cashierName === 'Super Cashier' &&
        ctx.notes === 'Less spicy please' &&
        ctx.revisionNumber === 3 &&
        ctx.isRevision === true
    );
  }

  return results;
}
