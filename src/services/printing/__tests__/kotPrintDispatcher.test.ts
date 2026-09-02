import {
  dispatchKOTPrintJobs,
  DEFAULT_DISPATCH_DELAY_MS,
  ElectronPrintingAPI,
} from '../kotPrintDispatcher';
import {
  KOTPrintJob,
  KOTRoutingResult,
  UnroutableKOTItem,
  KOTOrderContext,
} from '../kotRoutingTypes';
import { TenantPrinter } from '@/types/printer';
import {
  DiscoveredPrinter,
  TargetedPrintRequest,
  TargetedPrintResult,
} from '@/types/electronPrinting';

// ─── TEST FIXTURES ────────────────────────────────────────────────────────────

const MOCK_PRINTER_KITCHEN: TenantPrinter = {
  id: 'p_kitchen_1',
  tenant_id: 'tenant_123',
  name: 'Kitchen Station',
  printer_type: 'usb',
  device_name: 'POS-80 Kitchen',
  is_default: true,
  is_active: true,
};

const MOCK_PRINTER_BAR: TenantPrinter = {
  id: 'p_bar_2',
  tenant_id: 'tenant_123',
  name: 'Bar Station',
  printer_type: 'usb',
  device_name: 'POS-80 Bar',
  is_default: false,
  is_active: true,
};

const MOCK_PRINTER_BBQ: TenantPrinter = {
  id: 'p_bbq_3',
  tenant_id: 'tenant_123',
  name: 'BBQ Station',
  printer_type: 'usb',
  device_name: 'POS-80 BBQ',
  is_default: false,
  is_active: true,
};

const MOCK_ORDER_CONTEXT: KOTOrderContext = {
  orderNumber: '42',
  orderType: 'dine_in',
  tableId: 'T-07',
  serverName: 'Ali Khan',
  createdAt: new Date('2026-09-02T14:30:00Z'),
};

function createMockJob(
  printer: TenantPrinter,
  jobId: string,
  itemName: string,
  quantity = 1,
  emptyItems = false
): KOTPrintJob {
  return {
    jobId,
    printerId: printer.id,
    printer,
    items: emptyItems
      ? []
      : [
          {
            item: {
              id: `item_${jobId}`,
              name: itemName,
              quantity,
              price: 500,
            },
            resolvedCategory: 'food',
            canonicalCategoryKey: 'food',
            routingMethod: 'direct_route',
            targetPrinterId: printer.id,
            targetPrinterName: printer.name,
          },
        ],
    orderContext: MOCK_ORDER_CONTEXT,
    routingMethod: 'direct_route',
    itemCount: emptyItems ? 0 : 1,
    totalQuantity: emptyItems ? 0 : quantity,
    createdAt: new Date().toISOString(),
  };
}

export async function runDispatcherTests(): Promise<
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

  // TEST 1: One routed job -> successful targeted print
  {
    const job = createMockJob(MOCK_PRINTER_KITCHEN, 'job_1', 'Chicken Biryani', 2);
    let capturedRequest: TargetedPrintRequest | null = null;

    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => {
        capturedRequest = req;
        return {
          success: true,
          jobId: req.jobId,
          printerName: req.deviceName,
          error: null,
        };
      },
    };

    const res = await dispatchKOTPrintJobs([job], {
      electronAPI: mockApi,
      delayBetweenJobsMs: 0,
    });

    assert(
      'TEST 1: One routed job -> successful targeted print',
      res.success === true &&
        res.successfulJobs === 1 &&
        res.failedJobs === 0 &&
        res.jobs.length === 1 &&
        res.jobs[0].success === true &&
        res.jobs[0].deviceName === 'POS-80 Kitchen' &&
        capturedRequest !== null &&
        (capturedRequest as TargetedPrintRequest).jobId === 'job_1' &&
        (capturedRequest as TargetedPrintRequest).html.includes('Chicken Biryani')
    );
  }

  // TEST 2: Multiple jobs -> dispatched sequentially with proper timing
  {
    const jobKitchen = createMockJob(MOCK_PRINTER_KITCHEN, 'job_seq_1', 'Karahi', 1);
    const jobBar = createMockJob(MOCK_PRINTER_BAR, 'job_seq_2', 'Fresh Lime', 2);
    const jobBbq = createMockJob(MOCK_PRINTER_BBQ, 'job_seq_3', 'Seekh Kabab', 4);

    const callLog: { jobId: string; time: number }[] = [];

    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => {
        callLog.push({ jobId: req.jobId, time: Date.now() });
        return {
          success: true,
          jobId: req.jobId,
          printerName: req.deviceName,
          error: null,
        };
      },
    };

    const delayMs = 40;
    const res = await dispatchKOTPrintJobs([jobKitchen, jobBar, jobBbq], {
      electronAPI: mockApi,
      delayBetweenJobsMs: delayMs,
    });

    const isOrderCorrect =
      callLog.length === 3 &&
      callLog[0].jobId === 'job_seq_1' &&
      callLog[1].jobId === 'job_seq_2' &&
      callLog[2].jobId === 'job_seq_3';

    // Inter-job delay check (with tolerance for JS timers)
    const delay1 = callLog[1].time - callLog[0].time;
    const delay2 = callLog[2].time - callLog[1].time;
    const timingOk = delay1 >= 30 && delay2 >= 30;

    assert(
      'TEST 2: Multiple jobs -> dispatched sequentially in order with configured delay',
      res.success === true &&
        res.successfulJobs === 3 &&
        isOrderCorrect &&
        timingOk,
      `Order: ${callLog.map((c) => c.jobId).join(' -> ')}, Delays: ${delay1}ms, ${delay2}ms`
    );
  }

  // TEST 3: One printer failure -> remaining printers still print (failure isolation)
  {
    const jobKitchen = createMockJob(MOCK_PRINTER_KITCHEN, 'job_fail_1', 'Karahi', 1);
    const jobBar = createMockJob(MOCK_PRINTER_BAR, 'job_fail_2', 'Cocktail', 1);
    const jobBbq = createMockJob(MOCK_PRINTER_BBQ, 'job_fail_3', 'Tikka', 1);

    const printedJobs: string[] = [];

    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => {
        if (req.jobId === 'job_fail_2') {
          return {
            success: false,
            jobId: req.jobId,
            printerName: req.deviceName,
            error: {
              code: 'PRINTER_NOT_FOUND',
              message: 'Target printer POS-80 Bar was not found.',
            },
          };
        }
        printedJobs.push(req.jobId);
        return {
          success: true,
          jobId: req.jobId,
          printerName: req.deviceName,
          error: null,
        };
      },
    };

    const res = await dispatchKOTPrintJobs([jobKitchen, jobBar, jobBbq], {
      electronAPI: mockApi,
      delayBetweenJobsMs: 0,
    });

    assert(
      'TEST 3: One printer failure -> remaining printers still print',
      res.success === false &&
        res.successfulJobs === 2 &&
        res.failedJobs === 1 &&
        printedJobs.includes('job_fail_1') &&
        printedJobs.includes('job_fail_3') &&
        res.jobs[1].success === false &&
        res.jobs[1].error?.code === 'PRINTER_NOT_FOUND' &&
        res.jobs[0].success === true &&
        res.jobs[2].success === true
    );
  }

  // TEST 4: Electron unavailable -> structured failure
  {
    const job = createMockJob(MOCK_PRINTER_KITCHEN, 'job_no_electron', 'Handi', 1);

    const res = await dispatchKOTPrintJobs([job], {
      electronAPI: undefined,
      delayBetweenJobsMs: 0,
    });

    assert(
      'TEST 4: Electron unavailable -> structured failure',
      res.success === false &&
        res.electronAvailable === false &&
        res.failedJobs === 1 &&
        res.successfulJobs === 0 &&
        res.error?.code === 'ELECTRON_PRINTING_UNAVAILABLE' &&
        res.jobs[0].error?.code === 'ELECTRON_PRINTING_UNAVAILABLE'
    );
  }

  // TEST 5: Printer missing / invalid device name / inactive printer -> structured failure
  {
    const invalidPrinterEmptyName: TenantPrinter = {
      ...MOCK_PRINTER_KITCHEN,
      id: 'p_empty',
      device_name: '   ',
    };
    const inactivePrinter: TenantPrinter = {
      ...MOCK_PRINTER_BAR,
      id: 'p_inactive',
      is_active: false,
    };
    const validPrinter: TenantPrinter = {
      ...MOCK_PRINTER_BBQ,
      id: 'p_valid',
      device_name: 'POS-80 BBQ',
    };

    const jobEmpty = createMockJob(invalidPrinterEmptyName, 'job_empty_dev', 'Tea', 1);
    const jobInactive = createMockJob(inactivePrinter, 'job_inactive_p', 'Juice', 1);
    const jobValid = createMockJob(validPrinter, 'job_valid_p', 'Steak', 1);

    const installed: DiscoveredPrinter[] = [
      {
        name: 'POS-80 BBQ',
        displayName: 'POS-80 BBQ',
        description: 'Installed',
        status: 0,
        isDefault: true,
      },
    ];

    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => ({
        success: true,
        jobId: req.jobId,
        printerName: req.deviceName,
        error: null,
      }),
    };

    const res = await dispatchKOTPrintJobs([jobEmpty, jobInactive, jobValid], {
      electronAPI: mockApi,
      installedPrinters: installed,
      delayBetweenJobsMs: 0,
    });

    assert(
      'TEST 5: Printer missing / invalid device name / inactive -> structured failure',
      res.successfulJobs === 1 &&
        res.failedJobs === 2 &&
        res.jobs[0].error?.code === 'EMPTY_DEVICE_NAME' &&
        res.jobs[1].error?.code === 'INACTIVE_PRINTER' &&
        res.jobs[2].success === true
    );
  }

  // TEST 6: HTML renderer failure -> job failure without stopping others
  {
    // A job with empty items causes renderKOTHtml to throw
    const brokenJob = createMockJob(MOCK_PRINTER_KITCHEN, 'job_broken', 'None', 0, true);
    const goodJob = createMockJob(MOCK_PRINTER_BAR, 'job_good', 'Mint Margarita', 1);

    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => ({
        success: true,
        jobId: req.jobId,
        printerName: req.deviceName,
        error: null,
      }),
    };

    const res = await dispatchKOTPrintJobs([brokenJob, goodJob], {
      electronAPI: mockApi,
      delayBetweenJobsMs: 0,
    });

    assert(
      'TEST 6: HTML renderer failure -> job failure without stopping others',
      res.successfulJobs === 1 &&
        res.failedJobs === 1 &&
        res.jobs[0].success === false &&
        res.jobs[0].error?.code === 'HTML_RENDER_ERROR' &&
        res.jobs[1].success === true &&
        res.jobs[1].jobId === 'job_good'
    );
  }

  // TEST 7: Empty job array -> safe structured result
  {
    const mockApi: ElectronPrintingAPI = {
      printTargeted: async () => ({
        success: true,
        jobId: '0',
        printerName: '',
        error: null,
      }),
    };

    const res = await dispatchKOTPrintJobs([], {
      electronAPI: mockApi,
    });

    assert(
      'TEST 7: Empty job array -> safe structured result',
      res.success === true &&
        res.jobs.length === 0 &&
        res.successfulJobs === 0 &&
        res.failedJobs === 0 &&
        res.electronAvailable === true &&
        res.error === null
    );
  }

  // TEST 8: Unroutable items -> preserved in final result
  {
    const job = createMockJob(MOCK_PRINTER_KITCHEN, 'job_with_unroutable', 'Biryani', 1);

    const unroutableItem: UnroutableKOTItem = {
      item: { name: 'Mystery Item', quantity: 1 },
      resolvedCategory: null,
      canonicalCategoryKey: null,
      reason: 'NO_MATCHING_ROUTE_AND_NO_DEFAULT',
      message: 'No printer found and no default printer configured.',
    };

    const routingResult: KOTRoutingResult = {
      status: 'partially_routed',
      jobs: [job],
      unroutableItems: [unroutableItem],
      summary: {
        totalItemsReceived: 2,
        totalItemsRouted: 1,
        totalJobsCreated: 1,
        directRouteJobsCount: 1,
        fallbackJobsCount: 0,
        unroutableCount: 1,
        activeDefaultPrinterId: null,
      },
    };

    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => ({
        success: true,
        jobId: req.jobId,
        printerName: req.deviceName,
        error: null,
      }),
    };

    const res = await dispatchKOTPrintJobs(routingResult, {
      electronAPI: mockApi,
      delayBetweenJobsMs: 0,
    });

    assert(
      'TEST 8: Unroutable items -> preserved in final result and success is false',
      res.success === false &&
        res.successfulJobs === 1 &&
        res.failedJobs === 0 &&
        res.unroutableItems.length === 1 &&
        res.unroutableItems[0].reason === 'NO_MATCHING_ROUTE_AND_NO_DEFAULT' &&
        res.error?.code === 'UNROUTABLE_ITEMS_EXIST'
    );
  }

  // TEST 9: Mixed success/failure -> correct successfulJobs, failedJobs, overall success
  {
    const job1 = createMockJob(MOCK_PRINTER_KITCHEN, 'job_mix_1', 'Item 1', 1);
    const job2 = createMockJob(MOCK_PRINTER_BAR, 'job_mix_2', 'Item 2', 1);
    const job3 = createMockJob(MOCK_PRINTER_BBQ, 'job_mix_3', 'Item 3', 1);

    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => {
        if (req.jobId === 'job_mix_2') {
          return {
            success: false,
            jobId: req.jobId,
            printerName: req.deviceName,
            error: { code: 'PRINTER_OFFLINE', message: 'Printer was offline' },
          };
        }
        return {
          success: true,
          jobId: req.jobId,
          printerName: req.deviceName,
          error: null,
        };
      },
    };

    const res = await dispatchKOTPrintJobs([job1, job2, job3], {
      electronAPI: mockApi,
      delayBetweenJobsMs: 0,
    });

    assert(
      'TEST 9: Mixed success/failure -> correct successfulJobs (2), failedJobs (1), overall success (false)',
      res.successfulJobs === 2 &&
        res.failedJobs === 1 &&
        res.success === false &&
        res.error?.code === 'SOME_JOBS_FAILED'
    );
  }

  // TEST 10: Verify no window.print() or legacy print functions are called
  {
    let legacyPrintCalled = false;
    // Set up mock window.print if window is available or on global
    const originalPrint = (globalThis as unknown as { print?: () => void }).print;
    (globalThis as unknown as { print: () => void }).print = () => {
      legacyPrintCalled = true;
    };

    const job = createMockJob(MOCK_PRINTER_KITCHEN, 'job_legacy_check', 'Pizza', 1);

    const mockApi: ElectronPrintingAPI = {
      printTargeted: async (req) => ({
        success: false,
        jobId: req.jobId,
        printerName: req.deviceName,
        error: { code: 'SIMULATED_FAIL', message: 'Fail' },
      }),
    };

    // Even on error, legacy window.print() must NOT be called
    await dispatchKOTPrintJobs([job], {
      electronAPI: mockApi,
      delayBetweenJobsMs: 0,
    });

    // Restore original print
    if (originalPrint) {
      (globalThis as unknown as { print?: () => void }).print = originalPrint;
    } else {
      delete (globalThis as unknown as { print?: () => void }).print;
    }

    assert(
      'TEST 10: Verify no window.print() or legacy print functions are called on failure',
      legacyPrintCalled === false
    );
  }

  return results;
}
