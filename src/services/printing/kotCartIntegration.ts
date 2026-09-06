import { TenantPrinter, PrinterCategoryRoute } from '@/types/printer';
import {
  KOTPrintJob,
  KOTOrderContext,
  PrintableKOTItem,
} from './kotRoutingTypes';
import { routeKOT } from './kotRoutingService';
import {
  dispatchKOTPrintJobs,
  KOTDispatchOptions,
  ElectronPrintingAPI,
} from './kotPrintDispatcher';
import { isDesktop } from '@/lib/env';
import { toast } from 'sonner';

/**
 * Parameters for verifying whether the multi-printer KOT pipeline should activate.
 */
export interface ShouldUseMultiPrinterParams {
  tenant?: {
    id?: string;
    multi_printer_kot_enabled?: boolean;
    [key: string]: unknown;
  } | null;
  printers?: TenantPrinter[];
  routes?: PrinterCategoryRoute[];
  isDesktopEnv?: boolean;
  electronApi?: ElectronPrintingAPI;
}

/**
 * Validates whether the environment and configuration are strictly ready
 * for multi-printer KOT routing.
 *
 * SAFETY CONTRACT:
 * Returns false if:
 * 1. tenant.multi_printer_kot_enabled !== true
 * 2. Not running in desktop/Electron environment
 * 3. window.electronAPI.printTargeted is not available
 * 4. No printers configured
 * 5. No active printer with a valid device_name
 * 6. No active default printer
 *
 * If this returns false, caller MUST use existing legacy handlePrintKOT().
 */
export function shouldUseMultiPrinterKOT(params: ShouldUseMultiPrinterParams): boolean {
  const {
    tenant,
    printers = [],
    isDesktopEnv = isDesktop(),
    electronApi = (typeof window !== 'undefined'
      ? (window.electronAPI as ElectronPrintingAPI)
      : undefined),
  } = params;

  // 1. Feature flag must be explicitly enabled
  if (tenant?.multi_printer_kot_enabled !== true) {
    return false;
  }

  // 2. Desktop/Electron environment check
  if (!isDesktopEnv) {
    return false;
  }

  // 3. Targeted print IPC must exist
  if (!electronApi || typeof electronApi.printTargeted !== 'function') {
    return false;
  }

  // 4. Valid printer configuration: must have at least one active printer with a valid device_name
  if (!Array.isArray(printers) || printers.length === 0) {
    return false;
  }

  const activePrinters = printers.filter(
    (p) => p && p.is_active !== false && typeof p.device_name === 'string' && p.device_name.trim().length > 0
  );

  if (activePrinters.length === 0) {
    return false;
  }

  // 5. Must have an active default printer to guarantee fallback safety
  const hasActiveDefault = activePrinters.some((p) => p.is_default);
  if (!hasActiveDefault) {
    return false;
  }

  return true;
}

/**
 * Converts CartItem or raw order item structures into PrintableKOTItem.
 */
export function mapCartItemsToPrintable(items: Array<Record<string, unknown>>): PrintableKOTItem[] {
  if (!Array.isArray(items)) return [];

  return items.map((it) => {
    const product = it.product as Record<string, unknown> | undefined;
    return {
      id: (it.id || it.product_id || product?.id) as string | undefined,
      product_id: (it.product_id || product?.id) as string | undefined,
      product: product
        ? {
            id: String(product.id || ''),
            name: String(product.name || 'Item'),
            sku: product.sku as string | undefined,
            category: product.category as string | undefined,
            price: typeof product.price === 'number' ? product.price : undefined,
          }
        : undefined,
      name: (product?.name || it.product_name || it.name || 'Item') as string,
      product_name: (product?.name || it.product_name || it.name || 'Item') as string,
      category: (product?.category || it.product_category || it.category) as string | undefined,
      product_category: (product?.category || it.product_category || it.category) as string | undefined,
      quantity: typeof it.quantity === 'number' ? it.quantity : 1,
      qtyMeasureLabel: it.qtyMeasureLabel as string | undefined,
      notes: (it.notes || it.specialInstructions) as string | undefined,
      specialInstructions: (it.specialInstructions || it.notes) as string | undefined,
      price: typeof it.price === 'number' ? it.price : (product?.price as number | undefined),
    };
  });
}

/**
 * Builds KOTOrderContext matching KOT.tsx expectations.
 */
export function buildKOTOrderContext(orderData: Record<string, unknown>): KOTOrderContext {
  const previousItems = orderData?.previousItems as unknown[] | undefined;
  const newlyAddedItems = orderData?.newlyAddedItems as unknown[] | undefined;
  const isRevision =
    (typeof orderData?.revisionNumber === 'number' && orderData.revisionNumber > 1) ||
    (previousItems && previousItems.length > 0) ||
    (newlyAddedItems && newlyAddedItems.length > 0);

  return {
    orderId: orderData?.id ? String(orderData.id) : undefined,
    orderNumber: String(orderData?.orderNumber || '00'),
    orderType: (orderData?.orderType as 'dine_in' | 'take_away' | 'delivery') || 'dine_in',
    tableId: (orderData?.tableId as string | number | null) ?? null,
    customer: (orderData?.customer as KOTOrderContext['customer']) ?? null,
    serverName: (orderData?.serverName as string | null) ?? null,
    rider: (orderData?.rider as KOTOrderContext['rider']) ?? null,
    cashierName: String(orderData?.cashierName || 'Cashier'),
    createdAt: orderData?.createdAt ? new Date(orderData.createdAt as string | number | Date) : new Date(),
    revisionNumber:
      typeof orderData?.revisionNumber === 'number' ? orderData.revisionNumber : undefined,
    isRevision,
    isDuplicate: false,
    notes: (orderData?.notes || orderData?.specialInstructions || null) as string | null,
  };
}

/**
 * Parameters for executing the multi-printer KOT workflow.
 */
export interface ExecuteMultiPrinterKOTParams {
  orderData: Record<string, unknown>;
  newKotItems: Array<Record<string, unknown>>;
  printers: TenantPrinter[];
  routes: PrinterCategoryRoute[];
  tenantId: string;
  onLegacyFallback: () => void;
  onComplete: (successfullyPrintedItems: PrintableKOTItem[]) => void;
  dispatchOptions?: KOTDispatchOptions;
}


/**
 * Orchestrates multi-printer KOT routing, dispatching, and failure fallback.
 *
 * CRITICAL SAFETY RULES:
 * 1. If 0 jobs can be created or 0 jobs succeed: invokes onLegacyFallback() (safe because nothing printed).
 * 2. If some jobs succeed but others fail: NEVER calls onLegacyFallback() (which would duplicate successful items).
 *    Instead, redirects ONLY the failed/unroutable items to the active default printer.
 * 3. Updates only successfully printed items in onComplete callback.
 */
export async function executeMultiPrinterKOTFlow(
  params: ExecuteMultiPrinterKOTParams
): Promise<void> {
  const {
    orderData,
    newKotItems,
    printers,
    routes,
    tenantId,
    onLegacyFallback,
    onComplete,
    dispatchOptions,
  } = params;

  const printableItems = mapCartItemsToPrintable(newKotItems);
  const orderContext = buildKOTOrderContext(orderData);

  // 1. Run deterministic routing engine
  const routingResult = routeKOT({
    items: printableItems,
    orderContext,
    config: {
      tenantId,
      printers,
      routes,
    },
  });

  // 2. If routing produced zero jobs (e.g. all items unroutable and no default printer)
  if (!routingResult.jobs || routingResult.jobs.length === 0) {
    console.warn(
      '[MultiPrinterKOT] Zero print jobs created by routing engine. Invoking safe legacy fallback.'
    );
    onLegacyFallback();
    return;
  }

  // 3. Dispatch targeted station jobs sequentially
  let dispatchResult;
  try {
    dispatchResult = await dispatchKOTPrintJobs(routingResult.jobs, dispatchOptions);
  } catch (dispatchErr) {
    console.error('[MultiPrinterKOT] Unexpected exception during dispatch:', dispatchErr);
    // If exception happened before any job completed, fallback safely
    onLegacyFallback();
    return;
  }

  const { successfulJobs, failedJobs } = dispatchResult;

  // CASE A: Total failure (0 jobs succeeded) -> Safe full legacy fallback
  if (successfulJobs === 0) {
    console.warn(
      '[MultiPrinterKOT] All targeted station jobs failed. Invoking safe legacy fallback.'
    );
    onLegacyFallback();
    return;
  }

  // Collect items from successfully printed station jobs
  const successfullyPrintedItems: PrintableKOTItem[] = [];
  routingResult.jobs.forEach((job) => {
    const jobRes = dispatchResult.jobs.find((j) => j.jobId === job.jobId);
    if (jobRes && jobRes.success) {
      job.items.forEach((ri) => successfullyPrintedItems.push(ri.item));
    }
  });

  // CASE B: Total success (all station jobs succeeded and 0 unroutable items)
  if (failedJobs === 0 && routingResult.unroutableItems.length === 0) {
    toast.success('KOT sent to kitchen stations!', { duration: 1500 });
    onComplete(successfullyPrintedItems);
    return;
  }

  // CASE C: Partial success (some stations printed, but some failed or were unroutable)
  // CRITICAL: Do NOT call onLegacyFallback() to avoid duplicating already printed tickets!
  const failedItems: PrintableKOTItem[] = [];
  routingResult.jobs.forEach((job) => {
    const jobRes = dispatchResult.jobs.find((j) => j.jobId === job.jobId);
    if (!jobRes || !jobRes.success) {
      job.items.forEach((ri) => failedItems.push(ri.item));
    }
  });
  routingResult.unroutableItems.forEach((ui) => {
    failedItems.push(ui.item);
  });

  // Redirect ONLY the failed/unroutable items to the active default printer
  const defaultPrinter = printers.find(
    (p) =>
      p.is_active !== false &&
      p.is_default &&
      typeof p.device_name === 'string' &&
      p.device_name.trim().length > 0
  );

  if (defaultPrinter && failedItems.length > 0) {
    console.warn(
      `[MultiPrinterKOT] Redirecting ${failedItems.length} failed/unroutable items to default printer: ${defaultPrinter.name}`
    );

    const fallbackJob: KOTPrintJob = {
      jobId: `fallback_kot_${Date.now()}`,
      printerId: defaultPrinter.id,
      printer: defaultPrinter,
      items: failedItems.map((item) => ({
        item,
        resolvedCategory: item.category || 'fallback',
        canonicalCategoryKey: 'fallback',
        routingMethod: 'fallback_default',
        targetPrinterId: defaultPrinter.id,
        targetPrinterName: defaultPrinter.name,
      })),
      orderContext: {
        ...orderContext,
        notes: orderContext.notes
          ? `${orderContext.notes} (STATION FALLBACK)`
          : '(STATION FALLBACK)',
      },
      routingMethod: 'fallback_default',
      itemCount: failedItems.length,
      totalQuantity: failedItems.reduce((acc, it) => acc + (it.quantity || 1), 0),
      createdAt: new Date().toISOString(),
    };

    try {
      const fallbackDispatch = await dispatchKOTPrintJobs([fallbackJob], dispatchOptions);
      if (fallbackDispatch.successfulJobs > 0) {
        // Fallback succeeded! All items have now printed without duplication
        failedItems.forEach((item) => successfullyPrintedItems.push(item));
        toast.warning('Some station printers failed. Affected items printed on default printer.', {
          duration: 3500,
        });
        onComplete(successfullyPrintedItems);
        return;
      }
    } catch (fallbackErr) {
      console.error('[MultiPrinterKOT] Fallback print to default printer failed:', fallbackErr);
    }
  }

  // If default printer fallback was unavailable or also failed:
  const failedNames = failedItems
    .map((i) => i.name || i.product?.name || 'Item')
    .slice(0, 3)
    .join(', ');
  toast.error(
    `Printer connection failed for: ${failedNames}${failedItems.length > 3 ? '...' : ''}. Please check printer connections.`,
    { duration: 4000 }
  );

  // Complete with whatever actually succeeded
  onComplete(successfullyPrintedItems);
}
