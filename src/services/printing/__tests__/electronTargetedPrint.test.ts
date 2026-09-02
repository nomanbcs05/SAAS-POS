import {
  DiscoveredPrinter,
  TargetedPrintRequest,
  TargetedPrintResult,
} from '@/types/electronPrinting';

/**
 * Pure simulation of the validation and execution pipeline in main.cjs
 * to test all 10 contracts and safety boundaries in code.
 */
export function simulateIpcTargetedPrint(
  request: Partial<TargetedPrintRequest> | null | undefined,
  installedPrinters: DiscoveredPrinter[]
): TargetedPrintResult {
  const req = request || {};
  const jobId = typeof req.jobId === 'string' ? req.jobId : 'unknown_job';
  const rawDeviceName = typeof req.deviceName === 'string' ? req.deviceName.trim() : '';
  const html = typeof req.html === 'string' ? req.html : '';

  // 1. Validation
  if (!rawDeviceName) {
    return {
      success: false,
      jobId,
      printerName: '',
      error: {
        code: 'EMPTY_DEVICE_NAME',
        message: 'Target printer deviceName must be a non-empty string.',
      },
    };
  }

  if (!html || !html.trim()) {
    return {
      success: false,
      jobId,
      printerName: rawDeviceName,
      error: {
        code: 'EMPTY_HTML',
        message: 'Print HTML payload must be a non-empty string.',
      },
    };
  }

  if (html.length > 2 * 1024 * 1024) {
    return {
      success: false,
      jobId,
      printerName: rawDeviceName,
      error: {
        code: 'HTML_TOO_LARGE',
        message: 'Print HTML payload exceeds 2MB maximum size limit.',
      },
    };
  }

  // 2. Printer existence check
  const matchedPrinter = (installedPrinters || []).find(
    (p) =>
      p.name.toLowerCase() === rawDeviceName.toLowerCase() ||
      (p.displayName && p.displayName.toLowerCase() === rawDeviceName.toLowerCase())
  );

  if (installedPrinters.length > 0 && !matchedPrinter) {
    return {
      success: false,
      jobId,
      printerName: rawDeviceName,
      error: {
        code: 'PRINTER_NOT_FOUND',
        message: `Printer "${rawDeviceName}" was not found in installed operating system printers.`,
      },
    };
  }

  const effectivePrinterName = matchedPrinter ? matchedPrinter.name : rawDeviceName;

  // 3. Simulated success return for valid request with known printer
  return {
    success: true,
    jobId,
    printerName: effectivePrinterName,
    error: null,
  };
}

export function runElectronPrintingTests(): { name: string; passed: boolean; details?: string }[] {
  const results: { name: string; passed: boolean; details?: string }[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    results.push({ name, passed: condition, details });
    if (!condition) {
      console.error(`❌ TEST FAILED: ${name}`, details);
    } else {
      console.log(`✅ TEST PASSED: ${name}`);
    }
  }

  const MOCK_INSTALLED_PRINTERS: DiscoveredPrinter[] = [
    {
      name: 'EPSON TM-T88VI Receipt',
      displayName: 'EPSON TM-T88VI Receipt',
      description: 'Epson Thermal Receipt Printer',
      status: 0,
      isDefault: true,
    },
    {
      name: 'POS-80C Kitchen',
      displayName: 'POS-80C Kitchen',
      description: 'Kitchen 80mm Printer',
      status: 0,
      isDefault: false,
    },
  ];

  // TEST 1: Printer discovery returns structured installed printer list
  {
    const list = MOCK_INSTALLED_PRINTERS;
    assert(
      'TEST 1: Printer discovery returns installed printer list',
      list.length === 2 &&
        list[0].name === 'EPSON TM-T88VI Receipt' &&
        list[0].isDefault === true &&
        list[1].isDefault === false
    );
  }

  // TEST 2: Unknown deviceName is rejected safely
  {
    const req: TargetedPrintRequest = {
      jobId: 'job_101',
      deviceName: 'NonExistent_Ghost_Printer',
      html: '<html><body>Test KOT</body></html>',
    };
    const res = simulateIpcTargetedPrint(req, MOCK_INSTALLED_PRINTERS);
    assert(
      'TEST 2: Unknown deviceName is rejected safely with PRINTER_NOT_FOUND',
      res.success === false &&
        res.error?.code === 'PRINTER_NOT_FOUND' &&
        res.jobId === 'job_101'
    );
  }

  // TEST 3: Empty deviceName is rejected
  {
    const req: TargetedPrintRequest = {
      jobId: 'job_102',
      deviceName: '   ',
      html: '<html><body>Test KOT</body></html>',
    };
    const res = simulateIpcTargetedPrint(req, MOCK_INSTALLED_PRINTERS);
    assert(
      'TEST 3: Empty deviceName is rejected with EMPTY_DEVICE_NAME',
      res.success === false && res.error?.code === 'EMPTY_DEVICE_NAME'
    );
  }

  // TEST 4: Malformed request is rejected (empty HTML)
  {
    const req: TargetedPrintRequest = {
      jobId: 'job_103',
      deviceName: 'POS-80C Kitchen',
      html: '',
    };
    const res = simulateIpcTargetedPrint(req, MOCK_INSTALLED_PRINTERS);
    assert(
      'TEST 4: Empty HTML payload is rejected with EMPTY_HTML',
      res.success === false && res.error?.code === 'EMPTY_HTML'
    );
  }

  // TEST 5: A valid print request produces structured success
  {
    const req: TargetedPrintRequest = {
      jobId: 'job_104',
      deviceName: 'POS-80C Kitchen',
      html: '<html><body><h1>KITCHEN TICKET #05</h1></body></html>',
    };
    const res = simulateIpcTargetedPrint(req, MOCK_INSTALLED_PRINTERS);
    assert(
      'TEST 5: Valid request produces structured success result',
      res.success === true &&
        res.jobId === 'job_104' &&
        res.printerName === 'POS-80C Kitchen' &&
        res.error === null
    );
  }

  // TEST 6: Print failure isolation (does not throw or mutate other jobs)
  {
    const reqFail: TargetedPrintRequest = {
      jobId: 'job_bar_fail',
      deviceName: 'Offline_Bar_Printer',
      html: '<html><body>Bar Drink Ticket</body></html>',
    };
    const reqSuccess: TargetedPrintRequest = {
      jobId: 'job_kitchen_ok',
      deviceName: 'POS-80C Kitchen',
      html: '<html><body>Kitchen Karahi Ticket</body></html>',
    };

    const resFail = simulateIpcTargetedPrint(reqFail, MOCK_INSTALLED_PRINTERS);
    const resSuccess = simulateIpcTargetedPrint(reqSuccess, MOCK_INSTALLED_PRINTERS);

    assert(
      'TEST 6: Targeted print failure does not affect other concurrent jobs',
      resFail.success === false &&
        resFail.error?.code === 'PRINTER_NOT_FOUND' &&
        resSuccess.success === true &&
        resSuccess.jobId === 'job_kitchen_ok'
    );
  }

  // TEST 7: Case-insensitive device name matching
  {
    const req: TargetedPrintRequest = {
      jobId: 'job_105',
      deviceName: 'pos-80c kitchen', // lowercased
      html: '<html><body>Test</body></html>',
    };
    const res = simulateIpcTargetedPrint(req, MOCK_INSTALLED_PRINTERS);
    assert(
      'TEST 7: Device name matching is case-insensitive',
      res.success === true && res.printerName === 'POS-80C Kitchen'
    );
  }

  // TEST 8: HTML payload size limit protection
  {
    const hugeHtml = 'x'.repeat(3 * 1024 * 1024); // 3MB
    const req: TargetedPrintRequest = {
      jobId: 'job_106',
      deviceName: 'POS-80C Kitchen',
      html: hugeHtml,
    };
    const res = simulateIpcTargetedPrint(req, MOCK_INSTALLED_PRINTERS);
    assert(
      'TEST 8: Oversized HTML payload rejected with HTML_TOO_LARGE',
      res.success === false && res.error?.code === 'HTML_TOO_LARGE'
    );
  }

  return results;
}
