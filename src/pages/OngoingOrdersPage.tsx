import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { api } from '@/services/api';
import {
  Search,
  Clock,
  Utensils,
  ShoppingBag,
  Truck,
  Printer,
  Edit2,
  X,
  CreditCard,
  History,
  CheckCircle2,
  MoreVertical,
  ClipboardList,
  Trash2,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useReactToPrint } from 'react-to-print';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { useCartStore } from '@/stores/cartStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import Bill from '@/components/pos/Bill';
import { supabase } from '@/integrations/supabase/client';

const OngoingOrdersPage = () => {
  const navigate = useNavigate();
  const { tenant, cashierName: hookCashierName } = useMultiTenant();
  const loadOrder = useCartStore(state => state.loadOrder);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [billOrder, setBillOrder] = useState<any>(null);
  const billRef = useRef<HTMLDivElement>(null);
  const [cashierName, setCashierName] = useState(hookCashierName || 'Ali Hyder');
  const [showDetailPanel, setShowDetailPanel] = useState(() => {
    const saved = localStorage.getItem('ongo_detail_panel');
    return saved !== 'false';
  });

  const getDailyOrderNumber = (order: any, allOrders?: any[]) => {
    if (!order) return '00';
    if (order.daily_id) {
      return order.daily_id.toString().padStart(2, '0');
    }
    if (Array.isArray(allOrders)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sortedTodayOrders = allOrders
        .filter((o: any) => new Date(o.created_at) >= today)
        .sort((a: any, b: any) => new Date(a.created_at) - new Date(b.created_at));
      const dailyIndex = sortedTodayOrders.findIndex((o: any) => o.id === order.id);
      if (dailyIndex !== -1) {
        return (dailyIndex + 1).toString().padStart(2, '0');
      }
    }
    return order.id?.slice(0, 8).toUpperCase() || '00';
  };

  useEffect(() => {
    if (hookCashierName) {
      setCashierName(hookCashierName);
    }
  }, [hookCashierName]);

  useEffect(() => {
    localStorage.setItem('ongo_detail_panel', showDetailPanel.toString());
  }, [showDetailPanel]);

  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['ongoing-orders'],
    queryFn: api.orders.getOngoing,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: api.products.getAll,
    staleTime: 1000 * 60 * 10,
  });

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.orders.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });
      toast.success('Order status updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update status: ' + error.message);
    }
  });

  // Clear all mutation
  const clearAllMutation = useMutation({
    mutationFn: api.orders.clearAllToday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });
      toast.success('All today\'s orders cleared');
      setSelectedOrderId(null);
    },
    onError: (error: any) => {
      toast.error('Failed to clear orders: ' + error.message);
    }
  });

  // Update order items mutation
  const updateOrderItemsMutation = useMutation({
    mutationFn: async ({ orderId, items }: { orderId: string; items: any[] }) => {
      return api.orders.updateItems(orderId, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });
      setIsEditing(false);
      toast.success('Order updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update order: ' + error.message);
    }
  });

  // Pay order mutation
  const payOrderMutation = useMutation({
    mutationFn: async ({ orderId, paymentMethod }: { orderId: string; paymentMethod: string }) => {
      return api.orders.updateStatus(orderId, 'completed');
    },
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });

      // Prepare bill data
      const order = selectedOrder;
      if (order) {
        const billData = {
          id: order.id,
          orderNumber: getDailyOrderNumber(order, orders),
          items: order.order_items?.map((item: any) => {
            const matched = (products as any[]).find((p: any) =>
              p.id === item.product_id ||
              p.name === item.product_name ||
              (p.price === item.price && (!item.product_category || p.category === item.product_category))
            );
            return {
              product: {
                id: item.product_id || matched?.id || '',
                name: item.products?.name || item.product_name || matched?.name || 'Item',
                price: item.price,
                image: item.products?.image || matched?.image || '🍽️'
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
          paymentMethod: 'cash',
          orderType: order.order_type,
          createdAt: new Date(order.created_at),
          cashierName,
          serverName: (order as any).server_name,
          tableId: (order as any).restaurant_tables?.table_number
        };
        setBillOrder(billData);
        // Print Bill after a short delay to allow state update
        setTimeout(() => {
          handlePrintBill();
        }, 500);
      }
    },
    onError: (error: any) => {
      toast.error('Failed to process payment: ' + error.message);
    }
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: (id: string) => api.orders.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });
      toast.success('Order cancelled and deleted');
      setSelectedOrderId(null);
    },
    onError: (error: any) => {
      toast.error('Failed to cancel order: ' + error.message);
    }
  });

  const handlePrintBill = useReactToPrint({
    contentRef: billRef,
    documentTitle: `Bill-${billOrder?.orderNumber || Date.now()}`,
    onAfterPrint: async () => {
      toast.success('Bill printed successfully');

      // If we have a bill order and it has an ID, update its status to completed
      if (billOrder?.id) {
        try {
          await api.orders.updateStatus(billOrder.id, 'completed');
          queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });
          toast.success('Order marked as completed');
        } catch (error) {
          console.error('Failed to update order status after printing:', error);
          toast.error('Failed to mark order as completed');
        }
      }

      setBillOrder(null);
    },
  });

  const handleEditOrder = () => {
    if (selectedOrder) {
      loadOrder(selectedOrder);
      navigate('/');
    }
  };

  const handleQuickEdit = () => {
    if (selectedOrder) {
      setEditedItems(selectedOrder.order_items.map((item: any) => ({ ...item })));
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    if (selectedOrderId) {
      updateOrderItemsMutation.mutate({
        orderId: selectedOrderId,
        items: editedItems
      });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedItems([]);
  };

  const handleUpdateItemQuantity = (index: number, delta: number) => {
    const newItems = [...editedItems];
    newItems[index].quantity = Math.max(1, newItems[index].quantity + delta);
    setEditedItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = editedItems.filter((_, i) => i !== index);
    setEditedItems(newItems);
  };

  const handlePayNow = () => {
    if (selectedOrderId) {
      payOrderMutation.mutate({ orderId: selectedOrderId, paymentMethod: 'cash' });
    }
  };

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
        order.restaurant_tables?.table_number?.toLowerCase().includes(query)
      );
    }

    // Filter out completed orders to "move" them to history
    result = result.filter(order => order.status !== 'completed');

    // Filter by Role (using server_name tag)
    const activeRole = localStorage.getItem('active_role');
    if (activeRole && activeRole !== 'admin') {
      result = result.filter(order => {
        const serverName = (order as any).server_name || '';
        return serverName.startsWith(`[${activeRole}]`);
      });
    }

    return result;
  }, [orders, activeTab, searchQuery]);

  const selectedOrder = useMemo(() => {
    if (!Array.isArray(orders)) return null;
    return orders.find(o => o.id === selectedOrderId);
  }, [orders, selectedOrderId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'preparing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ready': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case 'dine_in': return <Utensils className="h-4 w-4" />;
      case 'take_away': return <ShoppingBag className="h-4 w-4" />;
      case 'delivery': return <Truck className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <MainLayout>
      <div className="flex h-full bg-slate-50/50 relative">
        {/* Left Side: Order List */}
        <div className="flex-1 flex flex-col min-w-0 border-r bg-white">
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-slate-900">Running Orders</h1>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50 font-bold"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear all of today\'s orders?')) {
                      clearAllMutation.mutate();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
                <Badge variant="outline" className="px-3 py-1 text-sm font-medium bg-white shadow-sm">
                  {orders.length} Active
                </Badge>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search for foods, tables, or customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-slate-100/50 border-slate-200 focus:bg-white transition-all rounded-xl"
              />
            </div>

            {/* Filter Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="bg-slate-100/80 p-1 h-11 rounded-xl w-full max-w-md">
                <TabsTrigger value="all" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">All</TabsTrigger>
                <TabsTrigger value="dine_in" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">Dine in</TabsTrigger>
                <TabsTrigger value="take_away" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">To go</TabsTrigger>
                <TabsTrigger value="delivery" className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">Delivery</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1 px-6 pb-6">
            {isLoading ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <History className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium">No ongoing orders found</p>
                <p className="text-sm">New orders will appear here as they are created</p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[100px] font-bold text-slate-900">Order ID</TableHead>
                      <TableHead className="w-[100px] font-bold text-slate-900">Time</TableHead>
                      <TableHead className="font-bold text-slate-900">Customer / Table</TableHead>
                      <TableHead className="font-bold text-slate-900">Type</TableHead>
                      <TableHead className="text-right font-bold text-slate-900">Amount</TableHead>
                      <TableHead className="text-center font-bold text-slate-900">Status</TableHead>
                      <TableHead className="text-right font-bold text-slate-900">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className={cn(
                          "cursor-pointer hover:bg-blue-50/50 transition-colors",
                          selectedOrderId === order.id ? "bg-blue-50" : ""
                        )}
                        onClick={() => setSelectedOrderId(order.id)}
                      >
                        <TableCell className="font-medium text-slate-600">
                          #{getDailyOrderNumber(order, orders)}
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs">
                          {order.created_at ? format(new Date(order.created_at), 'h:mm a') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">
                              {order.order_type === 'dine_in'
                                ? ((order as any).restaurant_tables?.table_number ? `Table ${(order as any).restaurant_tables.table_number}` : 'Table N/A')
                                : order.order_type === 'take_away' ? 'Take Away' : 'Delivery'}
                            </span>
                            <span className="text-xs text-slate-500">
                              {order.customers?.name || 'Walk-in Customer'}
                              {(order as any).server_name && ` • Server: ${(order as any).server_name.replace(/^\[.*?\]\s*/, '')}`}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                            {getOrderTypeIcon(order.order_type)}
                            <span className="capitalize">{order.order_type.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          Rs {order.total_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn("text-[10px] uppercase font-black px-2 py-0 border-2", getStatusColor(order.status))}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 px-3 font-bold text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all"
                              onClick={(e) => {
                                e.stopPropagation();
                                const billData = {
                                  id: order.id,
                                  orderNumber: getDailyOrderNumber(order, orders),
                                  items: order.order_items?.map((item: any) => ({
                                    product: {
                                      id: item.product_id,
                                      name: item.products?.name || item.product_name || 'Item',
                                      price: item.price,
                                      image: item.products?.image || '🍽️'
                                    },
                                    quantity: item.quantity,
                                    lineTotal: item.price * item.quantity
                                  })) || [],
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
                                  // Print Bill after a short delay to allow state update
                                  setTimeout(() => {
                                    handlePrintBill();
                                  }, 500);
                                }}
                              >
                                <Printer className="h-3.5 w-3.5 mr-1.5" />
                                Generate Bill
                              </Button>
                            <Button
                              size="sm"
                              variant={order.status === 'completed' ? "outline" : "default"}
                              className={cn(
                                "h-8 px-3 font-bold text-xs",
                                order.status !== 'completed' && "bg-blue-600 hover:bg-blue-700 text-white"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrderId(order.id);
                                setTimeout(() => handlePayNow(), 100);
                              }}
                              disabled={order.status === 'completed'}
                            >
                              {order.status === 'completed' ? 'Paid' : 'Pay'}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  toast.info('Pay later feature coming soon');
                                }}>
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Pay Later
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  const billData = {
                                    id: order.id,
                                    orderNumber: getDailyOrderNumber(order, orders),
                                    items: order.order_items?.map((item: any) => ({
                                      product: {
                                        id: item.product_id,
                                        name: item.products?.name || item.product_name || 'Item',
                                        price: item.price,
                                        image: item.products?.image || '🍽️'
                                      },
                                      quantity: item.quantity,
                                      lineTotal: item.price * item.quantity
                                    })) || [],
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
                                    serverName: ((order as any).server_name || '').replace(/^\[.*?\]\s*/, ''),
                                    tableId: (order as any).restaurant_tables?.table_number
                                  };
                                  setBillOrder(billData);
                                  // Print Bill after a short delay to allow state update
                                  setTimeout(() => {
                                    handlePrintBill();
                                  }, 500);
                                }}>
                                  <Printer className="h-4 w-4 mr-2" />
                                  Print Bill
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditOrder();
                                }}>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit Order
                                </DropdownMenuItem>
                                <Separator className="my-1" />
                                <DropdownMenuItem className="text-red-600" onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Are you sure you want to cancel this order?')) {
                                    deleteOrderMutation.mutate(order.id);
                                  }
                                }}>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Cancel
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
                <div className="p-3 border-b space-y-2.5 bg-slate-50/30">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h2 className="text-base font-black text-slate-900 leading-tight">
                        {selectedOrder.order_type === 'dine_in'
                          ? ((selectedOrder as any).restaurant_tables?.table_number
                            ? `Table ${(selectedOrder as any).restaurant_tables.table_number}`
                            : 'Table N/A')
                          : selectedOrder.order_type === 'take_away' ? 'Take Away' : 'Delivery'}
                      </h2>
                      <p className="text-[10px] text-slate-500 font-medium leading-tight">
                        {selectedOrder.customers?.name || 'Walk-in Customer'}
                      </p>
                      {(selectedOrder as any).server_name && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none text-[8px] font-black uppercase tracking-tighter py-0 px-1 h-3.5">
                            Server: {((selectedOrder as any).server_name || '').replace(/^\[.*?\]\s*/, '')}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36 rounded-lg">
                        <DropdownMenuItem className="py-1.5 text-xs" onClick={handleEditOrder}>
                          <Edit2 className="h-3 w-3 mr-2" />
                          Edit in POS
                        </DropdownMenuItem>
                        <DropdownMenuItem className="py-1.5 text-xs">Transfer Table</DropdownMenuItem>
                        <DropdownMenuItem className="py-1.5 text-xs text-red-600">Cancel Order</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 px-1.5 py-0 text-[9px] font-bold h-4">
                      {getOrderTypeIcon(selectedOrder.order_type)}
                      <span className="ml-1 capitalize">{selectedOrder.order_type.replace('_', ' ')}</span>
                    </Badge>
                    {selectedOrder.status !== 'ready' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto h-6 px-1.5 text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 font-bold rounded"
                        onClick={() => updateStatusMutation.mutate({
                          id: selectedOrder.id,
                          status: selectedOrder.status === 'pending' ? 'preparing' : 'ready'
                        })}
                      >
                        {selectedOrder.status === 'pending' ? 'Start' : 'Ready'}
                      </Button>
                    )}
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <span>Items</span>
                        <span>Qty / Price</span>
                      </div>
                      <div className="space-y-4">
                        {(isEditing ? editedItems : selectedOrder.order_items)?.map((item: any, index: number) => {
                          const byIdOrName = (products as any[]).find((p: any) =>
                            p.id === item.product_id ||
                            (item.product_name && p.name === item.product_name)
                          );
                          let matched = byIdOrName;
                          if (!matched) {
                            const priceMatches = (products as any[]).filter((p: any) => p.price === item.price);
                            if (priceMatches.length === 1) {
                              matched = priceMatches[0];
                            } else if (priceMatches.length > 1) {
                              const catFiltered = item.product_category
                                ? priceMatches.filter(p => p.category === item.product_category)
                                : priceMatches;
                              matched = (catFiltered[0] || priceMatches[0]) as any;
                            }
                          }
                          const displayImage = item.products?.image || matched?.image || '🍽️';
                          // Prioritize snapshot name (item.product_name) over current catalog name (item.products.name)
                          const displayName = item.product_name || item.products?.name || matched?.name || 'Item';
                          return (
                            <div key={item.id || index} className="group flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-white flex items-center justify-center text-xl shadow-sm overflow-hidden border border-slate-200">
                                {typeof displayImage === 'string' && displayImage.startsWith('http') ? (
                                  <img src={displayImage} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <span>{displayImage}</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{displayName}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Unit: Rs {item.price.toLocaleString()}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {isEditing ? (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 rounded-lg"
                                      onClick={() => handleUpdateItemQuantity(index, -1)}
                                    >
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="flex items-center justify-center h-9 w-9 bg-blue-100 text-blue-700 rounded-lg text-sm font-black min-w-[36px]">
                                      {item.quantity}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 rounded-lg"
                                      onClick={() => handleUpdateItemQuantity(index, 1)}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-500 hover:text-red-600"
                                      onClick={() => handleRemoveItem(index)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </>
                                ) : (
                                  <span className="flex items-center justify-center h-8 w-8 bg-blue-100 text-blue-700 rounded-lg text-xs font-black">
                                    x{item.quantity}
                                  </span>
                                )}
                                <span className="text-sm font-black text-slate-900 min-w-[70px] text-right">
                                  Rs {(item.price * item.quantity).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <Separator className="bg-slate-100" />

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-medium text-slate-500">
                        <span>Sub Total</span>
                        <span className="text-slate-900 font-bold">
                          Rs {isEditing
                            ? editedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()
                            : selectedOrder.total_amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-medium text-slate-500">
                        <span>Discount</span>
                        <span className="text-emerald-600 font-bold">-Rs 0</span>
                      </div>
                      <div className="flex justify-between text-lg font-black text-slate-900 pt-2 border-t border-dashed border-slate-200">
                        <span>Total Payment</span>
                        <span>
                          Rs {isEditing
                            ? editedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toLocaleString()
                            : selectedOrder.total_amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <div className="p-6 border-t bg-slate-50/50 space-y-3">
                  {isEditing ? (
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 h-12 font-bold border-slate-200 text-slate-600 rounded-xl"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                        onClick={handleSaveEdit}
                        disabled={updateOrderItemsMutation.isPending}
                      >
                        {updateOrderItemsMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1 h-12 font-bold border-slate-200 text-slate-600 rounded-xl"
                          onClick={() => navigate('/')}
                        >
                          Back to POS
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 h-12 font-bold border-slate-200 text-slate-600 rounded-xl"
                          onClick={handleEditOrder}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit in POS
                        </Button>
                      </div>
                      <Button
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-lg shadow-blue-200 rounded-xl"
                        onClick={handlePayNow}
                        disabled={payOrderMutation.isPending || selectedOrder.status === 'completed'}
                      >
                        {payOrderMutation.isPending ? 'Processing...' : selectedOrder.status === 'completed' ? 'Paid' : 'Pay Now'}
                      </Button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 bg-slate-50/20">
                <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center mb-6">
                  <ClipboardList className="h-10 w-10 text-slate-200" />
                </div>
                <p className="text-lg font-bold text-slate-900 mb-2">Select an Order</p>
                <p className="text-sm font-medium leading-relaxed">
                  Click on any order card to see details, manage items, and process payments.
                </p>
              </div>
            )}
          </div>
        )}
        {!showDetailPanel && (
          <button
            onClick={() => setShowDetailPanel(true)}
            className="absolute right-2 top-24 bg-white text-slate-600 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border border-slate-200 hover:bg-slate-50"
            aria-label="Show details"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Hidden Printing Container */}
      <div className="hidden">
        {billOrder && (
          <Bill ref={billRef} order={billOrder} />
        )}
      </div>
    </MainLayout>
  );
};

export default OngoingOrdersPage;
