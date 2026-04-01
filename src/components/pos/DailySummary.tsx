import { forwardRef } from 'react';
import { format } from 'date-fns';
import { businessInfo } from '@/data/mockData';
import { useMultiTenant } from '@/hooks/useMultiTenant';

interface Order {
  id: string;
  dailyId?: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  customers?: { name: string };
}

interface DailySummaryProps {
  orders: Order[];
  date?: Date;
  dateRange?: { from?: Date; to?: Date };
}

const DailySummary = forwardRef<HTMLDivElement, DailySummaryProps>(({ orders = [], date, dateRange }, ref) => {
  const { tenant } = useMultiTenant();
  const name = tenant?.restaurant_name || businessInfo.name;

  const completedOrders = Array.isArray(orders) ? orders.filter(o => o.status === 'completed') : [];
  const totalSales = completedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  
  const salesByMethod = completedOrders.reduce((acc, o) => {
    const method = o.payment_method || 'unknown';
    acc[method] = (acc[method] || 0) + (Number(o.total_amount) || 0);
    return acc;
  }, {} as Record<string, number>);

  const isValidDate = (d: any) => d instanceof Date && !isNaN(d.getTime());

  const displayDate = dateRange?.from && isValidDate(dateRange.from) ?
    dateRange?.to && isValidDate(dateRange.to) ?
      `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}` :
      format(dateRange.from, 'EEEE, dd MMMM yyyy') :
    date && isValidDate(date) ? format(date, 'EEEE, dd MMMM yyyy') : format(new Date(), 'EEEE, dd MMMM yyyy');

  return (
    <div 
      ref={ref} 
      className="bg-white text-black p-4 font-mono text-[10px] mx-auto leading-normal"
      style={{ width: '80mm', minHeight: '100px' }}
    >
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-[13px] font-bold uppercase tracking-tight">Daily Sales Summary</h1>
        <h2 className="text-[12px] font-bold uppercase py-0.5">{name}</h2>
        <p className="font-bold text-[10px]">{displayDate}</p>
      </div>

      <div className="border-t border-black my-1" />

      {/* Summary Stats */}
      <div className="space-y-1 mb-4 font-bold uppercase">
        <div className="flex justify-between items-center border-b border-black pb-1">
          <span>TOTAL ORDERS:</span>
          <span>{completedOrders.length}</span>
        </div>
        <div className="flex justify-between items-center border-b border-black py-1">
          <span>TOTAL REVENUE:</span>
          <span>Rs {totalSales.toLocaleString()}</span>
        </div>
      </div>

      {/* Sales by Payment Method */}
      <div className="mb-4">
        <p className="font-bold text-center border-y border-black mb-1 py-1 uppercase bg-gray-50">PAYMENT METHODS</p>
        {Object.entries(salesByMethod).map(([method, amount]) => (
          <div key={method} className="flex justify-between capitalize border-b border-dotted border-gray-400 py-1">
            <span className="font-bold">{method}:</span>
            <span>Rs {amount.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Order List */}
      <div className="mb-4">
        <p className="font-bold text-center border-y border-black mb-1 py-1 uppercase bg-gray-50">Order Details</p>
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left font-bold py-1">ID</th>
              <th className="text-left font-bold py-1">Time</th>
              <th className="text-left font-bold py-1">Customer</th>
              <th className="text-right font-bold py-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {completedOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((order, idx) => (
              <tr key={order.id} className="border-b border-dotted border-gray-300">
                <td className="py-1.5">#{String(idx + 1).padStart(2, '0')}</td>
                <td className="py-1.5">{order.created_at ? format(new Date(order.created_at), 'HH:mm') : 'N/A'}</td>
                <td className="py-1.5 truncate max-w-[60px]">{order.customers?.name || 'Walk-in'}</td>
                <td className="text-right py-1.5 font-bold">Rs {Number(order.total_amount).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-black my-4" />
      
      <div className="text-center space-y-1 text-[10px]">
        <p className="font-bold uppercase tracking-tight">GEN XCLOUD POS - DAILY REPORT</p>
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
});

DailySummary.displayName = 'DailySummary';

export default DailySummary;
