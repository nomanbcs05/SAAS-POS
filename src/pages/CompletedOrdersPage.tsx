import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/services/api';
import {
  Search,
  CheckCircle2,
  Printer,
  X,
  History,
  MoreVertical,
  Trash2,
  ChevronRight,
  Utensils,
  ShoppingBag,
  Truck,
  CreditCard,
  User,
  Calendar,
  Package
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useReactToPrint } from 'react-to-print';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import Bill from '@/components/pos/Bill';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CompletedOrdersPage = () => {
  const navigate = useNavigate();
  const { tenant, cashierName: hookCashierName } = useMultiTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [billOrder, setBillOrder] = useState<any>(null);
  const billRef = useRef<HTMLDivElement>(null);
  const [cashierName, setCashierName] = useState(hookCashierName || 'Ali Hyder');
  const [showDetailPanel, setShowDetailPanel] = useState(() => {
    const saved = localStorage.getItem('completed_detail_panel');
    return saved !== 'false';
  });

  useEffect(() => {
    if (hookCashierName) {
      setCashierName(hookCashierName);
    }
  }, [hookCashierName]);

  useEffect(() => {
    localStorage.setItem('completed_detail_panel', showDetailPanel.toString());
  }, [showDetailPanel]);

  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['completed-orders'],
    queryFn: api.orders.getCompleted,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: api.products.getAll,
    staleTime: 1000 * 60 * 10,
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id: string) => api.orders.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['completed-orders'] });
      toast.success('Order record deleted');
      setSelectedOrderId(null);
    },
    onError: (error: any) => {
      toast.error('Failed to delete order record: ' + error.message);
    }
  });

  const handlePrintBill = useReactToPrint({
    contentRef: billRef,
    documentTitle: `Bill-${billOrder?.orderNumber || Date.now()}`,
    onAfterPrint: () => {
      toast.success('Bill printed successfully');
      setBillOrder(null);
    },
  });

  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    let result = orders;

    // Filter by type tab
    if (activeTab !== 'all') {
      result = result.filter(order => order.order_type === activeTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(order =>
        order.id.toLowerCase().includes(query) ||
        getDailyOrderNumber(order, orders).includes(query) ||
        order.customers?.name?.toLowerCase().includes(query) ||
        (order as any).restaurant_tables?.table_number?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [orders, activeTab, searchQuery]);

  const selectedOrder = useMemo(() => {
    if (!Array.isArray(orders)) return null;
    return orders.find(o => o.id === selectedOrderId);
  }, [orders, selectedOrderId]);

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'dine_in': return <Utensils className="h-4 w-4" />;
      case 'take_away': return <ShoppingBag className="h-4 w-4" />;
      case 'delivery': return <Truck className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getDailyOrderNumber = (order: any, allOrders: any[]) => {
    if (!order) return '00';
    if (order.daily_id) {
      return order.daily_id.toString().padStart(2, '0');
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sortedTodayOrders = allOrders
      .filter((o: any) => {
        if (!o.created_at) return false;
        const d = new Date(o.created_at);
        return !isNaN(d.getTime()) && d >= today;
      })
      .sort((a: any, b: any) => {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
      });
    const dailyIndex = sortedTodayOrders.findIndex((o: any) => o.id === order.id);
    if (dailyIndex !== -1) {
      return (dailyIndex + 1).toString().padStart(2, '0');
    }
    return order.id.slice(0, 8).toUpperCase();
  };

  const onPrintBill = (order: any) => {
    if (!order) return;
    const orderNumber = getDailyOrderNumber(order, orders);
    
    const billData = {
      id: order.id,
      orderNumber: orderNumber,
      items: order.order_items?.map((item: any) => {
        const matched = (products as any[]).find((p: any) =>
          p.id === item.product_id ||
          p.name === item.product_name
        );
        return {
          product: {
            id: item.product_id || matched?.id || '',
            name: item.product_name || matched?.name || 'Item',
            price: item.price,
            image: matched?.image || '🍽️'
          },
          quantity: item.quantity,
          lineTotal: item.price * item.quantity
        };
      }) || [],
      customer: order.customers ? {
        id: order.customer_id?.toString() || '',
        name: order.customers.name,
        phone: order.customers.phone || ''
      } : null,
      subtotal: order.total_amount,
      taxAmount: 0,
      discountAmount: 0,
      deliveryFee: 0,
      total: order.total_amount,
      paymentMethod: order.payment_method || 'cash',
      orderType: order.order_type,
      createdAt: new Date(order.created_at),
      cashierName,
      serverName: (order as any).server_name,
      tableId: (order as any).restaurant_tables?.table_number
    };
    setBillOrder(billData);
    setTimeout(() => {
      handlePrintBill();
    }, 500);
  };

  return (
    <MainLayout>
      <div className="flex h-full bg-slate-50/50 relative">
        {/* Left Side: Order List */}
        <div className="flex-1 flex flex-col min-w-0 border-r bg-white">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Completed Orders</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">History & Offline Records</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="px-3 py-1.5 text-xs font-black bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm">
                  {orders.length} Completed
                </Badge>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by ID, customer or table..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-slate-100/50 border-slate-200 focus:bg-white transition-all rounded-xl font-medium shadow-sm"
              />
            </div>

            {/* Filter Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-slate-100/80 p-1 h-11 rounded-xl w-full max-w-md border border-slate-200/50">
                <TabsTrigger value="all" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-xs font-black uppercase tracking-wider">All</TabsTrigger>
                <TabsTrigger value="dine_in" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-xs font-black uppercase tracking-wider">Dine in</TabsTrigger>
                <TabsTrigger value="take_away" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-xs font-black uppercase tracking-wider">To go</TabsTrigger>
                <TabsTrigger value="delivery" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all text-xs font-black uppercase tracking-wider">Delivery</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1 px-6 pb-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <History className="h-10 w-10 opacity-20" />
                </div>
                <p className="text-lg font-bold text-slate-500 uppercase tracking-tight">No completed orders found</p>
                <p className="text-xs font-medium mt-1">Completed orders will appear here for your records</p>
              </div>
            ) : (
              <div className="border border-slate-200/60 rounded-2xl overflow-hidden bg-white shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50/50 border-b border-slate-200/60">
                    <TableRow>
                      <TableHead className="w-[120px] font-black text-[10px] uppercase tracking-widest text-slate-500">Order ID</TableHead>
                      <TableHead className="w-[120px] font-black text-[10px] uppercase tracking-widest text-slate-500">Time</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-500">Customer / Table</TableHead>
                      <TableHead className="w-[120px] font-black text-[10px] uppercase tracking-widest text-slate-500">Type</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-500">Amount</TableHead>
                      <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-500">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className={cn(
                          "cursor-pointer hover:bg-slate-50/80 transition-colors border-slate-100",
                          selectedOrderId === order.id ? "bg-slate-50" : ""
                        )}
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        <TableCell className="font-bold text-slate-900 text-sm">
                          #{getDailyOrderNumber(order, orders)}
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs font-medium">
                          {(() => {
                            if (!order.created_at) return 'N/A';
                            try {
                              const d = new Date(order.created_at);
                              if (isNaN(d.getTime())) return 'N/A';
                              return format(d, 'h:mm a');
                            } catch (e) { return 'N/A'; }
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 text-sm">
                              {order.order_type === 'dine_in'
                                ? ((order as any).restaurant_tables?.table_number ? `Table ${(order as any).restaurant_tables.table_number}` : 'Table N/A')
                                : order.order_type === 'take_away' ? 'Take Away' : 'Delivery'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1">
                              <User className="h-2.5 w-2.5" />
                              {order.customers?.name || 'Walk-in Customer'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-600 uppercase tracking-wider">
                            {getOrderTypeIcon(order.order_type)}
                            <span>{order.order_type.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-slate-900">
                          Rs {order.total_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-slate-100 text-slate-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPrintBill(order);
                              }}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-100 rounded-lg">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-xl p-1.5 shadow-xl border-slate-200">
                                <DropdownMenuItem className="rounded-lg py-2 cursor-pointer font-bold text-xs" onClick={() => onPrintBill(order)}>
                                  <Printer className="h-4 w-4 mr-2 text-slate-400" />
                                  Re-print Bill
                                </DropdownMenuItem>
                                <Separator className="my-1.5 opacity-50" />
                                <DropdownMenuItem
                                  className="text-red-600 rounded-lg py-2 cursor-pointer font-bold text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Delete this completed order record?')) {
                                      deleteOrderMutation.mutate(order.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Record
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Side: Order Detail */}
        {showDetailPanel && (
          <div className="w-[420px] flex flex-col bg-white border-l shadow-2xl z-10 relative">
             <button
              onClick={() => setShowDetailPanel(false)}
              className="absolute -left-3 top-24 bg-white text-slate-600 w-7 h-7 rounded-full flex items-center justify-center shadow-lg border border-slate-200 hover:bg-slate-50"
              aria-label="Hide details"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {selectedOrder ? (
              <>
                <div className="p-6 border-b bg-slate-50/30 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded">
                          #{getDailyOrderNumber(selectedOrder, orders)}
                        </span>
                        <h2 className="text-xl font-black text-slate-900 leading-tight">
                          {selectedOrder.order_type === 'dine_in'
                            ? ((selectedOrder as any).restaurant_tables?.table_number
                              ? `Table ${(selectedOrder as any).restaurant_tables.table_number}`
                              : 'Table N/A')
                            : selectedOrder.order_type === 'take_away' ? 'Take Away' : 'Delivery'}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none text-[8px] font-black uppercase tracking-tighter py-0 px-1.5 h-4">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                          Paid & Completed
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount Paid</p>
                      <p className="text-xl font-black text-slate-900 leading-tight">Rs {selectedOrder.total_amount.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                        <User className="h-2.5 w-2.5" /> Customer
                      </p>
                      <p className="text-xs font-bold text-slate-900 truncate">{selectedOrder.customers?.name || 'Walk-in'}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                        <Calendar className="h-2.5 w-2.5" /> Date
                      </p>
                      <p className="text-xs font-bold text-slate-900">
                        {(() => {
                          if (!selectedOrder.created_at) return 'N/A';
                          try {
                            const d = new Date(selectedOrder.created_at);
                            if (isNaN(d.getTime())) return 'N/A';
                            return format(d, 'MMM dd, yyyy');
                          } catch (e) { return 'N/A'; }
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Ordered Items</h3>
                        <Badge variant="outline" className="text-[10px] font-bold text-slate-400 border-slate-200">
                          {selectedOrder.order_items?.length || 0} Items
                        </Badge>
                      </div>
                      <div className="space-y-2.5">
                        {selectedOrder.order_items?.map((item: any, index: number) => {
                          const matched = (products as any[]).find((p: any) =>
                            p.id === item.product_id || p.name === item.product_name
                          );
                          const displayImage = matched?.image || '🍽️';
                          const displayName = item.product_name || matched?.name || 'Item';
                          
                          return (
                            <div key={item.id || index} className="group flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
                              <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-white flex items-center justify-center text-lg shadow-sm overflow-hidden border border-slate-200/50">
                                {typeof displayImage === 'string' && displayImage.startsWith('http') ? (
                                  <img src={displayImage} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <span>{displayImage}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Unit: Rs {item.price.toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center h-7 w-7 bg-white text-slate-600 rounded-lg text-[10px] font-black border border-slate-100 shadow-sm">
                                  x{item.quantity}
                                </span>
                                <span className="text-xs font-black text-slate-900 min-w-[70px] text-right">
                                  Rs {(item.price * item.quantity).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Separator className="bg-slate-100" />

                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <span>Sub Total</span>
                        <span className="text-slate-900">Rs {selectedOrder.total_amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                        <span>Payment Method</span>
                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[9px] font-black uppercase tracking-tighter py-0 h-4">
                          <CreditCard className="h-2.5 w-2.5 mr-1" />
                          {selectedOrder.payment_method || 'Cash'}
                        </Badge>
                      </div>
                      <Separator className="my-2 bg-slate-200/60" />
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-sm font-black text-slate-900 uppercase tracking-widest">Grand Total</span>
                        <span className="text-xl font-black text-emerald-600">Rs {selectedOrder.total_amount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <div className="p-6 bg-white border-t space-y-3">
                  <Button
                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg transition-all"
                    onClick={() => onPrintBill(selectedOrder)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Receipt
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-11 font-black uppercase tracking-widest text-[10px] rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600" onClick={() => setSelectedOrderId(null)}>
                      Close Details
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 font-black uppercase tracking-widest text-[10px] rounded-xl border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => {
                         if (window.confirm('Delete this completed order record?')) {
                            deleteOrderMutation.mutate(selectedOrder.id);
                          }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-12 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                  <Package className="h-10 w-10 opacity-20" />
                </div>
                <h3 className="text-lg font-black text-slate-400 uppercase tracking-tighter">Order Summary</h3>
                <p className="text-xs font-medium text-slate-400 mt-2 max-w-[200px]">
                  Select an order from the list to view full details and print receipt.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hidden Bill for printing */}
        <div style={{ position: 'fixed', left: '-9999px', top: '0', width: '80mm', pointerEvents: 'none', zIndex: -1000 }}>
          {billOrder && (
            <Bill
              ref={billRef}
              order={billOrder}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default CompletedOrdersPage;
