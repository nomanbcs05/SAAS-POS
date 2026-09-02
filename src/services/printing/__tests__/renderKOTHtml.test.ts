import { renderKOTHtml, escapeHtml } from '../renderKOTHtml';
import { KOTPrintJob, KOTOrderContext } from '../kotRoutingTypes';
import { TenantPrinter } from '@/types/printer';

// ─── TEST FIXTURES ────────────────────────────────────────────────────────────

const MOCK_PRINTER_KITCHEN: TenantPrinter = {
  id: 'printer_kitchen_1',
  tenant_id: 'tenant_123',
  name: 'Main Kitchen Printer',
  printer_type: 'network',
  ip_address: '192.168.1.100',
  port: 9100,
  is_default: true,
  is_active: true,
};

const MOCK_PRINTER_BAR: TenantPrinter = {
  id: 'printer_bar_2',
  tenant_id: 'tenant_123',
  name: 'Bar & Drinks Printer',
  printer_type: 'usb',
  device_name: 'POS80_BAR',
  is_default: false,
  is_active: true,
};

const MOCK_ORDER_CONTEXT: KOTOrderContext = {
  orderId: 'order_uuid_101',
  orderNumber: '05',
  orderType: 'dine_in',
  tableId: 'T-04',
  serverName: '[waiter] Ali Khan',
  customer: {
    id: 'c1',
    name: 'Ahmed Bilal',
    phone: '03001234567',
    email: '',
    loyaltyPoints: 0,
    totalSpent: 0,
    visitCount: 1,
    creditBalance: 0,
  },
  cashierName: 'Cashier 1',
  createdAt: new Date('2026-09-02T12:00:00Z'),
  revisionNumber: 1,
  isRevision: false,
};

export function runRendererTests(): { name: string; passed: boolean; details?: string }[] {
  const results: { name: string; passed: boolean; details?: string }[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    results.push({ name, passed: condition, details });
    if (!condition) {
      console.error(`❌ TEST FAILED: ${name}`, details);
    } else {
      console.log(`✅ TEST PASSED: ${name}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Single Printer Job (Kitchen printer containing Chicken Karahi)
  // ───────────────────────────────────────────────────────────────────────────
  {
    const job: KOTPrintJob = {
      jobId: 'job_1',
      printerId: MOCK_PRINTER_KITCHEN.id,
      printer: MOCK_PRINTER_KITCHEN,
      items: [
        {
          item: {
            product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi' },
            quantity: 2,
            qtyMeasureLabel: 'Full',
          },
          resolvedCategory: 'Karahi',
          canonicalCategoryKey: 'karahi',
          routingMethod: 'direct_route',
          targetPrinterId: MOCK_PRINTER_KITCHEN.id,
          targetPrinterName: MOCK_PRINTER_KITCHEN.name,
        },
      ],
      orderContext: MOCK_ORDER_CONTEXT,
      routingMethod: 'direct_route',
      itemCount: 1,
      totalQuantity: 2,
      createdAt: new Date().toISOString(),
    };

    const html = renderKOTHtml(job);
    assert(
      'TEST 1: Single Printer Job renders assigned item and measure label',
      html.includes('Chicken Karahi') &&
        html.includes('(Full)') &&
        html.includes('2') &&
        html.includes('KITCHEN TICKET') &&
        html.includes('Main Kitchen Printer')
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Item Isolation (Bar job contains Pepsi, must NOT contain Karahi)
  // ───────────────────────────────────────────────────────────────────────────
  {
    const job: KOTPrintJob = {
      jobId: 'job_2',
      printerId: MOCK_PRINTER_BAR.id,
      printer: MOCK_PRINTER_BAR,
      items: [
        {
          item: {
            product: { id: 'p9', name: 'Pepsi 1.5L', category: 'Beverages' },
            quantity: 1,
          },
          resolvedCategory: 'Beverages',
          canonicalCategoryKey: 'beverages',
          routingMethod: 'direct_route',
          targetPrinterId: MOCK_PRINTER_BAR.id,
          targetPrinterName: MOCK_PRINTER_BAR.name,
        },
      ],
      orderContext: MOCK_ORDER_CONTEXT,
      routingMethod: 'direct_route',
      itemCount: 1,
      totalQuantity: 1,
      createdAt: new Date().toISOString(),
    };

    const html = renderKOTHtml(job);
    assert(
      'TEST 2: Item Isolation -> Job contains only Pepsi and does NOT contain other items',
      html.includes('Pepsi 1.5L') &&
        !html.includes('Chicken Karahi') &&
        !html.includes('Mutton Handi') &&
        !html.includes('French Fries')
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Multiple Items rendered on single printer ticket
  // ───────────────────────────────────────────────────────────────────────────
  {
    const job: KOTPrintJob = {
      jobId: 'job_3',
      printerId: MOCK_PRINTER_KITCHEN.id,
      printer: MOCK_PRINTER_KITCHEN,
      items: [
        {
          item: { product: { id: 'p1', name: 'Chicken Karahi' }, quantity: 1 },
          resolvedCategory: 'Karahi',
          canonicalCategoryKey: 'karahi',
          routingMethod: 'direct_route',
          targetPrinterId: MOCK_PRINTER_KITCHEN.id,
          targetPrinterName: MOCK_PRINTER_KITCHEN.name,
        },
        {
          item: { product: { id: 'p2', name: 'Chicken Handi' }, quantity: 2 },
          resolvedCategory: 'Handi',
          canonicalCategoryKey: 'handi',
          routingMethod: 'direct_route',
          targetPrinterId: MOCK_PRINTER_KITCHEN.id,
          targetPrinterName: MOCK_PRINTER_KITCHEN.name,
        },
      ],
      orderContext: MOCK_ORDER_CONTEXT,
      routingMethod: 'direct_route',
      itemCount: 2,
      totalQuantity: 3,
      createdAt: new Date().toISOString(),
    };

    const html = renderKOTHtml(job);
    assert(
      'TEST 3: Multiple Items -> All assigned items are rendered in table',
      html.includes('Chicken Karahi') &&
        html.includes('Chicken Handi') &&
        html.includes('Main Kitchen Printer')
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Revision KOT (isRevision = true)
  // ───────────────────────────────────────────────────────────────────────────
  {
    const revisionContext: KOTOrderContext = {
      ...MOCK_ORDER_CONTEXT,
      revisionNumber: 2,
      isRevision: true,
    };
    const job: KOTPrintJob = {
      jobId: 'job_4',
      printerId: MOCK_PRINTER_KITCHEN.id,
      printer: MOCK_PRINTER_KITCHEN,
      items: [
        {
          item: { product: { id: 'p1', name: 'Extra Naan' }, quantity: 4 },
          resolvedCategory: 'Tandoor',
          canonicalCategoryKey: 'tandoor',
          routingMethod: 'direct_route',
          targetPrinterId: MOCK_PRINTER_KITCHEN.id,
          targetPrinterName: MOCK_PRINTER_KITCHEN.name,
        },
      ],
      orderContext: revisionContext,
      routingMethod: 'direct_route',
      itemCount: 1,
      totalQuantity: 4,
      createdAt: new Date().toISOString(),
    };

    const html = renderKOTHtml(job);
    assert(
      'TEST 4: Revision KOT renders revision title and separator line',
      html.includes('KOT REVISION #2') &&
        html.includes('── ADD ITEMS BELOW ──') &&
        html.includes('*** KOT EDIT #2 COPY ***') &&
        html.includes('Extra Naan')
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: HTML Escaping (Prevents script injection)
  // ───────────────────────────────────────────────────────────────────────────
  {
    const maliciousContext: KOTOrderContext = {
      ...MOCK_ORDER_CONTEXT,
      serverName: '<script>alert("hacked")</script>',
      notes: '<img src=x onerror=alert(1)>',
    };
    const job: KOTPrintJob = {
      jobId: 'job_5',
      printerId: MOCK_PRINTER_KITCHEN.id,
      printer: MOCK_PRINTER_KITCHEN,
      items: [
        {
          item: {
            name: 'Special <script>alert("xss")</script> Dish & "Spicy"',
            quantity: 1,
          },
          resolvedCategory: 'Special',
          canonicalCategoryKey: 'special',
          routingMethod: 'direct_route',
          targetPrinterId: MOCK_PRINTER_KITCHEN.id,
          targetPrinterName: MOCK_PRINTER_KITCHEN.name,
        },
      ],
      orderContext: maliciousContext,
      routingMethod: 'direct_route',
      itemCount: 1,
      totalQuantity: 1,
      createdAt: new Date().toISOString(),
    };

    const html = renderKOTHtml(job);
    assert(
      'TEST 5: HTML Escaping -> Raw scripts and tags are escaped to &lt;script&gt;',
      !html.includes('<script>') &&
        !html.includes('alert("xss")') &&
        html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;') &&
        html.includes('&amp; &quot;Spicy&quot;') &&
        html.includes('&lt;img src=x')
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: No External Resources (Pure self-contained HTML)
  // ───────────────────────────────────────────────────────────────────────────
  {
    const job: KOTPrintJob = {
      jobId: 'job_6',
      printerId: MOCK_PRINTER_KITCHEN.id,
      printer: MOCK_PRINTER_KITCHEN,
      items: [
        {
          item: { product: { id: 'p1', name: 'Chicken Karahi' }, quantity: 1 },
          resolvedCategory: 'Karahi',
          canonicalCategoryKey: 'karahi',
          routingMethod: 'direct_route',
          targetPrinterId: MOCK_PRINTER_KITCHEN.id,
          targetPrinterName: MOCK_PRINTER_KITCHEN.name,
        },
      ],
      orderContext: MOCK_ORDER_CONTEXT,
      routingMethod: 'direct_route',
      itemCount: 1,
      totalQuantity: 1,
      createdAt: new Date().toISOString(),
    };

    const html = renderKOTHtml(job);
    assert(
      'TEST 6: No External Resources -> No http://, https://, or script tags in HTML',
      !html.includes('http://') &&
        !html.includes('https://') &&
        !html.includes('<script src=') &&
        !html.includes('@import url')
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Required Order Context Meta
  // ───────────────────────────────────────────────────────────────────────────
  {
    const job: KOTPrintJob = {
      jobId: 'job_7',
      printerId: MOCK_PRINTER_KITCHEN.id,
      printer: MOCK_PRINTER_KITCHEN,
      items: [
        {
          item: { product: { id: 'p1', name: 'Chicken Karahi' }, quantity: 1 },
          resolvedCategory: 'Karahi',
          canonicalCategoryKey: 'karahi',
          routingMethod: 'direct_route',
          targetPrinterId: MOCK_PRINTER_KITCHEN.id,
          targetPrinterName: MOCK_PRINTER_KITCHEN.name,
        },
      ],
      orderContext: {
        ...MOCK_ORDER_CONTEXT,
        tableId: 'T-04',
        orderNumber: '05',
        orderType: 'dine_in',
        serverName: '[waiter] Ali Khan',
        customer: { id: 'c1', name: 'Ahmed Bilal', phone: '03001234567', email: '', loyaltyPoints: 0, totalSpent: 0, visitCount: 1, creditBalance: 0 },
      },
      routingMethod: 'direct_route',
      itemCount: 1,
      totalQuantity: 1,
      createdAt: new Date().toISOString(),
    };

    const html = renderKOTHtml(job);
    assert(
      'TEST 7: Order Context -> Table, Order #, Server, Customer, Type present',
      html.includes('ORDER #05') &&
        html.includes('DINE IN') &&
        html.includes('T-04') &&
        html.includes('Server: Ali Khan') &&
        html.includes('Customer: Ahmed Bilal')
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Empty Items Validation
  // ───────────────────────────────────────────────────────────────────────────
  {
    const emptyJob: KOTPrintJob = {
      jobId: 'job_8',
      printerId: MOCK_PRINTER_KITCHEN.id,
      printer: MOCK_PRINTER_KITCHEN,
      items: [],
      orderContext: MOCK_ORDER_CONTEXT,
      routingMethod: 'direct_route',
      itemCount: 0,
      totalQuantity: 0,
      createdAt: new Date().toISOString(),
    };

    let threw = false;
    try {
      renderKOTHtml(emptyJob);
    } catch {
      threw = true;
    }

    assert(
      'TEST 8: Empty Items -> Throws error on empty job',
      threw === true
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9: Duplicate Badge Rendering
  // ───────────────────────────────────────────────────────────────────────────
  {
    const duplicateJob: KOTPrintJob = {
      jobId: 'job_9',
      printerId: MOCK_PRINTER_KITCHEN.id,
      printer: MOCK_PRINTER_KITCHEN,
      items: [
        {
          item: { product: { id: 'p1', name: 'Chicken Karahi' }, quantity: 1 },
          resolvedCategory: 'Karahi',
          canonicalCategoryKey: 'karahi',
          routingMethod: 'direct_route',
          targetPrinterId: MOCK_PRINTER_KITCHEN.id,
          targetPrinterName: MOCK_PRINTER_KITCHEN.name,
        },
      ],
      orderContext: { ...MOCK_ORDER_CONTEXT, isDuplicate: true },
      routingMethod: 'direct_route',
      itemCount: 1,
      totalQuantity: 1,
      createdAt: new Date().toISOString(),
    };

    const html = renderKOTHtml(duplicateJob);
    assert(
      'TEST 9: Duplicate Badge -> Renders *** DUPLICATE *** when isDuplicate is true',
      html.includes('*** DUPLICATE ***')
    );
  }

  return results;
}
