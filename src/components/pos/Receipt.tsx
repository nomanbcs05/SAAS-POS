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
  discountAmount: number;
  serviceChargesAmount?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'wallet';
  orderType?: 'dine_in' | 'take_away' | 'delivery';
  createdAt: Date;
  cashierName: string;
  serverName?: string | null;
  rider?: { name: string } | null;
  customerAddress?: string | null;
  tableId?: number | null;
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

  const paymentMethodLabel = {
    cash: 'Cash',
    card: 'Card',
    wallet: 'Digital Wallet',
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
            className="mx-auto mb-1 object-contain h-24 max-w-[150px] w-auto" // Increased logo size
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

      {/* Order Number Box */}
      <div className="border-x border-t border-black p-1 text-center bg-gray-100">
        <div className="text-2xl font-black">{order.orderNumber}</div>
      </div>

      {/* Info Section */}
      <div className="border border-black p-1 text-[10px]">
        <div className="flex justify-between">
          <span>Invoice #:</span>
          <span>{order.orderNumber}</span>
          <span>DAY-00{new Date().getDate()}</span>
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

        {order.tableId && (
          <div className="flex justify-between mt-1">
            <span className="font-bold">Table:</span>
            <span className="font-bold uppercase">{order.tableId}</span>
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
            {order.items.map((item) => (
              <tr key={item.product.id}>
                <td className="py-1 pl-1 align-top font-medium text-[11px]">{item.quantity}</td>
                <td className="py-1 align-top uppercase break-words font-medium text-[11px]">
                  {item.product.name}
                </td>
                <td className="text-right py-1 align-top font-medium text-[11px]">{item.product.price}</td>
                <td className="text-right py-1 pr-1 align-top font-bold text-[11px]">{(item.lineTotal || 0).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-x border-b border-black p-1 text-[11px]">
        <div className="flex justify-between font-medium">
          <span>SubTotal :</span>
          <span>{(order.subtotal || 0).toFixed(3)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex justify-between font-medium">
            <span>Discount :</span>
            <span>-{(order.discountAmount || 0).toFixed(3)}</span>
          </div>
        )}
        {order.serviceChargesAmount && order.serviceChargesAmount > 0 && (
          <div className="flex justify-between font-medium">
            <span>Service Charges :</span>
            <span>+{(order.serviceChargesAmount || 0).toFixed(3)}</span>
          </div>
        )}
        {order.deliveryFee && order.deliveryFee > 0 && (
          <div className="flex justify-between font-medium">
            <span>Delivery Charges :</span>
            <span>{order.deliveryFee}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base mt-1 bg-gray-100 p-1 border border-black/10">
          <span>Net Bill :</span>
          <span>{(order.total || 0).toFixed(0)}</span>
        </div>
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
