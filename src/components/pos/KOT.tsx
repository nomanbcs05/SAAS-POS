import { forwardRef } from 'react';
import { format } from 'date-fns';
import { CartItem, Customer } from '@/stores/cartStore';

interface Order {
  orderNumber: string;
  items: CartItem[];
  customer: Customer | null;
  orderType?: 'dine_in' | 'take_away' | 'delivery';
  createdAt: Date;
  cashierName: string;
  rider?: { name: string } | null;
}

interface KOTProps {
  order: Order;
  isDuplicate?: boolean;
}

const KOT = forwardRef<HTMLDivElement, KOTProps>(({ order, isDuplicate = false }, ref) => {
  return (
    <div 
      ref={ref} 
      className="receipt-print bg-white text-black p-4 font-mono text-xs mx-auto"
      style={{ width: '80mm' }}
    >
      {/* Duplicate Badge */}
      {isDuplicate && (
        <div className="text-center mb-2">
          <div className="border-2 border-black font-black text-lg py-1 px-4 inline-block transform -rotate-2">
            *** DUPLICATE ***
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold border-2 border-black p-1 inline-block">KITCHEN TICKET</h1>
      </div>

      {/* Order Info */}
      <div className="mb-3 font-bold text-sm">
        <p>Order #: {order.orderNumber}</p>
        <p>Type: {order.orderType?.replace('_', ' ').toUpperCase() || 'DINE IN'}</p>
        <p>Date: {format(order.createdAt, 'yyyy-MM-dd HH:mm')}</p>
        {order.orderType === 'delivery' && order.rider && (
          <p>Rider: {order.rider.name}</p>
        )}
        {order.customer && (
          <p>Customer: {order.customer.name}</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t-2 border-black my-3" />

      {/* Items */}
      <table className="w-full text-sm font-bold">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1">Qty</th>
            <th className="text-left py-1">Item</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((rawItem, idx) => {
            const item: any = rawItem as any;
            const qty: number = item?.quantity ?? 1;
            const name: string =
              item?.product?.name ??
              item?.product_name ??
              item?.name ??
              'Item';
            const key = item?.product?.id ?? `${idx}-${name}`;
            return (
              <tr key={key}>
                <td className="py-2 pr-2 align-top w-12 text-lg">
                  {qty}
                </td>
                <td className="py-2 align-top">
                  <div className="text-lg">{name}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Divider */}
      <div className="border-t-2 border-black my-3" />

      {/* Footer */}
      <div className="text-center mt-4">
        <p className="font-bold">*** KITCHEN COPY ***</p>
      </div>
    </div>
  );
});

KOT.displayName = 'KOT';

export default KOT;
