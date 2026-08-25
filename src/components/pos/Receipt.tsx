import { forwardRef, useState } from 'react';
import { format } from 'date-fns';
import { businessInfo } from '@/data/mockData';
import { CartItem, Customer } from '@/stores/cartStore';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { calculateBill } from '@/utils/calculateBill';

interface Order {
  orderNumber: string;
  items: CartItem[];
  customer: Customer | null;
  subtotal: number;
  taxAmount: number;
  taxRate?: number;
  discountAmount: number;
  serviceChargesAmount?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'wallet' | 'credit';
  orderType?: 'dine_in' | 'take_away' | 'delivery';
  createdAt: Date;
  cashierName: string;
  serverName?: string | null;
  rider?: { name: string } | null;
  customerAddress?: string | null;
  tableId?: string | number | null;
  receivedCash?: number;
  remainingCash?: number;
}

interface ReceiptProps {
  order: Order;
}

const Receipt = forwardRef<HTMLDivElement, ReceiptProps>(({ order }, ref) => {
  const [logoError, setLogoError] = useState(false);
  const { tenant } = useMultiTenant();

  const logoSrc = tenant?.logo_url || '/pbh-logo.png';
  const name = tenant?.restaurant_name || businessInfo.name;
  const address = tenant?.address || businessInfo.address;
  const city = tenant?.city || businessInfo.city;
  const phone = tenant?.phone || businessInfo.phone;
  const taxId = (tenant as any)?.tax_id || businessInfo.taxId;
  const website = (tenant as any)?.website || businessInfo.website;
  const billFooter =
    tenant?.bill_footer ||
    '!!!!FOR THE LOVE OF FOOD !!!!';

  // Tax Settings directly from Settings > Tax & Payment (tenant)
  const taxRateSetting = tenant?.tax_rate !== undefined && tenant?.tax_rate !== null 
    ? Number(tenant.tax_rate) 
    : (order.taxRate !== undefined && order.taxRate !== null ? Number(order.taxRate) : 0);
  const taxNameSetting = tenant?.tax_name || 'GST';

  const cartItems = (order.items || []).map(item => ({
    rate: Number(item.product?.price || 0),
    qty: Number(item.quantity || 1),
    lineTotal: item.lineTotal !== undefined ? Number(item.lineTotal) : undefined,
  }));

  const itemsSum = cartItems.reduce((sum, item) => sum + (item.lineTotal ?? (item.rate * item.qty)), 0);
  const discountPercent = (order as any).discount !== undefined && (order as any).discount !== null
    ? Number((order as any).discount)
    : (itemsSum > 0 && order.discountAmount ? (Number(order.discountAmount) / itemsSum) * 100 : 0);

  const bill = calculateBill(cartItems, discountPercent, {
    taxRate: taxRateSetting,
    taxName: taxNameSetting,
  });

  const serviceChargesAmount = Number(order.serviceChargesAmount) || 0;
  const deliveryFee = Number(order.deliveryFee) || 0;
  const finalOrderTotal = bill.grandTotal + serviceChargesAmount + deliveryFee;

  // Determine if this is a pre-payment bill (unpaid/running) or paid bill
  const isPrePayment = order.isPrePayment === true || 
    (order.status !== 'completed' && order.status !== 'paid' && (order.status === 'pending' || order.status === 'ongoing' || order.status === 'in_progress'));

  const paymentMethodLabel: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    wallet: 'Digital Wallet',
    credit: 'Credit',
  };

  return (
    <div
      ref={ref}
      className="receipt-print bg-white text-black p-2 font-mono text-[11px] leading-tight mx-auto"
      style={{ width: '80mm' }}
    >
      {/* Header */}
      <div className="text-center mb-1">
        {!logoError ? (
          <img
            src={logoSrc}
            alt="Logo"
            className="mx-auto mb-2 object-contain h-44 max-w-[300px] w-auto"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="border-2 border-dashed border-gray-400 rounded-xl p-2 mx-auto flex items-center justify-center mb-1">
            <h1 className="text-sm font-bold uppercase">{name}</h1>
          </div>
        )}
      </div>

      {/* Address Box */}
      <div className="border border-black p-1 text-center mb-1 text-[10px]">
        <p>{address}</p>
        <p>{city}</p>
        {phone && (
          <>
            <p className="font-bold">{phone.split(',')[0]}</p>
            {phone.split(',')[1] && (
              <p className="font-bold">{phone.split(',')[1]}</p>
            )}
          </>
        )}
        <p className="text-[9px] mt-1 border-t border-dotted border-black pt-1">
          Designed & Developed By GENX CLOUD
        </p>
      </div>

      {/* Payment Status Tag */}
      <div className={`border-x border-t border-black p-1 text-center text-[10px] font-black uppercase tracking-wider ${isPrePayment ? 'bg-amber-100 text-black' : 'bg-gray-200 text-black'}`}>
        {isPrePayment ? '*** PRE-PAYMENT BILL ***' : '*** PAID BILL ***'}
      </div>



      {/* Info Section */}
      <div className="border border-black p-1 text-[10px]">
        <div className="flex justify-between font-bold">
          <span>Invoice #:</span>
          <span>{order.invoiceNumber || ('INV-' + String(order.daily_id || order.orderNumber || '1').padStart(4, '0'))}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Restaurant:</span>
          <span className="font-bold uppercase">{name}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>{order.cashierName}</span>
          <span className="uppercase">{order.orderType}</span>
        </div>
        
        {order.serverName && (
          <div className="flex justify-between mt-1">
            <span>Server:</span>
            <span className="font-bold uppercase">{order.serverName.replace(/^\[.*?\]\s*/, '')}</span>
          </div>
        )}

        <div className="flex justify-between mt-1">
          <span>{format(order.createdAt, 'd-MMM-yy')}</span>
          <span>{format(order.createdAt, 'h:mm a')}</span>
        </div>

        {order.tableId != null && order.tableId !== '' && (
          <div className="flex justify-between mt-1">
            <span className="font-black text-[12px]">Table:</span>
            <span className="font-black text-[12px] uppercase">{order.tableId}</span>
          </div>
        )}

        {order.rider && (
          <div className="flex justify-between items-center mt-1">
            <span className="font-bold text-lg">Rider :</span>
            <span className="font-bold text-lg uppercase">{order.rider.name}</span>
          </div>
        )}

        {order.customer && (
          <div className="mt-1">
            <div className="flex justify-between">
              <span>Customer :</span>
              <span>{order.customer.name}</span>
            </div>
            {order.customer.phone && (
              <div className="flex justify-between">
                <span>Phone:</span>
                <span>{order.customer.phone}</span>
              </div>
            )}
            {order.customerAddress && (
              <div className="mt-1">
                <div className="text-[11px] font-bold">Address:</div>
                <p className="break-words uppercase text-[11px] leading-tight mt-0.5">
                  {order.customerAddress}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="border-x border-b border-black">
        <table className="w-full table-fixed text-[10px]">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1 pl-1 w-8 font-bold">Qty</th>
              <th className="text-left py-1 font-bold">Item</th>
              <th className="text-right py-1 w-12 font-bold">Rate</th>
              <th className="text-right py-1 pr-1 w-14 font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => {
              const itemAmt = Number(item.lineTotal ?? (Number(item.product?.price || 0) * item.quantity)) || 0;
              return (
                <tr key={item.product.id}>
                  <td className="py-1 pl-1 align-top font-medium text-[11px]">{item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}</td>
                  <td className="py-1 align-top uppercase break-words font-medium text-[11px]">
                    {item.product.name}
                    {item.qtyMeasureLabel && (
                      <span className="block text-[9px] text-gray-500 font-bold italic">({item.qtyMeasureLabel})</span>
                    )}
                  </td>
                  <td className="text-right py-1 align-top font-medium text-[11px]">{item.product.price}</td>
                  <td className="text-right py-1 pr-1 align-top font-bold text-[11px]">{itemAmt.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-x border-b border-black p-1 text-[11px]">
        {/* Items Total */}
        <div className="flex justify-between font-medium">
          <span>Items Total :</span>
          <span>{bill.itemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        {/* Discount X% (only if discountAmount > 0) */}
        {bill.discountAmount > 0 && (
          <div className="flex justify-between font-medium">
            <span>Discount {bill.discountPercent > 0 ? `${bill.discountPercent % 1 === 0 ? bill.discountPercent : bill.discountPercent.toFixed(1)}%` : ''} :</span>
            <span>-{bill.discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}

        {/* Subtotal */}
        <div className="flex justify-between font-medium">
          <span>Subtotal :</span>
          <span>{bill.afterDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        {/* Tax (Only if taxRate > 0) */}
        {bill.taxRate > 0 && (
          <div className="flex justify-between font-medium">
            <span>{bill.taxName} @ {bill.taxRate}% :</span>
            <span>{bill.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}

        {/* Grand Total */}
        <div className="flex justify-between font-bold border-t border-dotted border-black pt-0.5 mt-0.5">
          <span>Grand Total :</span>
          <span>{bill.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        {serviceChargesAmount > 0 && (
          <div className="flex justify-between font-medium">
            <span>Service Charges :</span>
            <span>+{serviceChargesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between font-medium">
            <span>Delivery Charges :</span>
            <span>{deliveryFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
        {(() => {
          const prevBalance = Number(order.customer?.creditBalance ?? order.customer?.credit_balance ?? (order as any).previousCreditBalance ?? 0);
          return (
            <>
              {prevBalance > 0 && (
                <div className="flex justify-between font-bold text-red-600 mt-1 border-t border-black pt-1">
                  <span>Previous Credit Balance:</span>
                  <span>Rs {prevBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base mt-1 bg-gray-100 p-1 border border-black/10">
                <span>Current Order Total:</span>
                <span>Rs {finalOrderTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {prevBalance > 0 && (
                <div className="flex justify-between font-black text-sm mt-1 p-1 border-t-2 border-black bg-gray-200">
                  <span>TOTAL COMBINED BALANCE:</span>
                  <span>Rs {(finalOrderTotal + prevBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </>
          );
        })()}
        {order.receivedCash !== undefined && Number(order.receivedCash) > 0 && (
          <>
            <div className="flex justify-between font-bold mt-1 border-t border-dotted border-black pt-1">
              <span>Cash Received:</span>
              <span>Rs {Number(order.receivedCash).toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Change Returned:</span>
              <span>Rs {Math.max(0, Number(order.receivedCash) - finalOrderTotal).toFixed(2)}</span>
            </div>
          </>
        )}
        {order.items.some(item => item.desiredAmount !== undefined) && (
          <div className="border-t border-dotted border-black mt-1 pt-1 space-y-0.5 text-[10px] font-bold">
            {order.items.map((item, idx) => {
              if (item.desiredAmount === undefined) return null;
              return (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span>Desired Amount:</span>
                    <span>Rs {item.desiredAmount.toLocaleString()}</span>
                  </div>
                  {item.receivedCash !== undefined && (
                    <div className="flex justify-between">
                      <span>Cash Received:</span>
                      <span>Rs {item.receivedCash.toLocaleString()}</span>
                    </div>
                  )}
                  {item.remainingCash !== undefined && (
                    <div className="flex justify-between">
                      <span>Remaining Change:</span>
                      <span>Rs {item.remainingCash.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Payment Info */}
      <div className="border border-black border-t-0 p-1 text-[10px] text-center bg-gray-50">
        <span className="font-bold">Payment Method:</span> <span className="uppercase">{paymentMethodLabel[order.paymentMethod] || order.paymentMethod}</span>
      </div>

      {/* Footer */}
      <div className="text-center mt-2 space-y-1">
        <p className="font-bold">{billFooter}</p>
        <div className="border-t border-black/10 pt-1 mt-1 space-y-1">
          <p className="text-[10px] uppercase font-bold">
            THANK YOU FOR YOUR VISIT! COME BACK SOON!
          </p>
          <p className="text-[10px] uppercase font-bold">
            POWERED BY GENX CLOUD +923342826675
          </p>
        </div>
      </div>
    </div>
  );
});

Receipt.displayName = 'Receipt';

export default Receipt;
