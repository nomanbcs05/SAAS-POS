import { TenantPrinter } from '@/types/printer';
import {
  PrintableKOTItem,
  KOTOrderContext,
  KOTRoutingConfig,
  KOTRoutingResult,
  KOTRoutingStatus,
  KOTPrintJob,
  RoutedKOTItem,
  UnroutableKOTItem,
  UnroutableReason,
} from './kotRoutingTypes';
import {
  resolveItemCategory,
  getItemIdentifier,
} from './categoryResolver';

/**
 * Parameter payload for the pure routeKOT function.
 */
export interface RouteKOTParams {
  /** Array of items to route (supports full cart items, order items, or delta items) */
  items: PrintableKOTItem[];
  /** Order contextual information (table, customer, order number, revision, etc.) */
  orderContext: KOTOrderContext;
  /** Active tenant printer and routing configuration */
  config: KOTRoutingConfig;
}

/**
 * Pure, deterministic Multi-Printer KOT Routing Engine.
 *
 * Responsibilities:
 * 1. Resolves category for every supplied item.
 * 2. Matches category to active destination station printers.
 * 3. Supports 1 Category -> Multiple Printers (item duplicated across station tickets).
 * 4. Combines multiple items for the same printer into 1 unified ticket.
 * 5. Safely routes unmapped or unresolvable items to the active default fallback printer.
 * 6. Generates structured, isolated unroutable reports when no fallback printer exists.
 * 7. Deduplicates identical item line entries within the same printer ticket.
 *
 * Constraints:
 * - Pure data transformation only.
 * - No React, DOM, Electron, network, or printing side-effects.
 */
export function routeKOT({ items, orderContext, config }: RouteKOTParams): KOTRoutingResult {
  const { tenantId, printers, routes } = config;

  // ─── 1. EMPTY ITEMS GUARD ───────────────────────────────────────────────────
  if (!items || items.length === 0) {
    return {
      status: 'empty',
      jobs: [],
      unroutableItems: [],
      summary: {
        totalItemsReceived: 0,
        totalItemsRouted: 0,
        totalJobsCreated: 0,
        directRouteJobsCount: 0,
        fallbackJobsCount: 0,
        unroutableCount: 0,
        activeDefaultPrinterId: null,
      },
    };
  }

  // ─── 2. ACTIVE PRINTERS & DEFAULT FALLBACK RESOLUTION ───────────────────────
  // Strictly filter printers to active tenant membership and active status
  const activeTenantPrinters = (printers || []).filter(
    (p) => p.tenant_id === tenantId && p.is_active === true
  );

  const activePrintersMap = new Map<string, TenantPrinter>();
  let activeDefaultPrinter: TenantPrinter | null = null;

  for (const printer of activeTenantPrinters) {
    activePrintersMap.set(printer.id, printer);
    if (printer.is_default && !activeDefaultPrinter) {
      activeDefaultPrinter = printer;
    }
  }

  // ─── 3. CATEGORY ROUTE MAP PREPARATION ──────────────────────────────────────
  // Build lookup: canonicalCategoryKey -> active TenantPrinter[]
  const categoryToPrintersMap = new Map<string, TenantPrinter[]>();

  for (const route of routes || []) {
    // Only process routes belonging to the target tenant
    if (route.tenant_id !== tenantId) {
      continue;
    }

    const canonicalKey = (route.category_name || '').trim().toLowerCase();
    if (!canonicalKey) {
      continue;
    }

    const matchedPrinter = activePrintersMap.get(route.printer_id);
    // Route is only valid if destination printer is currently active
    if (matchedPrinter) {
      const existing = categoryToPrintersMap.get(canonicalKey) || [];
      // Prevent duplicate route mapping for the same category -> same printer
      if (!existing.some((p) => p.id === matchedPrinter.id)) {
        categoryToPrintersMap.set(canonicalKey, [...existing, matchedPrinter]);
      }
    }
  }

  // ─── 4. ITEM ROUTING AND GROUPING ───────────────────────────────────────────
  // Map: printerId -> { printer: TenantPrinter, items: RoutedKOTItem[], itemIds: Set<string> }
  const printerBuckets = new Map<
    string,
    {
      printer: TenantPrinter;
      items: RoutedKOTItem[];
      seenItemIds: Set<string>;
    }
  >();

  const unroutableItems: UnroutableKOTItem[] = [];
  let directRoutedItemCount = 0;
  let fallbackRoutedItemCount = 0;

  items.forEach((item, index) => {
    const itemUniqueId = getItemIdentifier(item, index);
    const categoryResolution = resolveItemCategory(item);
    const resolvedCategoryName = categoryResolution.displayName || 'Uncategorized';
    const canonicalKey = categoryResolution.canonicalKey || '';

    let destinationPrinters: TenantPrinter[] = [];
    let routingMethod: 'direct_route' | 'fallback_default' = 'direct_route';

    // Path A: Category resolved and active routes exist
    if (categoryResolution.isResolved && categoryToPrintersMap.has(canonicalKey)) {
      destinationPrinters = categoryToPrintersMap.get(canonicalKey) || [];
      routingMethod = 'direct_route';
    }

    // Path B: Fallback required (unmapped category, inactive printer route, or unresolved category)
    if (destinationPrinters.length === 0) {
      if (activeDefaultPrinter) {
        destinationPrinters = [activeDefaultPrinter];
        routingMethod = 'fallback_default';
      } else {
        // Path C: No destination printer and no active default printer -> Unroutable
        let reason: UnroutableReason = 'NO_ACTIVE_DEFAULT_PRINTER';
        let message = `Item "${item.product?.name || item.product_name || item.name || 'Unnamed'}" could not be routed because no active default KOT printer is configured for tenant ${tenantId}.`;

        if (!categoryResolution.isResolved) {
          reason = 'CATEGORY_UNRESOLVED_AND_NO_DEFAULT';
          message = `Item category could not be determined and no active default KOT printer is configured.`;
        } else {
          // Check if routes existed but all mapped printers were inactive
          const hasConfiguredInactiveRoute = (routes || []).some(
            (r) =>
              r.tenant_id === tenantId &&
              (r.category_name || '').trim().toLowerCase() === canonicalKey
          );
          if (hasConfiguredInactiveRoute) {
            reason = 'ALL_MAPPED_PRINTERS_INACTIVE_AND_NO_DEFAULT';
            message = `Category "${resolvedCategoryName}" is assigned to printers, but all assigned printers are inactive and no default KOT printer is available.`;
          } else {
            reason = 'NO_MATCHING_ROUTE_AND_NO_DEFAULT';
            message = `No station route configured for category "${resolvedCategoryName}" and no active default KOT printer is available.`;
          }
        }

        unroutableItems.push({
          item,
          resolvedCategory: categoryResolution.displayName,
          canonicalCategoryKey: categoryResolution.canonicalKey,
          reason,
          message,
        });
        return; // Move to next item
      }
    }

    // Track metrics
    if (routingMethod === 'direct_route') {
      directRoutedItemCount += 1;
    } else {
      fallbackRoutedItemCount += 1;
    }

    // Assign item to each destination printer bucket
    for (const printer of destinationPrinters) {
      if (!printerBuckets.has(printer.id)) {
        printerBuckets.set(printer.id, {
          printer,
          items: [],
          seenItemIds: new Set<string>(),
        });
      }

      const bucket = printerBuckets.get(printer.id)!;

      // Prevent accidental duplicate entry of the same item within the same printer ticket
      if (!bucket.seenItemIds.has(itemUniqueId)) {
        bucket.seenItemIds.add(itemUniqueId);
        bucket.items.push({
          item,
          resolvedCategory: resolvedCategoryName,
          canonicalCategoryKey: canonicalKey,
          routingMethod,
          targetPrinterId: printer.id,
          targetPrinterName: printer.name,
        });
      }
    }
  });

  // ─── 5. STRUCTURED PRINT JOBS CREATION ──────────────────────────────────────
  const jobs: KOTPrintJob[] = [];
  const timestamp = new Date().toISOString();
  let jobIndex = 0;

  for (const [, bucket] of printerBuckets.entries()) {
    if (bucket.items.length === 0) {
      continue;
    }

    jobIndex += 1;
    const hasDirect = bucket.items.some((i) => i.routingMethod === 'direct_route');
    const hasFallback = bucket.items.some((i) => i.routingMethod === 'fallback_default');
    const jobRoutingMethod: 'direct_route' | 'fallback_default' | 'mixed' =
      hasDirect && hasFallback
        ? 'mixed'
        : hasDirect
        ? 'direct_route'
        : 'fallback_default';

    const totalQuantity = bucket.items.reduce(
      (sum, itemWrapper) => sum + (itemWrapper.item.quantity || 1),
      0
    );

    const safeOrderNum = orderContext.orderNumber || '00';
    const jobId = `kot_job_${tenantId}_${bucket.printer.id}_${safeOrderNum}_${jobIndex}`;

    jobs.push({
      jobId,
      printerId: bucket.printer.id,
      printer: bucket.printer,
      items: bucket.items,
      orderContext,
      routingMethod: jobRoutingMethod,
      itemCount: bucket.items.length,
      totalQuantity,
      createdAt: timestamp,
    });
  }

  // ─── 6. STATUS AND METRICS DETERMINATION ────────────────────────────────────
  let status: KOTRoutingStatus = 'routed';
  const totalItemsReceived = items.length;
  const totalItemsRouted = directRoutedItemCount + fallbackRoutedItemCount;

  if (totalItemsRouted === 0 && unroutableItems.length > 0) {
    status = 'unroutable';
  } else if (unroutableItems.length > 0 && totalItemsRouted > 0) {
    status = 'partially_routed';
  } else if (directRoutedItemCount === 0 && fallbackRoutedItemCount > 0) {
    status = 'fallback_routed';
  } else {
    status = 'routed';
  }

  const directRouteJobsCount = jobs.filter((j) => j.routingMethod === 'direct_route').length;
  const fallbackJobsCount = jobs.filter((j) => j.routingMethod === 'fallback_default').length;

  return {
    status,
    jobs,
    unroutableItems,
    summary: {
      totalItemsReceived,
      totalItemsRouted,
      totalJobsCreated: jobs.length,
      directRouteJobsCount,
      fallbackJobsCount,
      unroutableCount: unroutableItems.length,
      activeDefaultPrinterId: activeDefaultPrinter ? activeDefaultPrinter.id : null,
    },
  };
}
