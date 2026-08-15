import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TrendingUp, DollarSign, ShoppingCart, Users, Package, ArrowUpRight, ArrowDownRight, Loader2, Printer, LogOut, Trash2, Calendar as CalendarIcon, Download, Clock } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { shiftService } from '@/services/shiftService';
import { useState, useMemo, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { DailyReport } from '@/components/pos/DailyReport';
import DailySummary from '@/components/pos/DailySummary';
import ProductSalesSummary from '@/components/pos/ProductSalesSummary';
import ActiveShiftsModal from '@/components/pos/ActiveShiftsModal';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isDesktop } from '@/lib/env';
import { 
  startOfDay, 
  startOfWeek, 
  startOfMonth, 
  isAfter, 
  format, 
  subDays, 
  subWeeks, 
  subMonths,
  parseISO, 
  isWithinInterval,
  endOfDay,
  isToday,
  differenceInCalendarDays
} from 'date-fns';
import { toast } from 'sonner';

const ReportsPage = () => {
    // --- Clear Orders Mutations ---
    const deleteTodayMutation = useMutation({
      mutationFn: api.orders.deleteTodayOrders,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['reports-data'] });
        toast.success("Today's orders cleared successfully");
      },
      onError: (error) => {
        toast.error(`Failed to clear orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    const fixOrphanedOrdersMutation = useMutation({
      mutationFn: api.orders.fixOrphanedOrders,
      onSuccess: (count) => {
        queryClient.invalidateQueries({ queryKey: ['reports-data'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['tenant'] });
        if (count > 0) {
          toast.success(`Successfully restored ${count} orders and restaurant settings!`);
          // Reload to ensure logo and settings are refreshed
          setTimeout(() => window.location.reload(), 1500);
        } else {
          toast.info("No missing orders found, but settings were re-synced.");
          setTimeout(() => window.location.reload(), 1000);
        }
      },
      onError: (error) => {
        toast.error(`Failed to restore: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    const deleteAllMutation = useMutation({
      mutationFn: api.orders.deleteAllOrders,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['reports-data'] });
        toast.success("All order history cleared successfully");
      },
      onError: (error) => {
        toast.error(`Failed to clear history: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [productOrdersWithItems, setProductOrdersWithItems] = useState<any[]>([]);
  const [isActiveShiftsOpen, setIsActiveShiftsOpen] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const productSummaryRef = useRef<HTMLDivElement>(null);

  const { data: activeShifts = [], refetch: refetchActiveShifts } = useQuery({
    queryKey: ['active-shifts'],
    queryFn: async () => shiftService.getActiveShifts(),
  });

  const { data, isLoading: isReportsLoading, isError, error } = useQuery({
    queryKey: ['reports-data'],
    queryFn: api.reports.getDashboardStats,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.getAll,
  });

  const { data: openRegister } = useQuery({
    queryKey: ['open-register'],
    queryFn: api.registers.getOpen,
  });

  const closeRegisterMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string, amount: number }) => 
      api.registers.close(id, amount, 'Shift ended by cashier'),
    onSuccess: async () => {
      toast.success('Shift ended successfully');
      localStorage.removeItem("pos_local_user");
      localStorage.removeItem("pos_daily_counter");
      localStorage.removeItem("pos_session_id");
      localStorage.removeItem("pos_offline_session");
      localStorage.removeItem("pos_offline_profile");
      if (!isDesktop()) {
        await supabase.auth.signOut();
      }
      navigate("/auth");
    },
    onError: (err: any) => {
      toast.error('Failed to end shift: ' + err.message);
    }
  });

  const handleEndShift = () => {
    if (!openRegister) {
      toast.error('No active shift found');
      return;
    }

    if (window.confirm('Are you sure you want to end your shift? This will log you out and close the register.')) {
      // For simplicity, we use the current total revenue as ending amount
      // In a real app, you might ask for a manual count
      const currentRevenue = stats?.revenue || 0;
      closeRegisterMutation.mutate({ 
        id: openRegister.id, 
        amount: openRegister.starting_amount + currentRevenue 
      });
    }
  };

  const getRangeInterval = () => {
    const start = dateRange?.from ? startOfDay(dateRange.from) : startOfDay(new Date());
    const end = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(dateRange?.from ?? new Date());
    return { start, end };
  };

  const rangeInterval = getRangeInterval();

  const handlePrintSummary = useReactToPrint({
    contentRef: summaryRef,
    documentTitle: `Sales-Summary-${format(rangeInterval.start, 'yyyy-MM-dd')}${dateRange?.to ? `-to-${format(rangeInterval.end, 'yyyy-MM-dd')}` : ''}`,
    onAfterPrint: async () => {
      try {
        await api.reports.saveGeneratedReport(
          'daily_summary', 
          rangeInterval.start.toISOString(), 
          { 
            orderCount: summaryOrders.length,
            totalRevenue: summaryOrders.reduce((s, o) => s + Number(o.total_amount), 0),
            dateRange: { from: rangeInterval.start, to: rangeInterval.end }
          }
        );
        toast.success('Summary printed and saved successfully');
      } catch (e) {
        toast.success('Summary printed successfully');
        console.error('Failed to save report to DB:', e);
      }
    },
  });

  const handlePrintProductSummary = useReactToPrint({
    contentRef: productSummaryRef,
    documentTitle: `Product-Summary-${format(rangeInterval.start, 'yyyy-MM-dd')}${dateRange?.to ? `-to-${format(rangeInterval.end, 'yyyy-MM-dd')}` : ''}`,
    onAfterPrint: async () => {
      try {
        await api.reports.saveGeneratedReport(
          'product_summary', 
          rangeInterval.start.toISOString(), 
          { 
            itemCount: productOrdersWithItems.flatMap(o => o.order_items || []).length,
            dateRange: { from: rangeInterval.start, to: rangeInterval.end }
          }
        );
        toast.success('Product summary printed and saved successfully');
      } catch (e) {
        toast.success('Product summary printed successfully');
        console.error('Failed to save report to DB:', e);
      }
    },
  });

  const onPrintProductSummary = async () => {
    try {
      if (!data?.orders || data.orders.length === 0) {
        toast.info('No orders found for summary');
        return;
      }

      const { start, end } = rangeInterval;
      const dayOrders = data.orders.filter((o: any) => {
        if (!o.created_at) return false;
        const d = parseISO(o.created_at);
        return isWithinInterval(d, { start, end }) && o.status === 'completed';
      });

      if (dayOrders.length === 0) {
        toast.info('No completed orders in selected range');
        return;
      }

      const toastId = toast.loading('Preparing product summary...');
      const fullOrders = await Promise.all(
        dayOrders.map(async (o: any) => {
          try {
            return await api.orders.getByIdWithItems(o.id);
          } catch {
            return null;
          }
        })
      );
      toast.dismiss(toastId);

      const valid = fullOrders.filter(Boolean) as any[];
      if (valid.length === 0) {
        toast.error('Failed to load order items for summary');
        return;
      }

      setProductOrdersWithItems(valid);
      setTimeout(() => handlePrintProductSummary(), 100);
    } catch (e) {
      console.error(e);
      toast.error('Error preparing product summary');
    }
  };

  const stats = useMemo(() => {
    if (!data?.orders || !data?.customers) return null;
    const now = new Date();

    // Check if we are in active shift mode or historical date range mode
    const currentShift = shiftService.getCurrentCashierOpenShift();
    const openShifts = activeShifts.filter((s: any) => s.status === 'open');
    const isShiftMode = !dateRange?.from;

    let startDate: Date;
    let endDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;

    if (dateRange?.from) {
      // Historical Date Range Mode
      startDate = startOfDay(dateRange.from);
      endDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      const days = differenceInCalendarDays(endDate, startDate) + 1;
      previousEndDate = subDays(startDate, 1);
      previousStartDate = startOfDay(subDays(previousEndDate, days - 1));
    } else if (currentShift?.opened_at) {
      // Active Shift Mode (Default): Only from shift start time to now!
      startDate = new Date(currentShift.opened_at);
      endDate = new Date();
      previousStartDate = subDays(startDate, 1);
      previousEndDate = subDays(endDate, 1);
    } else if (openShifts.length > 0 && openShifts[0].opened_at) {
      startDate = new Date(openShifts[0].opened_at);
      endDate = new Date();
      previousStartDate = subDays(startDate, 1);
      previousEndDate = subDays(endDate, 1);
    } else {
      // Fallback to today's start
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      previousStartDate = startOfDay(subDays(now, 1));
      previousEndDate = endOfDay(subDays(now, 1));
    }

    // Filter current period orders (active shift or date range)
    const currentOrders = data.orders.filter(order => {
      if (!order.created_at || order.status !== 'completed') return false;
      const orderDate = parseISO(order.created_at);
      const matchesTime = isWithinInterval(orderDate, { start: startDate, end: endDate }) || orderDate >= startDate;
      if (isShiftMode && currentShift?.id && order.register_id) {
        return order.register_id === currentShift.id || matchesTime;
      }
      return matchesTime;
    });

    // Filter previous period orders (for comparison)
    const previousOrders = data.orders.filter(order => {
      if (!order.created_at || order.status !== 'completed') return false;
      const orderDate = parseISO(order.created_at);
      return isWithinInterval(orderDate, { start: previousStartDate, end: previousEndDate });
    });

    const isCreditOrder = (o: any) => o.payment_method === 'credit' || (o.payment_method || '').toLowerCase() === 'credit';
    const isCashOrder = (o: any) => !o.payment_method || o.payment_method === 'cash' || (o.payment_method || '').toLowerCase() === 'cash';
    const isCardOrder = (o: any) => o.payment_method === 'card' || (o.payment_method || '').toLowerCase() === 'card' || (o.payment_method || '').toLowerCase() === 'online';

    // Calculate metrics - Exclude unpaid Credit orders from Total Revenue
    const currentRevenue = currentOrders
      .filter(order => !isCreditOrder(order))
      .reduce((sum, order) => sum + Number(order.total_amount), 0);

    const cashRevenue = currentOrders
      .filter(order => isCashOrder(order))
      .reduce((sum, order) => sum + Number(order.total_amount), 0);

    const cardRevenue = currentOrders
      .filter(order => isCardOrder(order))
      .reduce((sum, order) => sum + Number(order.total_amount), 0);

    const pendingCreditRevenue = currentOrders
      .filter(order => isCreditOrder(order))
      .reduce((sum, order) => sum + Number(order.total_amount), 0);

    const startingCash = currentShift ? Number(currentShift.starting_amount) || 0 : (openShifts[0] ? Number(openShifts[0].starting_amount) || 0 : 0);
    const totalCashInDrawer = startingCash + cashRevenue;

    const previousRevenue = previousOrders
      .filter(order => !isCreditOrder(order))
      .reduce((sum, order) => sum + Number(order.total_amount), 0);

    const currentOrdersCount = currentOrders.length;
    const previousOrdersCount = previousOrders.length;

    const currentAvgOrderValue = currentOrdersCount > 0 ? currentRevenue / currentOrdersCount : 0;
    const previousAvgOrderValue = previousOrdersCount > 0 ? previousRevenue / previousOrdersCount : 0;

    // New Customers
    const newCustomers = data.customers.filter(customer => {
      if (!customer.created_at) return false;
      const customerDate = parseISO(customer.created_at);
      return isWithinInterval(customerDate, { start: startDate, end: endDate });
    }).length;

    const previousNewCustomers = data.customers.filter(customer => {
      if (!customer.created_at) return false;
      const customerDate = parseISO(customer.created_at);
      return isWithinInterval(customerDate, { start: previousStartDate, end: previousEndDate });
    }).length;

    // Calculate growth percentages
    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const revenueGrowth = calculateGrowth(currentRevenue, previousRevenue);
    const ordersGrowth = calculateGrowth(currentOrdersCount, previousOrdersCount);
    const avgOrderValueGrowth = calculateGrowth(currentAvgOrderValue, previousAvgOrderValue);
    const customersGrowth = calculateGrowth(newCustomers, previousNewCustomers);

    // Prepare Chart Data (Excluding unpaid credit orders)
    const salesDataMap = new Map<string, number>();
    const chartFormat = differenceInCalendarDays(endDate, startDate) <= 1 ? 'HH:00' : 'dd MMM';

    currentOrders.forEach(order => {
      if (!order.created_at || isCreditOrder(order)) return;
      const orderDate = parseISO(order.created_at);
      const dateKey = format(orderDate, chartFormat);
      salesDataMap.set(dateKey, (salesDataMap.get(dateKey) || 0) + Number(order.total_amount));
    });

    const salesData = Array.from(salesDataMap.entries()).map(([name, sales]) => ({ name, sales }));

    // Category Data
    const categoryMap = new Map<string, number>();
    currentOrders.forEach(order => {
      if (order.order_items) {
        order.order_items.forEach((item: any) => {
          const categoryId = item.products?.category || item.product_category;
          const categoryName = categories.find((c: any) => c.id === categoryId)?.name || categoryId || 'Unknown';
          const value = Number(item.price) * item.quantity;
          categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + value);
        });
      }
    });

    const categoryColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const categoryData = Array.from(categoryMap.entries()).map(([name, value], index) => ({
      name,
      value: Number((value || 0).toFixed(2)),
      color: categoryColors[index % categoryColors.length],
    }));

    // Top Products
    const productMap = new Map<string, { sold: number; revenue: number }>();
    currentOrders.forEach(order => {
      if (order.order_items) {
        order.order_items.forEach((item: any) => {
          const name = item.products?.name || item.product_name || 'Unknown';
          const existing = productMap.get(name) || { sold: 0, revenue: 0 };
          productMap.set(name, {
            sold: existing.sold + item.quantity,
            revenue: existing.revenue + Number(item.price) * item.quantity,
          });
        });
      }
    });

    const topProducts = Array.from(productMap.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      revenue: currentRevenue,
      cashRevenue,
      cardRevenue,
      startingCash,
      totalCashInDrawer,
      revenueGrowth,
      orders: currentOrdersCount,
      ordersGrowth,
      avgOrderValue: currentAvgOrderValue,
      avgOrderValueGrowth,
      newCustomers,
      customersGrowth,
      pendingCreditRevenue,
      salesData,
      categoryData,
      topProducts,
      isShiftMode,
      activeShiftInfo: currentShift || openShifts[0] || null,
      periodLabel: isShiftMode 
        ? (currentShift ? `Active Shift (${currentShift.cashier_name})` : (openShifts[0] ? `Active Shift (${openShifts[0].cashier_name})` : "Today's Active Shift"))
        : `Selected Period: ${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`
    };
  }, [data, dateRange, categories, activeShifts]);

  const summaryOrders = useMemo(() => {
    if (!data?.orders) return [];
    const currentShift = shiftService.getCurrentCashierOpenShift();
    const openShifts = activeShifts.filter((s: any) => s.status === 'open');

    if (!dateRange?.from && (currentShift?.opened_at || openShifts[0]?.opened_at)) {
      const shiftStartTime = new Date(currentShift?.opened_at || openShifts[0].opened_at);
      return data.orders.filter((order: any) => {
        if (!order.created_at || order.status !== 'completed') return false;
        const orderDate = parseISO(order.created_at);
        return orderDate >= shiftStartTime;
      });
    }

    const { start, end } = getRangeInterval();
    const filtered = data.orders.filter((order: any) => {
      if (!order.created_at || order.status !== 'completed') return false;
      const orderDate = parseISO(order.created_at);
      return isWithinInterval(orderDate, { start, end });
    });
    return filtered;
  }, [data?.orders, dateRange, activeShifts]);

  if (isError) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <p className="text-destructive font-medium">Failed to load reports</p>
            <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (isReportsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Reports & Analytics</h1>
              <p className="text-muted-foreground">Business performance overview</p>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3">
              <Button 
                onClick={() => {
                  refetchActiveShifts();
                  setIsActiveShiftsOpen(true);
                }} 
                variant="outline" 
                className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold shadow-sm"
              >
                <Clock className="h-4 w-4" />
                Active Shifts
              </Button>
              <Button onClick={() => handlePrintSummary()} variant="outline" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Printer className="h-4 w-4" />
                Print Order Summary
              </Button>
              <Button onClick={() => onPrintProductSummary()} variant="outline" className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <Printer className="h-4 w-4" />
                Print Item Summary
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={dateRange?.from ? 'default' : 'outline'}
                    className={!dateRange?.from ? 'text-muted-foreground' : ''}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ?
                        `${format(dateRange.from, 'LLL dd, y')} - ${format(dateRange.to, 'LLL dd, y')}` :
                        format(dateRange.from, 'LLL dd, y')
                    ) : (
                      'Date Range'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                  <div className="p-3 border-t flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDateRange(undefined)}
                      className="text-xs h-8"
                    >
                      Clear Range
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Active Shift / Period Indicator Banner */}
          <div className={cn(
            "p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm",
            stats?.isShiftMode 
              ? "bg-emerald-50/70 border-emerald-200 text-emerald-950" 
              : "bg-blue-50/70 border-blue-200 text-blue-950"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm",
                stats?.isShiftMode ? "bg-emerald-600" : "bg-blue-600"
              )}>
                {stats?.isShiftMode ? <Clock className="h-5 w-5" /> : <CalendarIcon className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm uppercase tracking-wide">
                    {stats?.periodLabel}
                  </span>
                  {stats?.isShiftMode && (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                      LIVE SHIFT ONLY
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats?.isShiftMode 
                    ? "Displaying revenue and cash collected exclusively for the active shift session."
                    : "Displaying aggregated historical sales and revenue for the selected date range."}
                </p>
              </div>
            </div>

            {stats?.isShiftMode && (
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold bg-white/80 border border-emerald-200/80 px-4 py-2 rounded-lg">
                <div>
                  <span className="text-slate-500">Starting Cash: </span>
                  <span className="font-bold text-slate-900">Rs {(stats?.startingCash || 0).toLocaleString()}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div>
                  <span className="text-slate-500">Cash Collected: </span>
                  <span className="font-bold text-emerald-600">Rs {(stats?.cashRevenue || 0).toLocaleString()}</span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div>
                  <span className="text-slate-500">In Drawer: </span>
                  <span className="font-black text-slate-900">Rs {(stats?.totalCashInDrawer || 0).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-emerald-100 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stats?.isShiftMode ? 'Shift Revenue' : 'Total Revenue'}</p>
                    <p className="text-2xl font-bold text-slate-900">Rs {(stats?.revenue || 0).toLocaleString()}</p>
                    <div className={`flex items-center gap-1 text-xs mt-1 ${stats?.revenueGrowth && stats.revenueGrowth >= 0 ? 'text-success font-semibold' : 'text-muted-foreground'}`}>
                      <span>Excludes unpaid credits</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-100/80 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-100 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stats?.isShiftMode ? 'Cash in Drawer' : 'Cash Sales'}</p>
                    <p className="text-2xl font-bold text-blue-900">
                      Rs {(stats?.isShiftMode ? stats?.totalCashInDrawer : stats?.cashRevenue || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-600 mt-1 font-semibold">
                      {stats?.isShiftMode ? `Rs ${(stats?.cashRevenue || 0).toLocaleString()} shift cash + Rs ${(stats?.startingCash || 0).toLocaleString()} start` : 'Cash payments only'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100/80 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stats?.isShiftMode ? 'Shift Orders' : 'Total Orders'}</p>
                    <p className="text-2xl font-bold text-slate-900">{stats?.orders || 0}</p>
                    <div className="flex items-center gap-1 text-xs mt-1 text-slate-500 font-medium">
                      <span>Avg: Rs {Math.round(stats?.avgOrderValue || 0).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <ShoppingCart className="h-6 w-6 text-slate-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Digital / Card Sales</p>
                    <p className="text-2xl font-bold text-purple-900">Rs {(stats?.cardRevenue || 0).toLocaleString()}</p>
                    <p className="text-xs text-purple-600 mt-1 font-semibold">Online & POS card</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pending Credit Balance Card */}
            {(stats?.pendingCreditRevenue || 0) > 0 && (
              <Card className="border-amber-200 bg-amber-50/50 col-span-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-700 font-semibold uppercase tracking-wider">Pending Credit (Udhaar)</p>
                      <p className="text-xl font-black text-amber-600">Rs {(stats?.pendingCreditRevenue || 0).toLocaleString()}</p>
                      <p className="text-xs text-amber-600/70">Unpaid balance is tracked in Credit Ledger and excluded from Total Revenue until received.</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {stats?.isShiftMode ? 'Active Shift Hourly Trend' : 'Sales Trend'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats?.salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sales by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <ResponsiveContainer width="50%" height={250}>
                    <PieChart>
                      <Pie
                        data={stats?.categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {stats?.categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {stats?.categoryData.map((category) => (
                      <div key={category.name} className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-sm">{category.name}</span>
                        <span className="text-sm font-semibold ml-auto">{((category.value / (stats?.revenue || 1)) * 100).toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Products */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                {stats?.isShiftMode ? 'Shift Top Selling Products' : 'Top Selling Products'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.sold} units sold</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Rs {product.revenue.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Revenue</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Shift Management & Database Archival */}
          <div className="pt-10 pb-6">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Shift Archival & Session Management</h3>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 border-2 border-emerald-100 rounded-2xl bg-emerald-50/30">
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">End & Archive Active Shift</p>
                <p className="text-xs text-slate-500 max-w-xl">
                  Ending a shift safely saves ending cash, records the session in the database, resets the live active view for the next shift, and permanently archives shift order revenues so admin can review shift reports for years anytime.
                </p>
              </div>

              <Button
                className="bg-emerald-600 hover:bg-emerald-700 font-bold px-6 h-10 text-white shadow-md shadow-emerald-500/20"
                onClick={() => {
                  refetchActiveShifts();
                  setIsActiveShiftsOpen(true);
                }}
              >
                <Clock className="h-4 w-4 mr-2" />
                Manage & Close Shift
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Hidden print components - positioned off-screen but rendered for printing */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0', width: '80mm', pointerEvents: 'none', zIndex: -1000 }}>
        <div ref={summaryRef} id="daily-summary-pdf-content" className="receipt-print" style={{ width: '80mm' }}>
          <DailySummary 
            orders={summaryOrders} 
            dateRange={dateRange}
          />
        </div>
        <div ref={productSummaryRef} className="receipt-print" style={{ width: '80mm' }}>
          <ProductSalesSummary 
            orders={productOrdersWithItems} 
            dateRange={dateRange}
            query=""
          />
        </div>
      </div>
      {/* Active Shifts Modal */}
      <ActiveShiftsModal
        open={isActiveShiftsOpen}
        onOpenChange={setIsActiveShiftsOpen}
        orders={data?.orders || []}
        onShiftClosed={() => {
          queryClient.invalidateQueries({ queryKey: ['active-shifts'] });
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          refetchActiveShifts();
        }}
      />
    </MainLayout>
  );
};

export default ReportsPage;
