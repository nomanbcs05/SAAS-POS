import { forwardRef } from 'react';
import { format } from 'date-fns';
import { CartItem, Customer } from '@/stores/cartStore';

interface Order {
  orderNumber: string;
  items: CartItem[];
  previousItems?: CartItem[];
  newlyAddedItems?: CartItem[];
  revisionNumber?: number;
  customer: Customer | null;
  orderType?: 'dine_in' | 'take_away' | 'delivery';
  createdAt: Date;
  cashierName: string;
  serverName?: string | null;
  rider?: { name: string } | null;
  tableId?: string | number | null;
}

interface KOTProps {
  order: Order;
  isDuplicate?: boolean;
}

const KOT = forwardRef<HTMLDivElement, KOTProps>(({ order, isDuplicate = false }, ref) => {
  const hasRevisions = (order.previousItems && order.previousItems.length > 0) || (order.revisionNumber && order.revisionNumber > 1);
  const displayNewItems = order.newlyAddedItems && order.newlyAddedItems.length > 0 ? order.newlyAddedItems : order.items;

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
        <h1 className="text-xl font-bold border-2 border-black p-1 inline-block">
          {hasRevisions ? `KOT REVISION #${order.revisionNumber || 2}` : 'KITCHEN TICKET'}
        </h1>
      </div>

      {/* Order Info */}
      <div className="mb-3 font-bold text-sm">
        <p>Order #: {order.orderNumber}</p>
        <p>Type: {order.orderType?.replace('_', ' ').toUpperCase() || 'DINE IN'}</p>
        <p>Date: {format(order.createdAt, 'yyyy-MM-dd HH:mm')}</p>
        {order.tableId != null && order.tableId !== '' && (
          <p>Table: {order.tableId.toString().startsWith('T') || order.tableId.toString().startsWith('O') || order.tableId.toString().startsWith('V') ? order.tableId : `Table ${order.tableId}`}</p>
        )}
        {order.orderType === 'delivery' && order.rider && (
          <p>Rider: {order.rider.name}</p>
        )}
        {order.customer && (
          <p>Customer: {order.customer.name}</p>
        )}
        {order.serverName && (
          <p>Server: {order.serverName.replace(/^\[.*?\]\s*/, '')}</p>
        )}
      </div>

      {/* Divider */}
      <div className="border-t-2 border-black my-3" />

      {/* Previous Order Items (If Edit) */}
      {order.previousItems && order.previousItems.length > 0 && (
        <div className="mb-4 opacity-75">
          <div className="text-center text-[10px] font-black uppercase bg-gray-200 py-0.5 mb-2">
            --- PREVIOUS ORDER ITEMS ---
          </div>
          <table className="w-full text-xs font-semibold">
            <tbody>
              {order.previousItems.map((rawItem, idx) => {
                const item: any = rawItem;
                const qty: number = item?.quantity ?? 1;
                const name: string = item?.product?.name ?? item?.product_name ?? item?.name ?? 'Item';
                return (
                  <tr key={`prev-${idx}`}>
                    <td className="py-1 pr-2 align-top w-10 text-sm line-through opacity-70">
                      {qty % 1 === 0 ? qty : qty.toFixed(2)}
                    </td>
                    <td className="py-1 align-top line-through opacity-70">
                      <div>{name}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t-2 border-dashed border-black my-3" />
        </div>
      )}

      {/* Newly Added Items Section Header */}
      {hasRevisions && (
        <div className="text-center text-xs font-black uppercase bg-black text-white py-1 mb-2">
          *** NEWLY ADDED ITEMS (KOT EDIT #{order.revisionNumber || 2}) ***
        </div>
      )}

      {/* Items */}
      <table className="w-full text-sm font-bold">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left py-1">Qty</th>
            <th className="text-left py-1">Item</th>
          </tr>
        </thead>
        <tbody>
          {displayNewItems.map((rawItem, idx) => {
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
                <td className="py-2 pr-2 align-top w-12 text-xl font-black">
                  {qty % 1 === 0 ? qty : qty.toFixed(2)}
                </td>
                <td className="py-2 align-top">
                  <div className="text-xl font-black">{name}</div>
                  {item?.qtyMeasureLabel && (
                    <div className="text-xs font-bold italic">({item.qtyMeasureLabel})</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Divider */}
      <div className="border-t-4 border-black my-3" />

      {/* Footer */}
      <div className="text-center mt-4">
        <p className="font-black text-sm">
          {hasRevisions ? `*** KOT EDIT #${order.revisionNumber || 2} COPY ***` : '*** KITCHEN COPY ***'}
        </p>
      </div>
    </div>
  );
});

KOT.displayName = 'KOT';

export default KOT;
