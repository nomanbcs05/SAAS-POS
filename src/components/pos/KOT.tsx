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

const ItemRow = ({ item, index }: { item: any; index: number }) => {
  const qty: number = item?.quantity ?? 1;
  const name: string =
    item?.product?.name ??
    item?.product_name ??
    item?.name ??
    'Item';
  return (
    <tr key={item?.product?.id ?? `${index}-${name}`}>
      <td className="py-2 pr-3 align-top w-12 text-xl font-black">
        {qty % 1 === 0 ? qty : qty.toFixed(2)}
      </td>
      <td className="py-2 align-top text-xl font-black">
        {name}
        {item?.qtyMeasureLabel && (
          <div className="text-xs font-bold italic">({item.qtyMeasureLabel})</div>
        )}
      </td>
    </tr>
  );
};

const KOT = forwardRef<HTMLDivElement, KOTProps>(({ order, isDuplicate = false }, ref) => {
  const isRevision = (order.revisionNumber ?? 1) > 1 ||
    (order.previousItems && order.previousItems.length > 0) ||
    (order.newlyAddedItems && order.newlyAddedItems.length > 0);

  // Decide what to show above and below the separator
  const prevItems: any[] = order.previousItems ?? [];
  const newItems: any[] = order.newlyAddedItems && order.newlyAddedItems.length > 0
    ? order.newlyAddedItems
    : order.items;

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
          {isRevision ? `KOT REVISION #${order.revisionNumber ?? 2}` : 'KITCHEN TICKET'}
        </h1>
      </div>

      {/* Order Info */}
      <div className="mb-3 font-bold text-sm">
        <p>Order #: {order.orderNumber}</p>
        <p>Type: {order.orderType?.replace('_', ' ').toUpperCase() || 'DINE IN'}</p>
        <p>Date: {format(order.createdAt, 'yyyy-MM-dd HH:mm')}</p>
        {order.tableId != null && order.tableId !== '' && (
          <p>Table: {String(order.tableId).startsWith('T') || String(order.tableId).startsWith('O') || String(order.tableId).startsWith('V')
            ? order.tableId
            : `Table ${order.tableId}`}</p>
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

      {/* ── REVISION LAYOUT: prev items → separator line → new items ── */}
      {isRevision ? (
        <>
          {/* Previously ordered items (greyed, reference only) */}
          {prevItems.length > 0 && (
            <table className="w-full text-sm opacity-60 mb-1">
              <tbody>
                {prevItems.map((item: any, idx: number) => {
                  const qty: number = item?.quantity ?? 1;
                  const name: string =
                    item?.product?.name ?? item?.product_name ?? item?.name ?? 'Item';
                  return (
                    <tr key={`prev-${idx}`}>
                      <td className="py-1 pr-3 align-top w-12 font-semibold">{qty % 1 === 0 ? qty : qty.toFixed(2)}</td>
                      <td className="py-1 align-top font-semibold">{name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* ─── THE SEPARATOR LINE ─────────────────────────────────── */}
          <div className="my-3 text-center">
            <div className="border-t-2 border-dashed border-black" />
            <div className="font-black text-xs tracking-widest mt-1 mb-1 uppercase">
              ── ADD ITEMS BELOW ──
            </div>
            <div className="border-t-2 border-dashed border-black" />
          </div>

          {/* Newly added items */}
          <table className="w-full text-sm font-bold">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-1 w-12">Qty</th>
                <th className="text-left py-1">Item</th>
              </tr>
            </thead>
            <tbody>
              {newItems.map((item: any, idx: number) => (
                <ItemRow key={idx} item={item} index={idx} />
              ))}
            </tbody>
          </table>
        </>
      ) : (
        /* ── FIRST KOT: show all items normally ── */
        <table className="w-full text-sm font-bold">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1 w-12">Qty</th>
              <th className="text-left py-1">Item</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item: any, idx: number) => (
              <ItemRow key={idx} item={item} index={idx} />
            ))}
          </tbody>
        </table>
      )}

      {/* Bottom divider */}
      <div className="border-t-4 border-black my-3" />

      {/* Footer */}
      <div className="text-center mt-4">
        <p className="font-black text-sm">
          {isRevision
            ? `*** KOT EDIT #${order.revisionNumber ?? 2} COPY ***`
            : '*** KITCHEN COPY ***'}
        </p>
      </div>
    </div>
  );
});

KOT.displayName = 'KOT';

export default KOT;
