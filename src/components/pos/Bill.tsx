import { forwardRef, useState } from 'react';
import { format } from 'date-fns';
import { businessInfo } from '@/data/mockData';
import { CartItem, Customer } from '@/stores/cartStore';
import { useMultiTenant } from '@/hooks/useMultiTenant';

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
  paymentMethod?: 'cash' | 'card' | 'wallet' | 'credit';
  orderType?: 'dine_in' | 'take_away' | 'delivery';
  createdAt: Date;
  cashierName: string;
  serverName?: string | null;
  tableId?: string | number | null;
  rider?: { name: string } | null;
  customerAddress?: string | null;
  receivedCash?: number;
  remainingCash?: number;
}

interface BillProps {
  order: Order;
}

const Bill = forwardRef<HTMLDivElement, BillProps>(({ order }, ref) => {
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

  // GST rate: 8% hardcoded for bill print
  const gstRate = 8;
  // Items Total = pure sum of item amounts (never includes GST)
  const itemsTotal = order.items.reduce((sum, item) => sum + ((item.lineTotal ?? (Number(item.product?.price || 0) * item.quantity)) || 0), 0);
  const gstAmount = itemsTotal * (gstRate / 100);
  const discountAmount = Number(order.discountAmount) || 0;
  const serviceChargesAmount = Number(order.serviceChargesAmount) || 0;
  const deliveryFee = Number(order.deliveryFee) || 0;
  const grandTotal = itemsTotal + gstAmount - discountAmount + serviceChargesAmount + deliveryFee;

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
      className="receipt-print bg-white text-black p-2 font-mono text-[12px] leading-tight mx-auto"
      style={{ width: '80mm', letterSpacing: '0.5px' }}
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
          <div className="border-2 border-dashed border-gray-400 rounded-xl p-2 mx-auto flex items-center justify-center mb-2">
            <h1 className="text-base font-bold uppercase">{name}</h1>
          </div>
        )}
      </div>

      {/* Address Box */}
      <div className="border border-black p-1 text-center mb-1 text-[10px] leading-tight">
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
        <p className="text-[9px] mt-0.5 border-t border-dotted border-black pt-0.5">
          Designed & Developed By GENX CLOUD
        </p>
      </div>

      {/* Order Number Box */}
      <div className="border-x border-t border-black py-0.5 px-1 text-center">
        <div className="text-3xl font-black tracking-widest">{order.orderNumber}</div>
        {/* Payment Status Tag */}
        <div className={`text-[11px] font-black uppercase tracking-wider py-0.5 border-t border-dashed border-black mt-0.5 ${isPrePayment ? 'bg-amber-100 text-black' : 'bg-gray-100 text-black'}`}>
          {isPrePayment ? '*** PRE-PAYMENT BILL ***' : '*** PAID BILL ***'}
        </div>
      </div>

      {/* Info Section */}
      <div className="border border-black p-1 text-[12px] leading-snug">
        <div className="flex justify-between">
          <span>Invoice #:</span>
          <span>{order.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Restaurant:</span>
          <span className="font-bold uppercase">{name}</span>
        </div>
        <div className="flex justify-between">
          <span>{order.cashierName}</span>
          <span className="uppercase">{order.orderType}</span>
        </div>
        
        {order.serverName && (
          <div className="flex justify-between">
            <span>Server:</span>
            <span className="font-bold uppercase">{order.serverName.replace(/^\[.*?\]\s*/, '')}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>{format(order.createdAt, 'd-MMM-yy')}</span>
          <span>{format(order.createdAt, 'h:mm a')}</span>
        </div>

        {order.tableId != null && order.tableId !== '' && (
          <div className="flex justify-between">
            <span className="font-black text-[13px]">Table:</span>
            <span className="font-black text-[13px] uppercase">{order.tableId}</span>
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
        <table className="w-full table-fixed text-[12px] leading-snug">
          <thead>
            <tr className="border-b border-black bg-gray-100">
              <th className="text-left py-0.5 pl-1 w-8">Qty</th>
              <th className="text-left py-0.5">Item</th>
              <th className="text-right py-0.5 w-12">Rate</th>
              <th className="text-right py-0.5 pr-1 w-14">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.product.id}>
                <td className="py-0.5 pl-1 align-top">{item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}</td>
                <td className="py-0.5 align-top uppercase break-words">
                  {item.product.name}
                  {item.qtyMeasureLabel && (
                    <span className="block text-[10px] text-gray-500 font-bold italic">({item.qtyMeasureLabel})</span>
                  )}
                </td>
                <td className="text-right py-0.5 align-top">{Number(item.product.price).toLocaleString()}</td>
                <td className="text-right py-0.5 pr-1 align-top">{Number(item.lineTotal).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-x border-b border-black p-1 text-[12px] leading-snug">
        {/* Items Total – pure sum of item amounts, no GST */}
        <div className="flex justify-between">
          <span>Items Total :</span>
          <span>{itemsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        {/* GST @ 8% */}
        <div className="flex justify-between">
          <span>GST @ {gstRate}% :</span>
          <span>{gstAmount.toFixed(2)}</span>
        </div>
        {/* Grand Total = Items Total + GST */}
        <div className="flex justify-between font-bold border-t border-dotted border-black pt-0.5 mt-0.5">
          <span>Grand Total :</span>
          <span>{grandTotal.toFixed(2)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between">
            <span>Discount :</span>
            <span>-{discountAmount.toLocaleString()}</span>
          </div>
        )}
        {serviceChargesAmount > 0 && (
          <div className="flex justify-between">
            <span>Service Charges :</span>
            <span>+{serviceChargesAmount.toLocaleString()}</span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between">
            <span>Delivery Charges :</span>
            <span>{deliveryFee.toLocaleString()}</span>
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
              <div className="flex justify-between font-bold text-base mt-0.5 bg-gray-100 p-1">
                <span>Current Order Total:</span>
                <span>Rs {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {prevBalance > 0 && (
                <div className="flex justify-between font-black text-sm mt-1 p-1 border-t-2 border-black bg-gray-200">
                  <span>TOTAL COMBINED BALANCE:</span>
                  <span>Rs {(grandTotal + prevBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
              <span>Rs {Math.max(0, Number(order.receivedCash) - grandTotal).toFixed(2)}</span>
            </div>
          </>
        )}
        {order.items.some(item => item.desiredAmount !== undefined) && (
          <div className="border-t border-dotted border-black mt-1 pt-1 space-y-0.5 text-[11px] font-bold">
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
      <div className="border border-black border-t-0 p-1 text-[12px] text-center bg-gray-50">
        <span className="font-bold">Payment Method:</span> <span className="uppercase">{order.paymentMethod ? (paymentMethodLabel[order.paymentMethod] || order.paymentMethod) : 'CASH'}</span>
      </div>

      {/* Footer */}
      <div className="text-center mt-1 space-y-0.5">
        <p className="font-bold leading-snug">{billFooter}</p>
        <div className="border-t border-black/10 pt-0.5 mt-0.5 space-y-0.5">
          <p className="text-[10px] uppercase font-bold leading-tight">
            THANK YOU FOR YOUR VISIT! COME BACK SOON!
          </p>
          <p className="text-[10px] uppercase font-bold leading-tight">
            POWERED BY GENX CLOUD +923342826675
          </p>
        </div>
      </div>
    </div>
  );
});

Bill.displayName = 'Bill';

export default Bill;
