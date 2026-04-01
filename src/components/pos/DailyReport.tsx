import React, { forwardRef } from 'react';
import { format } from 'date-fns';

export interface DailyReportProps {
  date: Date;
  orders: any[];
}

export const DailyReport = forwardRef<HTMLDivElement, DailyReportProps>(({ date, orders }, ref) => {
  const totalSales = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
  const totalOrders = orders.length;
  
  const paymentMethods = orders.reduce((acc: any, order: any) => {
    const method = order.payment_method || 'unknown';
    acc[method] = (acc[method] || 0) + Number(order.total_amount);
    return acc;
  }, {} as Record<string, number>);

  const ordersByType = {
    dine_in: orders.filter((o) => (o.order_type === 'dine_in' || o.orderType === 'dine_in')),
    take_away: orders.filter((o) => (o.order_type === 'take_away' || o.orderType === 'take_away')),
    delivery: orders.filter((o) => (o.order_type === 'delivery' || o.orderType === 'delivery')),
  };

  const typeTotals = {
    dine_in: ordersByType.dine_in.reduce((sum, o) => sum + Number(o.total_amount), 0),
    take_away: ordersByType.take_away.reduce((sum, o) => sum + Number(o.total_amount), 0),
    delivery: ordersByType.delivery.reduce((sum, o) => sum + Number(o.total_amount), 0),
  };

  return (
    <div ref={ref} className="p-4 bg-white text-black font-mono text-sm" style={{ width: '80mm' }}>
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold border-b-2 border-black pb-2">END OF DAY REPORT</h1>
        <p className="mt-2">{format(date, 'PPP')}</p>
      </div>

      <div className="space-y-4">
        <div className="border-b-2 border-dashed border-black pb-4">
          <div className="flex justify-between mb-1">
            <span>Total Orders:</span>
            <span className="font-bold">{totalOrders}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total Sales:</span>
            <span>Rs {totalSales.toLocaleString()}</span>
          </div>
        </div>

        <div>
          <h3 className="font-bold border-b border-black mb-2 uppercase">Payment Summary</h3>
          {Object.entries(paymentMethods).map(([method, amount]) => (
            <div key={method} className="flex justify-between mb-1">
              <span className="capitalize">{method}:</span>
              <span>Rs {(amount as number).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div>
          <h3 className="font-bold border-b border-black mb-2 uppercase">Order Type Summary</h3>
          <div className="flex justify-between mb-1">
            <span>Dine In ({ordersByType.dine_in.length}):</span>
            <span>Rs {typeTotals.dine_in.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Take Away ({ordersByType.take_away.length}):</span>
            <span>Rs {typeTotals.take_away.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span>Delivery ({ordersByType.delivery.length}):</span>
            <span>Rs {typeTotals.delivery.toLocaleString()}</span>
          </div>
        </div>

        {ordersByType.dine_in.length > 0 && (
          <div>
            <h3 className="font-bold border-b border-black mb-2 uppercase">Dine In Orders</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="pb-1">#</th>
                  <th className="pb-1">Time</th>
                  <th className="pb-1 text-right">Amt</th>
                </tr>
              </thead>
              <tbody>
                {ordersByType.dine_in.map((order) => (
                  <tr key={order.id} className="border-b border-dashed border-gray-300">
                    <td className="py-1">{order.id.slice(0, 6)}</td>
                    <td className="py-1">{format(new Date(order.created_at), 'HH:mm')}</td>
                    <td className="py-1 text-right">
                      {Number(order.total_amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ordersByType.take_away.length > 0 && (
          <div>
            <h3 className="font-bold border-b border-black mb-2 uppercase">Take Away Orders</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="pb-1">#</th>
                  <th className="pb-1">Time</th>
                  <th className="pb-1 text-right">Amt</th>
                </tr>
              </thead>
              <tbody>
                {ordersByType.take_away.map((order) => (
                  <tr key={order.id} className="border-b border-dashed border-gray-300">
                    <td className="py-1">{order.id.slice(0, 6)}</td>
                    <td className="py-1">{format(new Date(order.created_at), 'HH:mm')}</td>
                    <td className="py-1 text-right">
                      {Number(order.total_amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ordersByType.delivery.length > 0 && (
          <div>
            <h3 className="font-bold border-b border-black mb-2 uppercase">Delivery Orders</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="pb-1">#</th>
                  <th className="pb-1">Time</th>
                  <th className="pb-1 text-right">Amt</th>
                </tr>
              </thead>
              <tbody>
                {ordersByType.delivery.map((order) => (
                  <tr key={order.id} className="border-b border-dashed border-gray-300">
                    <td className="py-1">{order.id.slice(0, 6)}</td>
                    <td className="py-1">{format(new Date(order.created_at), 'HH:mm')}</td>
                    <td className="py-1 text-right">
                      {Number(order.total_amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-center mt-8 text-xs border-t border-black pt-2">
          <p>Generated at {format(new Date(), 'pp')}</p>
          <p>*** END OF REPORT ***</p>
        </div>
      </div>
    </div>
  );
});

DailyReport.displayName = 'DailyReport';
