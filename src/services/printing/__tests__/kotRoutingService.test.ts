import { routeKOT } from '../kotRoutingService';
import {
  KOTRoutingConfig,
  KOTOrderContext,
  PrintableKOTItem,
} from '../kotRoutingTypes';
import { TenantPrinter, PrinterCategoryRoute } from '@/types/printer';

// ─── TEST FIXTURES ────────────────────────────────────────────────────────────

const TENANT_A = 'tenant_uuid_1111';
const TENANT_B = 'tenant_uuid_2222';

const MOCK_PRINTER_KITCHEN: TenantPrinter = {
  id: 'printer_kitchen_1',
  tenant_id: TENANT_A,
  name: 'Main Kitchen Printer',
  printer_type: 'network',
  ip_address: '192.168.1.100',
  port: 9100,
  is_default: true,
  is_active: true,
};

const MOCK_PRINTER_GRILL: TenantPrinter = {
  id: 'printer_grill_2',
  tenant_id: TENANT_A,
  name: 'BBQ Grill Printer',
  printer_type: 'system',
  device_name: 'EPSON_TM_T88VI_GRILL',
  is_default: false,
  is_active: true,
};

const MOCK_PRINTER_BAR: TenantPrinter = {
  id: 'printer_bar_3',
  tenant_id: TENANT_A,
  name: 'Beverages Bar Printer',
  printer_type: 'usb',
  device_name: 'POS80_BAR',
  is_default: false,
  is_active: true,
};

const MOCK_PRINTER_BACKUP: TenantPrinter = {
  id: 'printer_backup_4',
  tenant_id: TENANT_A,
  name: 'Backup Kitchen Printer',
  printer_type: 'network',
  ip_address: '192.168.1.101',
  port: 9100,
  is_default: false,
  is_active: true,
};

const MOCK_PRINTER_INACTIVE: TenantPrinter = {
  id: 'printer_inactive_5',
  tenant_id: TENANT_A,
  name: 'Offline Station Printer',
  printer_type: 'network',
  ip_address: '192.168.1.105',
  port: 9100,
  is_default: false,
  is_active: false,
};

const MOCK_PRINTER_TENANT_B: TenantPrinter = {
  id: 'printer_tenant_b_6',
  tenant_id: TENANT_B,
  name: 'Tenant B Kitchen',
  printer_type: 'system',
  device_name: 'TENANT_B_POS',
  is_default: true,
  is_active: true,
};

const MOCK_ORDER_CONTEXT: KOTOrderContext = {
  orderId: 'order_uuid_123',
  orderNumber: '08',
  orderType: 'dine_in',
  tableId: 'T-04',
  serverName: 'Ali Server',
  cashierName: 'Cashier 1',
  createdAt: new Date('2026-09-02T12:00:00Z'),
  revisionNumber: 1,
};

// ─── TEST SUITE EXECUTION ─────────────────────────────────────────────────────

export function runKOTRoutingTests(): { name: string; passed: boolean; details?: string }[] {
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
  // TEST 1: One item, one category, one printer -> One job
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi' }, quantity: 1 },
    ];
    const routes: PrinterCategoryRoute[] = [
      { id: 'r1', tenant_id: TENANT_A, category_name: 'karahi', printer_id: MOCK_PRINTER_KITCHEN.id },
    ];
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_KITCHEN],
      routes,
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    assert(
      'TEST 1: One item, one category, one printer -> One job',
      res.jobs.length === 1 &&
        res.jobs[0].printerId === MOCK_PRINTER_KITCHEN.id &&
        res.jobs[0].items.length === 1 &&
        res.jobs[0].items[0].item.product?.name === 'Chicken Karahi' &&
        res.status === 'routed'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Two items, same printer -> One printer job containing both items
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi' }, quantity: 1 },
      { product: { id: 'p2', name: 'Mutton Karahi', category: 'Karahi' }, quantity: 2 },
    ];
    const routes: PrinterCategoryRoute[] = [
      { id: 'r1', tenant_id: TENANT_A, category_name: 'karahi', printer_id: MOCK_PRINTER_KITCHEN.id },
    ];
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_KITCHEN],
      routes,
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    assert(
      'TEST 2: Two items, same printer -> One printer job containing both items',
      res.jobs.length === 1 &&
        res.jobs[0].printerId === MOCK_PRINTER_KITCHEN.id &&
        res.jobs[0].items.length === 2 &&
        res.jobs[0].totalQuantity === 3 &&
        res.status === 'routed'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Two categories, two printers -> Two jobs
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi' }, quantity: 1 },
      { product: { id: 'p3', name: 'Chicken Tikka', category: 'Bar.B.Q' }, quantity: 2 },
    ];
    const routes: PrinterCategoryRoute[] = [
      { id: 'r1', tenant_id: TENANT_A, category_name: 'karahi', printer_id: MOCK_PRINTER_KITCHEN.id },
      { id: 'r2', tenant_id: TENANT_A, category_name: 'bar.b.q', printer_id: MOCK_PRINTER_GRILL.id },
    ];
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_KITCHEN, MOCK_PRINTER_GRILL],
      routes,
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    const kitchenJob = res.jobs.find((j) => j.printerId === MOCK_PRINTER_KITCHEN.id);
    const grillJob = res.jobs.find((j) => j.printerId === MOCK_PRINTER_GRILL.id);

    assert(
      'TEST 3: Two categories, two printers -> Two jobs',
      res.jobs.length === 2 &&
        !!kitchenJob &&
        kitchenJob.items.length === 1 &&
        !!grillJob &&
        grillJob.items.length === 1 &&
        res.status === 'routed'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: One category, two printers -> Two jobs containing the relevant item
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p3', name: 'Mutton Seekh Kabab', category: 'Bar.B.Q' }, quantity: 4 },
    ];
    const routes: PrinterCategoryRoute[] = [
      { id: 'r1', tenant_id: TENANT_A, category_name: 'bar.b.q', printer_id: MOCK_PRINTER_GRILL.id },
      { id: 'r2', tenant_id: TENANT_A, category_name: 'bar.b.q', printer_id: MOCK_PRINTER_BACKUP.id },
    ];
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_GRILL, MOCK_PRINTER_BACKUP],
      routes,
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    const grillJob = res.jobs.find((j) => j.printerId === MOCK_PRINTER_GRILL.id);
    const backupJob = res.jobs.find((j) => j.printerId === MOCK_PRINTER_BACKUP.id);

    assert(
      'TEST 4: One category, two printers -> Two jobs containing the relevant item',
      res.jobs.length === 2 &&
        !!grillJob &&
        grillJob.items[0].item.product?.name === 'Mutton Seekh Kabab' &&
        !!backupJob &&
        backupJob.items[0].item.product?.name === 'Mutton Seekh Kabab' &&
        res.status === 'routed'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: No category route, default printer exists -> Fallback job
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p99', name: 'Mineral Water 1.5L', category: 'Unmapped Drink' }, quantity: 2 },
    ];
    const routes: PrinterCategoryRoute[] = []; // No routes
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_KITCHEN], // is_default = true
      routes,
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    assert(
      'TEST 5: No category route, default printer exists -> Fallback job',
      res.jobs.length === 1 &&
        res.jobs[0].printerId === MOCK_PRINTER_KITCHEN.id &&
        res.jobs[0].routingMethod === 'fallback_default' &&
        res.status === 'fallback_routed'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: No category route, no default printer -> Unroutable item
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p99', name: 'Fresh Salad', category: 'Salad' }, quantity: 1 },
    ];
    const printerWithoutDefault: TenantPrinter = { ...MOCK_PRINTER_GRILL, is_default: false };
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [printerWithoutDefault],
      routes: [],
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    assert(
      'TEST 6: No category route, no default printer -> Unroutable item',
      res.jobs.length === 0 &&
        res.unroutableItems.length === 1 &&
        res.unroutableItems[0].reason === 'NO_MATCHING_ROUTE_AND_NO_DEFAULT' &&
        res.status === 'unroutable'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Category route exists, printer inactive, default active -> Fallback
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p4', name: 'Mint Margarita', category: 'Beverages' }, quantity: 2 },
    ];
    const routes: PrinterCategoryRoute[] = [
      { id: 'r1', tenant_id: TENANT_A, category_name: 'beverages', printer_id: MOCK_PRINTER_INACTIVE.id },
    ];
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_INACTIVE, MOCK_PRINTER_KITCHEN], // MOCK_PRINTER_KITCHEN is default & active
      routes,
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    assert(
      'TEST 7: Category route exists, printer inactive, default active -> Fallback',
      res.jobs.length === 1 &&
        res.jobs[0].printerId === MOCK_PRINTER_KITCHEN.id &&
        res.jobs[0].routingMethod === 'fallback_default' &&
        res.status === 'fallback_routed'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Category unresolved, default exists -> Fallback
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { name: 'Custom Off-Menu Special', quantity: 1 }, // No product.category or category
    ];
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_KITCHEN],
      routes: [],
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    assert(
      'TEST 8: Category unresolved, default exists -> Fallback',
      res.jobs.length === 1 &&
        res.jobs[0].printerId === MOCK_PRINTER_KITCHEN.id &&
        res.jobs[0].routingMethod === 'fallback_default' &&
        res.status === 'fallback_routed'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9: Category unresolved, no default -> Unroutable
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { name: 'Unknown Item Without Category', quantity: 1 },
    ];
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_GRILL], // Grill is not default
      routes: [],
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    assert(
      'TEST 9: Category unresolved, no default -> Unroutable',
      res.jobs.length === 0 &&
        res.unroutableItems.length === 1 &&
        res.unroutableItems[0].reason === 'CATEGORY_UNRESOLVED_AND_NO_DEFAULT' &&
        res.status === 'unroutable'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10: Multiple items where one is unroutable -> Other valid printer jobs still returned
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi' }, quantity: 1 },
      { product: { id: 'p99', name: 'Mystery Item', category: 'NoRouteCategory' }, quantity: 1 },
    ];
    const routes: PrinterCategoryRoute[] = [
      { id: 'r1', tenant_id: TENANT_A, category_name: 'karahi', printer_id: MOCK_PRINTER_GRILL.id },
    ];
    // Notice: MOCK_PRINTER_GRILL is NOT default, so Mystery Item has no route & no fallback
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_GRILL],
      routes,
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    assert(
      'TEST 10: Multiple items where one is unroutable -> Other valid printer jobs still returned',
      res.jobs.length === 1 &&
        res.jobs[0].printerId === MOCK_PRINTER_GRILL.id &&
        res.jobs[0].items[0].item.product?.name === 'Chicken Karahi' &&
        res.unroutableItems.length === 1 &&
        res.unroutableItems[0].item.product?.name === 'Mystery Item' &&
        res.status === 'partially_routed'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 11: Duplicate route configuration accidentally supplied -> Item appears once per printer job
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi' }, quantity: 1 },
    ];
    // Accidental duplicate route rows for the same category -> same printer
    const routes: PrinterCategoryRoute[] = [
      { id: 'r1', tenant_id: TENANT_A, category_name: 'karahi', printer_id: MOCK_PRINTER_KITCHEN.id },
      { id: 'r2', tenant_id: TENANT_A, category_name: 'karahi', printer_id: MOCK_PRINTER_KITCHEN.id },
    ];
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_KITCHEN],
      routes,
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    assert(
      'TEST 11: Duplicate route configuration accidentally supplied -> Item appears once per printer job',
      res.jobs.length === 1 &&
        res.jobs[0].items.length === 1 &&
        res.jobs[0].items[0].item.product?.name === 'Chicken Karahi'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 12: Same printer assigned to multiple categories -> One combined printer job
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi' }, quantity: 1 },
      { product: { id: 'p2', name: 'Chicken Handi', category: 'Handi' }, quantity: 1 },
      { product: { id: 'p5', name: 'Chowmein', category: 'Chinese' }, quantity: 1 },
    ];
    const routes: PrinterCategoryRoute[] = [
      { id: 'r1', tenant_id: TENANT_A, category_name: 'karahi', printer_id: MOCK_PRINTER_KITCHEN.id },
      { id: 'r2', tenant_id: TENANT_A, category_name: 'handi', printer_id: MOCK_PRINTER_KITCHEN.id },
      { id: 'r3', tenant_id: TENANT_A, category_name: 'chinese', printer_id: MOCK_PRINTER_KITCHEN.id },
    ];
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_KITCHEN],
      routes,
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    assert(
      'TEST 12: Same printer assigned to multiple categories -> One combined printer job',
      res.jobs.length === 1 &&
        res.jobs[0].printerId === MOCK_PRINTER_KITCHEN.id &&
        res.jobs[0].items.length === 3 &&
        res.jobs[0].totalQuantity === 3 &&
        res.status === 'routed'
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 13: Delta input containing only newly-added items -> Only supplied items appear in output
  // ───────────────────────────────────────────────────────────────────────────
  {
    // Simulation: Order had 2 Karahi earlier. Now user added 1 Karahi and 2 Tikka.
    // The delta passed to the router contains ONLY the newly-added quantities.
    const deltaItems: PrintableKOTItem[] = [
      { product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi' }, quantity: 1 },
      { product: { id: 'p3', name: 'Chicken Tikka', category: 'Bar.B.Q' }, quantity: 2 },
    ];
    const routes: PrinterCategoryRoute[] = [
      { id: 'r1', tenant_id: TENANT_A, category_name: 'karahi', printer_id: MOCK_PRINTER_KITCHEN.id },
      { id: 'r2', tenant_id: TENANT_A, category_name: 'bar.b.q', printer_id: MOCK_PRINTER_GRILL.id },
    ];
    const revisionContext: KOTOrderContext = {
      ...MOCK_ORDER_CONTEXT,
      revisionNumber: 2,
      isRevision: true,
    };
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A,
      printers: [MOCK_PRINTER_KITCHEN, MOCK_PRINTER_GRILL],
      routes,
    };

    const res = routeKOT({ items: deltaItems, orderContext: revisionContext, config });
    const kitchenJob = res.jobs.find((j) => j.printerId === MOCK_PRINTER_KITCHEN.id);
    const grillJob = res.jobs.find((j) => j.printerId === MOCK_PRINTER_GRILL.id);

    assert(
      'TEST 13: Delta input containing only newly-added items -> Only supplied items appear in routing output',
      res.jobs.length === 2 &&
        !!kitchenJob &&
        kitchenJob.items.length === 1 &&
        kitchenJob.items[0].item.quantity === 1 &&
        kitchenJob.orderContext.isRevision === true &&
        kitchenJob.orderContext.revisionNumber === 2 &&
        !!grillJob &&
        grillJob.items.length === 1 &&
        grillJob.items[0].item.quantity === 2
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 14 (BONUS): Tenant isolation in routing config
  // ───────────────────────────────────────────────────────────────────────────
  {
    const items: PrintableKOTItem[] = [
      { product: { id: 'p1', name: 'Chicken Karahi', category: 'Karahi' }, quantity: 1 },
    ];
    // Route pointing to Tenant B's printer
    const routes: PrinterCategoryRoute[] = [
      { id: 'r1', tenant_id: TENANT_B, category_name: 'karahi', printer_id: MOCK_PRINTER_TENANT_B.id },
    ];
    const config: KOTRoutingConfig = {
      tenantId: TENANT_A, // Request is for Tenant A
      printers: [MOCK_PRINTER_TENANT_B, MOCK_PRINTER_KITCHEN],
      routes,
    };

    const res = routeKOT({ items, orderContext: MOCK_ORDER_CONTEXT, config });
    // Tenant B printer and routes must be ignored; falls back to Tenant A's default printer
    assert(
      'TEST 14: Tenant isolation -> Foreign tenant printers and routes are ignored',
      res.jobs.length === 1 &&
        res.jobs[0].printerId === MOCK_PRINTER_KITCHEN.id &&
        res.jobs[0].printer.tenant_id === TENANT_A
    );
  }

  return results;
}
