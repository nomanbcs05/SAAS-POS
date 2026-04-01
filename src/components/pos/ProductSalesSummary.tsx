import { forwardRef } from 'react';
import { format } from 'date-fns';

type OrderItem = {
  product_id?: string;
  product_name?: string;
  product_category?: string;
  quantity: number;
  price: number;
  products?: { name?: string; category?: string };
};

type OrderWithItems = {
  id: string;
  created_at: string;
  status?: string;
  order_items?: OrderItem[];
};

interface ProductSalesSummaryProps {
  date?: Date;
  dateRange?: { from?: Date; to?: Date };
  query: string;
  orders: OrderWithItems[];
}

const ProductSalesSummary = forwardRef<HTMLDivElement, ProductSalesSummaryProps>(
  ({ date, dateRange, query, orders = [] }, ref) => {
    const tokens = typeof query === 'string'
      ? query
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const allItems: OrderItem[] = Array.isArray(orders) 
      ? orders.flatMap((o) => o.order_items || [])
      : [];

    const matchesQuery = (name?: string, category?: string) => {
      if (tokens.length === 0) return true;
      const n = (name || '').toLowerCase();
      const c = (category || '').toLowerCase();
      return tokens.some((t) => n.includes(t) || c.includes(t));
    };

    const aggregated = new Map<
      string,
      { name: string; quantity: number; revenue: number; cost: number; profit: number; stock: number; category: string }
    >();

    for (const item of allItems) {
      const name = item.product_name || item.products?.name || 'Unknown';
      const category = item.products?.category || item.product_category || 'Uncategorized';
      if (!matchesQuery(name, category)) continue;

      const key = name;
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const cost = Number((item as any).products?.cost) || 0;
      const stock = Number((item as any).products?.stock) || 0;

      const prev = aggregated.get(key) || {
        name: key,
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        stock: stock,
        category: category
      };

      prev.quantity += qty;
      prev.revenue += qty * price;
      prev.cost += qty * cost;
      prev.profit = prev.revenue - prev.cost;
      prev.stock = stock; // latest stock
      aggregated.set(key, prev);
    }

    const rows = Array.from(aggregated.values()).sort(
      (a, b) => b.quantity - a.quantity
    );

    // Group by category
    const categoriesMap = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = categoriesMap.get(r.category) || [];
      list.push(r);
      categoriesMap.set(r.category, list);
    }
    console.log('ProductSalesSummary categories count:', categoriesMap.size, 'Total items:', allItems.length);

    const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);
    const totalProfit = rows.reduce((s, r) => s + r.profit, 0);

    const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());
    const startDate = dateRange?.from ?? date ?? new Date();
    const endDate = dateRange?.to ?? dateRange?.from ?? date ?? new Date();

    const formattedDateRange = () => {
      if (dateRange?.from && isValidDate(dateRange.from)) {
        if (dateRange?.to && isValidDate(dateRange.to)) {
          return `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`;
        }
        return format(dateRange.from, 'EEEE, dd MMMM yyyy');
      }
      if (date && isValidDate(date)) {
        return format(date, 'EEEE, dd MMMM yyyy');
      }
      return format(new Date(), 'EEEE, dd MMMM yyyy');
    };

    return (
      <div
        ref={ref}
        className="bg-white text-black p-4 font-mono text-[10px] mx-auto leading-normal"
        style={{ width: '80mm', minHeight: '100px' }}
      >
        <div className="text-center mb-4 border-y border-black py-1">
          <h1 className="text-[13px] font-bold uppercase tracking-widest">Product Sales Monitoring</h1>
          <p className="font-bold text-[10px]">{formattedDateRange()}</p>
        </div>

        {Array.from(categoriesMap.entries()).map(([category, items]) => (
          <div key={category} className="mb-4">
            <h2 className="font-bold uppercase mb-1 text-[11px] border-y border-black py-0.5 bg-gray-50">{category}</h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-black text-[10px]">
                  <th className="text-left font-bold py-1 w-32">Item</th>
                  <th className="text-right font-bold py-1 px-1">Qty</th>
                  <th className="text-right font-bold py-1 px-1">Sales</th>
                  <th className="text-right font-bold py-1 px-1">Profit</th>
                  <th className="text-right font-bold py-1">Stk</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.name} className="border-b border-dotted border-gray-300 text-[10px]">
                    <td className="py-1.5 break-words leading-tight">{r.name}</td>
                    <td className="py-1.5 text-right align-top px-1 font-bold">{r.quantity}</td>
                    <td className="py-1.5 text-right align-top px-1">{r.revenue.toLocaleString()}</td>
                    <td className="py-1.5 text-right align-top px-1">{r.profit.toLocaleString()}</td>
                    <td className="py-1.5 text-right align-top font-bold">{r.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="border-t border-black mt-4 pt-1 font-bold space-y-1 uppercase">
          <div className="flex justify-between border-b border-black pb-1">
            <span>TOTAL ITEMS SOLD:</span>
            <span>{totalQty}</span>
          </div>
          <div className="flex justify-between border-b border-black py-1">
            <span>TOTAL REVENUE:</span>
            <span>Rs {totalRevenue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-b border-black py-1">
            <span>EST. TOTAL PROFIT:</span>
            <span>Rs {totalProfit.toLocaleString()}</span>
          </div>
        </div>

        <div className="text-center space-y-1 text-[10px] mt-6 pt-2 border-t border-dotted border-black">
          <p className="font-bold uppercase tracking-tight">GEN XCLOUD POS - MONITORING REPORT</p>
          <p>{format(new Date(), 'dd-MMM HH:mm:ss')}</p>
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
  }
);

ProductSalesSummary.displayName = 'ProductSalesSummary';

export default ProductSalesSummary;

