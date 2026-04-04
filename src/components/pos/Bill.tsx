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
  paymentMethod?: 'cash' | 'card' | 'wallet';
  orderType?: 'dine_in' | 'take_away' | 'delivery';
  createdAt: Date;
  cashierName: string;
  serverName?: string | null;
  tableId?: number | null;
  rider?: { name: string } | null;
  customerAddress?: string | null;
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

  return (
    <div
      ref={ref}
      className="receipt-print bg-white text-black p-4 font-mono text-[13px] leading-loose mx-auto"
      style={{ width: '80mm', letterSpacing: '0.5px' }}
    >
      {/* Header */}
      <div className="text-center mb-1">
        {!logoError ? (
          <img
            src={logoSrc}
            alt="Logo"
            className="mx-auto mb-2 object-contain h-20 max-w-[120px] w-auto"
            onError={() => setLogoError(true)}
          />
        ) : (
          <div className="border-2 border-dashed border-gray-400 rounded-xl p-2 mx-auto flex items-center justify-center mb-2">
            <h1 className="text-base font-bold uppercase">{name}</h1>
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
      <div className="border-x border-t border-black p-1 text-center">
        <div className="text-3xl font-black tracking-widest">{order.orderNumber}</div>
      </div>

      {/* Info Section */}
      <div className="border border-black p-1 text-[13px]">
        <div className="flex justify-between">
          <span>Invoice #:</span>
          <span>{order.orderNumber}</span>
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
        <table className="w-full table-fixed text-[13px]">
          <thead>
            <tr className="border-b border-black bg-gray-100">
              <th className="text-left py-1 pl-1 w-8">Qty</th>
              <th className="text-left py-1">Item</th>
              <th className="text-right py-1 w-12">Rate</th>
              <th className="text-right py-1 pr-1 w-14">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.product.id}>
                <td className="py-1 pl-1 align-top">{item.quantity}</td>
                <td className="py-1 align-top uppercase break-words">
                  {item.product.name}
                  {/* Modifiers could go here */}
                </td>
                <td className="text-right py-1 align-top">{Number(item.product.price).toLocaleString()}</td>
                <td className="text-right py-1 pr-1 align-top">{Number(item.lineTotal).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-x border-b border-black p-1 text-[13px]">
        <div className="flex justify-between">
          <span>SubTotal :</span>
          <span>{Number(order.subtotal).toLocaleString()}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>Discount :</span>
            <span>-{Number(order.discountAmount).toLocaleString()}</span>
          </div>
        )}
        {order.serviceChargesAmount && order.serviceChargesAmount > 0 && (
          <div className="flex justify-between">
            <span>Service Charges :</span>
            <span>+{Number(order.serviceChargesAmount).toLocaleString()}</span>
          </div>
        )}
        {order.deliveryFee && order.deliveryFee > 0 && (
          <div className="flex justify-between">
            <span>Delivery Charges :</span>
            <span>{order.deliveryFee}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base mt-1 bg-gray-100 p-1">
          <span>Net Bill :</span>
          <span>{Number(order.total).toLocaleString()}</span>
        </div>
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

Bill.displayName = 'Bill';

export default Bill;
