import { PrintableKOTItem } from './kotRoutingTypes';

/**
 * Result of resolving an item's category.
 */
export interface CategoryResolutionResult {
  /** Original human-readable category name as provided on the product/item */
  displayName: string | null;
  /** Canonical normalized key used for database route lookup (trimmed, lowercased) */
  canonicalKey: string | null;
  /** Whether a non-empty category was successfully identified */
  isResolved: boolean;
}

/**
 * Normalizes any category string into the canonical routing key format.
 * Rule: raw_category.trim().toLowerCase()
 */
export function normalizeCategoryKey(rawCategory: string | null | undefined): string {
  if (!rawCategory || typeof rawCategory !== 'string') {
    return '';
  }
  return rawCategory.trim().toLowerCase();
}

/**
 * Deterministically resolves the category for a printable KOT item.
 * Searches across all standard product/item representations in the POS.
 */
export function resolveItemCategory(item: PrintableKOTItem): CategoryResolutionResult {
  // 1. Check item.product.category (standard CartItem structure)
  const productCat = item.product?.category;
  if (typeof productCat === 'string' && productCat.trim().length > 0) {
    const trimmed = productCat.trim();
    return {
      displayName: trimmed,
      canonicalKey: trimmed.toLowerCase(),
      isResolved: true,
    };
  }

  // 2. Check item.product_category (DB order_items structure)
  const dbCat = item.product_category;
  if (typeof dbCat === 'string' && dbCat.trim().length > 0) {
    const trimmed = dbCat.trim();
    return {
      displayName: trimmed,
      canonicalKey: trimmed.toLowerCase(),
      isResolved: true,
    };
  }

  // 3. Check item.category (direct item property / virtual templates)
  const directCat = item.category;
  if (typeof directCat === 'string' && directCat.trim().length > 0) {
    const trimmed = directCat.trim();
    return {
      displayName: trimmed,
      canonicalKey: trimmed.toLowerCase(),
      isResolved: true,
    };
  }

  // Category could not be resolved
  return {
    displayName: null,
    canonicalKey: null,
    isResolved: false,
  };
}

/**
 * Deterministically extracts a unique identity for an item to prevent
 * accidental duplicate line items within a single printer ticket.
 */
export function getItemIdentifier(item: PrintableKOTItem, fallbackIndex?: number): string {
  if (item.product?.id) {
    return `prod_${item.product.id}`;
  }
  if (item.product_id) {
    return `prod_${item.product_id}`;
  }
  if (item.id) {
    return `item_${item.id}`;
  }
  const name = item.product?.name || item.product_name || item.name || 'unnamed';
  const label = item.qtyMeasureLabel || '';
  return `name_${name}_${label}_idx_${fallbackIndex ?? 0}`;
}
