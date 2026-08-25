export interface CartItemInput {
  rate?: number;
  price?: number;
  qty?: number;
  quantity?: number;
  lineTotal?: number;
  product?: {
    price?: number;
    name?: string;
  };
}

export interface BillSettings {
  taxRate?: number;
  taxName?: string;
}

export interface BillCalculationResult {
  itemsTotal: number;
  discountPercent: number;
  discountAmount: number;
  afterDiscount: number;
  taxRate: number;
  taxName: string;
  taxAmount: number;
  grandTotal: number;
}

/**
 * Calculates billing totals with discount applied before tax.
 * Tax is only calculated and added if settings.taxRate > 0.
 *
 * @param cart Array of cart items with rate/qty
 * @param discountPercent Discount percentage (0-100)
 * @param settings Settings containing taxRate and taxName
 */
export function calculateBill(
  cart: CartItemInput[] = [],
  discountPercent: number = 0,
  settings: BillSettings = { taxRate: 0, taxName: 'GST' }
): BillCalculationResult {
  const dPercent = Math.max(0, Number(discountPercent) || 0);
  const taxRate = Math.max(0, Number(settings?.taxRate) || 0);
  const taxName = settings?.taxName || 'GST';

  // 1. itemsTotal = sum of rate * qty (rounded to 2 decimals)
  const rawItemsTotal = (cart || []).reduce((sum, item) => {
    if (item.lineTotal !== undefined && item.lineTotal !== null && !isNaN(Number(item.lineTotal))) {
      return sum + Number(item.lineTotal);
    }
    const rate = Number(item.rate ?? item.price ?? item.product?.price ?? 0);
    const qty = Number(item.qty ?? item.quantity ?? 1);
    return sum + (rate * qty);
  }, 0);
  const itemsTotal = Math.round((rawItemsTotal + Number.EPSILON) * 100) / 100;

  // 2. discountAmount = (itemsTotal * discountPercent / 100) (rounded to 2 decimals)
  const rawDiscount = (itemsTotal * dPercent) / 100;
  const discountAmount = Math.round((rawDiscount + Number.EPSILON) * 100) / 100;

  // 3. afterDiscount (Subtotal) = itemsTotal - discountAmount
  const afterDiscount = Math.round((itemsTotal - discountAmount + Number.EPSILON) * 100) / 100;

  // 4. taxAmount = 0. If settings.taxRate > 0 then taxAmount = (afterDiscount * settings.taxRate / 100) (rounded to 2 decimals)
  let taxAmount = 0;
  if (taxRate > 0) {
    const rawTax = (afterDiscount * taxRate) / 100;
    taxAmount = Math.round((rawTax + Number.EPSILON) * 100) / 100;
  }

  // 5. grandTotal = afterDiscount + taxAmount (rounded to 2 decimals)
  const grandTotal = Math.round((afterDiscount + taxAmount + Number.EPSILON) * 100) / 100;

  // 6. Return all 7 values
  return {
    itemsTotal,
    discountPercent: dPercent,
    discountAmount,
    afterDiscount,
    taxRate,
    taxName,
    taxAmount,
    grandTotal,
  };
}
