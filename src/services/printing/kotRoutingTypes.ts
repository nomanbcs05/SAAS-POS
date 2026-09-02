import { TenantPrinter, PrinterCategoryRoute } from '@/types/printer';
import { Customer } from '@/stores/cartStore';

/**
 * Printable representation of an item to be routed to a KOT printer.
 * Supports CartItem structure, DB order item structure, and delta items.
 */
export interface PrintableKOTItem {
  id?: string;
  product_id?: string;
  product?: {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    price?: number;
  };
  name?: string;
  product_name?: string;
  category?: string;
  product_category?: string;
  quantity: number;
  qtyMeasureLabel?: string;
  notes?: string;
  specialInstructions?: string;
  lineTotal?: number;
  price?: number;
}

/**
 * Contextual metadata required for KOT header/footer display.
 * Maps directly to existing KOT.tsx component requirements.
 */
export interface KOTOrderContext {
  orderId?: string;
  orderNumber: string;
  orderType: 'dine_in' | 'take_away' | 'delivery';
  tableId?: string | number | null;
  customer?: Customer | null;
  serverName?: string | null;
  rider?: { name: string } | null;
  cashierName?: string;
  createdAt?: Date | string;
  revisionNumber?: number;
  isRevision?: boolean;
  isDuplicate?: boolean;
  notes?: string | null;
  specialInstructions?: string | null;
}

/**
 * Represents an item successfully mapped to a destination printer.
 */
export interface RoutedKOTItem {
  item: PrintableKOTItem;
  resolvedCategory: string;
  canonicalCategoryKey: string;
  routingMethod: 'direct_route' | 'fallback_default';
  targetPrinterId: string;
  targetPrinterName: string;
}

/**
 * Reason an item could not be assigned to any printer.
 */
export type UnroutableReason =
  | 'NO_ACTIVE_DEFAULT_PRINTER'
  | 'NO_MATCHING_ROUTE_AND_NO_DEFAULT'
  | 'ALL_MAPPED_PRINTERS_INACTIVE_AND_NO_DEFAULT'
  | 'CATEGORY_UNRESOLVED_AND_NO_DEFAULT'
  | 'TENANT_MISMATCH';

/**
 * Represents an item that could not be routed to any printer.
 */
export interface UnroutableKOTItem {
  item: PrintableKOTItem;
  resolvedCategory: string | null;
  canonicalCategoryKey: string | null;
  reason: UnroutableReason;
  message: string;
}

/**
 * Complete structured print job for a single destination printer.
 * Pure data object — does not contain HTML or ESC/POS commands.
 */
export interface KOTPrintJob {
  jobId: string;
  printerId: string;
  printer: TenantPrinter;
  items: RoutedKOTItem[];
  orderContext: KOTOrderContext;
  routingMethod: 'direct_route' | 'fallback_default' | 'mixed';
  itemCount: number;
  totalQuantity: number;
  createdAt: string;
}

/**
 * Active configuration required by the routing engine.
 * Pure data input decoupled from UI state or React hooks.
 */
export interface KOTRoutingConfig {
  tenantId: string;
  printers: TenantPrinter[];
  routes: PrinterCategoryRoute[];
}

/**
 * High-level status of the routing evaluation.
 */
export type KOTRoutingStatus =
  | 'routed'           // All items routed to assigned station printers
  | 'fallback_routed'  // All items routed to default fallback printer
  | 'partially_routed' // Some items routed, but some unroutable
  | 'unroutable'       // All items failed to route (e.g. no default printer)
  | 'empty';           // No items provided in input

/**
 * Detailed metrics summary of the routing execution.
 */
export interface KOTRoutingSummary {
  totalItemsReceived: number;
  totalItemsRouted: number;
  totalJobsCreated: number;
  directRouteJobsCount: number;
  fallbackJobsCount: number;
  unroutableCount: number;
  activeDefaultPrinterId: string | null;
}

/**
 * Complete deterministic result of the KOT routing engine.
 */
export interface KOTRoutingResult {
  status: KOTRoutingStatus;
  jobs: KOTPrintJob[];
  unroutableItems: UnroutableKOTItem[];
  summary: KOTRoutingSummary;
}
