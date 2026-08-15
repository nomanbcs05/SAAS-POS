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
    <tr key={item?.product?.id ?? `${index}-${name}`} className="border-b border-black/20">
      <td className="py-2.5 pr-3 align-top w-14 text-2xl font-black leading-tight">
        {qty % 1 === 0 ? qty : qty.toFixed(2)}
      </td>
      <td className="py-2.5 align-top text-2xl font-black leading-tight">
        {name}
        {item?.qtyMeasureLabel && (
          <div className="text-sm font-bold italic">({item.qtyMeasureLabel})</div>
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

  // Format Table Display
  const formatTable = (tableId: string | number) => {
    const str = String(tableId);
    if (str.toUpperCase().startsWith('T') || str.toUpperCase().startsWith('O') || str.toUpperCase().startsWith('V')) {
      return str.toUpperCase();
    }
    return `TABLE ${str}`;
  };

  return (
    <div
      ref={ref}
      className="receipt-print bg-white text-black p-4 font-mono text-sm mx-auto"
      style={{ width: '80mm' }}
    >
      {/* Duplicate Badge */}
      {isDuplicate && (
        <div className="text-center mb-2">
          <div className="border-4 border-black font-black text-xl py-1 px-4 inline-block transform -rotate-2">
            *** DUPLICATE ***
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="text-center mb-3">
        <h1 className="text-2xl font-black border-4 border-black p-2 inline-block uppercase tracking-wider">
          {isRevision ? `KOT REVISION #${order.revisionNumber ?? 2}` : 'KITCHEN TICKET'}
        </h1>
      </div>

      {/* Prominent Order Type Banner */}
      <div className="mb-3 border-b-4 border-black pb-3">
        <div className="flex justify-end items-baseline mb-2">
          <span className="text-xs font-black uppercase px-2 py-1 border-2 border-black">
            {order.orderType?.replace('_', ' ').toUpperCase() || 'DINE IN'}
          </span>
        </div>

        {/* Prominent Table # Box */}
        {order.tableId != null && order.tableId !== '' && (
          <div className="mt-2 bg-black text-white text-center py-2 px-3 rounded font-black text-3xl uppercase tracking-wider shadow-sm">
            {formatTable(order.tableId)}
          </div>
        )}

        {/* Order Details */}
        <div className="mt-3 text-base font-extrabold space-y-1">
          <p>Time: {format(order.createdAt, 'yyyy-MM-dd HH:mm')}</p>
          {order.serverName && (
            <p>Server: {order.serverName.replace(/^\[.*?\]\s*/, '')}</p>
          )}
          {order.customer && (
            <p>Customer: {order.customer.name}</p>
          )}
          {order.orderType === 'delivery' && order.rider && (
            <p>Rider: {order.rider.name}</p>
          )}
        </div>
      </div>

      {/* ── REVISION LAYOUT: prev items → separator line → new items ── */}
      {isRevision ? (
        <>
          {/* Previously ordered items (greyed, reference only) */}
          {prevItems.length > 0 && (
            <table className="w-full text-base opacity-60 mb-2">
              <tbody>
                {prevItems.map((item: any, idx: number) => {
                  const qty: number = item?.quantity ?? 1;
                  const name: string =
                    item?.product?.name ?? item?.product_name ?? item?.name ?? 'Item';
                  return (
                    <tr key={`prev-${idx}`}>
                      <td className="py-1 pr-3 align-top w-14 font-bold">{qty % 1 === 0 ? qty : qty.toFixed(2)}</td>
                      <td className="py-1 align-top font-bold">{name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* ─── THE SEPARATOR LINE ─────────────────────────────────── */}
          <div className="my-3 text-center">
            <div className="border-t-4 border-dashed border-black" />
            <div className="font-black text-sm tracking-widest my-1 uppercase">
              ── ADD ITEMS BELOW ──
            </div>
            <div className="border-t-4 border-dashed border-black" />
          </div>

          {/* Newly added items */}
          <table className="w-full font-bold">
            <thead>
              <tr className="border-b-2 border-black text-lg font-black">
                <th className="text-left py-1 w-14">Qty</th>
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
        <table className="w-full font-bold">
          <thead>
            <tr className="border-b-2 border-black text-lg font-black">
              <th className="text-left py-1 w-14">Qty</th>
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
      <div className="border-t-4 border-black my-4" />

      {/* Footer */}
      <div className="text-center mt-3">
        <p className="font-black text-base uppercase tracking-wider">
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

