import React, { useState, useRef, useMemo } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Printer, 
  Eye
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

import { shiftService, ShiftSession } from '@/services/shiftService';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { api } from '@/services/api';

import DailySummary from '@/components/pos/DailySummary';
import ProductSalesSummary from '@/components/pos/ProductSalesSummary';

interface ActiveShiftsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders?: any[];
  onShiftClosed?: () => void;
}

export const ActiveShiftsModal: React.FC<ActiveShiftsModalProps> = ({
  open,
  onOpenChange,
  orders = [],
  onShiftClosed
}) => {
  const { isAdmin } = useMultiTenant();
  const [activeTab, setActiveTab] = useState<'running' | 'all'>('running');
  const [selectedShiftForView, setSelectedShiftForView] = useState<ShiftSession | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date())
  });

  // State for closing shift and printing receipts
  const [closingShift, setClosingShift] = useState<ShiftSession | null>(null);
  const [endingAmountInput, setEndingAmountInput] = useState<string>('');

  // States for summary receipts
  const [printShiftOrders, setPrintShiftOrders] = useState<any[]>([]);
  const [printShiftFullOrders, setPrintShiftFullOrders] = useState<any[]>([]);

  const summaryRef = useRef<HTMLDivElement>(null);
  const itemSummaryRef = useRef<HTMLDivElement>(null);

  const handlePrintOrdersSummary = useReactToPrint({
    contentRef: summaryRef,
    documentTitle: `Shift-Orders-Summary-${format(new Date(), 'yyyy-MM-dd-HHmm')}`,
  });

  const handlePrintItemSummary = useReactToPrint({
    contentRef: itemSummaryRef,
    documentTitle: `Shift-Item-Summary-${format(new Date(), 'yyyy-MM-dd-HHmm')}`,
  });

  const [shiftsList, setShiftsList] = useState<ShiftSession[]>(() => shiftService.getStoredShifts());

  React.useEffect(() => {
    if (open) {
      shiftService.getAllShiftsFromCloud().then((cloudShifts) => {
        if (Array.isArray(cloudShifts) && cloudShifts.length > 0) {
          setShiftsList(cloudShifts);
        }
      });
    }
  }, [open]);

  const allStoredShifts = useMemo(() => {
    const list = shiftsList.length > 0 ? shiftsList : shiftService.getStoredShifts();
    return [...list].sort(
      (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
    );
  }, [open, closingShift, shiftsList]);

  const runningShifts = useMemo(() => {
    return allStoredShifts.filter(s => s.status === 'open');
  }, [allStoredShifts]);

  const filteredShifts = useMemo(() => {
    if (activeTab === 'running') return runningShifts;
    
    return allStoredShifts.filter(s => {
      if (!dateRange?.from) return true;
      const openedDate = new Date(s.opened_at);
      const start = startOfDay(dateRange.from);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      return openedDate >= start && openedDate <= end;
    });
  }, [allStoredShifts, runningShifts, activeTab, dateRange]);

  // Helper to calculate orders and sales for a shift
  const getShiftStats = (shift: ShiftSession) => {
    const openTime = new Date(shift.opened_at).getTime();
    const closeTime = shift.closed_at ? new Date(shift.closed_at).getTime() : Date.now();

    const shiftOrders = orders.filter(o => {
      if (!o.created_at) return false;
      const oTime = new Date(o.created_at).getTime();
      const matchesTime = oTime >= openTime && oTime <= closeTime;
      const matchesCashier = !shift.cashier_name || 
        (o.server_name && o.server_name.toLowerCase().includes(shift.cashier_name.toLowerCase())) ||
        (o.cashier_name && o.cashier_name.toLowerCase().includes(shift.cashier_name.toLowerCase())) ||
        true; // fallback to time window
      return matchesTime && matchesCashier;
    });

    const completed = shiftOrders.filter(o => o.status === 'completed');
    const totalSales = completed.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

    return {
      ordersCount: completed.length,
      totalSales,
      ordersList: completed
    };
  };

  const handleCloseShiftClick = (shift: ShiftSession) => {
    setClosingShift(shift);
    const stats = getShiftStats(shift);
    const expected = (Number(shift.starting_amount) || 0) + stats.totalSales;
    setEndingAmountInput(String(expected));
  };

  const confirmCloseShift = async () => {
    if (!closingShift) return;

    const toastId = toast.loading(`Closing shift for ${closingShift.cashier_name}...`);
    try {
      const endingAmt = parseFloat(endingAmountInput) || 0;
      
      // 1. Fetch completed orders for this shift
      const stats = getShiftStats(closingShift);
      setPrintShiftOrders(stats.ordersList);

      // 2. Fetch order items for product sales summary
      const fullOrders = await Promise.all(
        stats.ordersList.map(async (o: any) => {
          try {
            return await api.orders.getByIdWithItems(o.id);
          } catch {
            return o;
          }
        })
      );
      setPrintShiftFullOrders(fullOrders.filter(Boolean));

      // 3. Perform close shift
      await shiftService.closeShift(closingShift.id, endingAmt);

      toast.dismiss(toastId);
      toast.success(`Shift for ${closingShift.cashier_name} closed cleanly.`);
      setClosingShift(null);

      if (onShiftClosed) onShiftClosed();

      // 4. Print 2 Summary Receipts automatically
      setTimeout(() => {
        handlePrintOrdersSummary();
        setTimeout(() => {
          handlePrintItemSummary();
        }, 800);
      }, 300);

    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error('Failed to close shift: ' + (err.message || 'Error'));
    }
  };

  const handleCloseAllShifts = async () => {
    if (!window.confirm('Are you sure you want to close and clean ALL running shifts?')) return;
    const toastId = toast.loading('Closing and cleaning all active shifts...');
    try {
      await shiftService.closeAllOpenShifts();
      const updated = await shiftService.getAllShiftsFromCloud();
      setShiftsList(updated);
      toast.dismiss(toastId);
      toast.success('All active shifts closed and cleaned successfully');
      if (onShiftClosed) onShiftClosed();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error('Failed to clean shifts: ' + err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-emerald-600" />
              Cashier Active Shifts & Reports
            </DialogTitle>
            {runningShifts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCloseAllShifts}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-bold shrink-0 self-start sm:self-auto text-xs"
              >
                Close & Clean All ({runningShifts.length})
              </Button>
            )}
          </div>
          <DialogDescription>
            Manage active cashier shifts, inspect orders summaries, and close shifts with automatic receipt printing.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Controls & Filters */}
        <div className="space-y-4 my-2">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-100 dark:bg-slate-900 p-2 rounded-xl">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="running" className="font-bold text-xs">
                  Running Shifts ({runningShifts.length})
                </TabsTrigger>
                <TabsTrigger value="all" className="font-bold text-xs">
                  All Shifts Log
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Date Range Picker for Admin/Manager */}
            {activeTab === 'all' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd')}</>
                        ) : (
                          format(dateRange.from, 'MMM dd, yyyy')
                        )
                      ) : (
                        'Select Date Range'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Shift Cards Grid */}
          <div className="space-y-3">
            {filteredShifts.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed rounded-2xl bg-slate-50 dark:bg-slate-900/40">
                <Clock className="h-10 w-10 mx-auto text-slate-400 mb-2 opacity-50" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No shifts found</p>
                <p className="text-xs text-slate-500 mt-1">There are no shift sessions matching the current filter.</p>
              </div>
            ) : (
              filteredShifts.map((shift) => {
                const stats = getShiftStats(shift);
                const isOpen = shift.status === 'open';

                return (
                  <Card key={shift.id} className={cn("border transition-all", isOpen ? "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10" : "border-slate-200")}>
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm", isOpen ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300")}>
                            {shift.cashier_name ? shift.cashier_name.charAt(0).toUpperCase() : 'C'}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">{shift.cashier_name || 'Cashier'}</h3>
                              <Badge variant={isOpen ? "default" : "secondary"} className={cn("text-[10px] uppercase font-bold", isOpen ? "bg-emerald-600" : "")}>
                                {isOpen ? 'Active / Running' : 'Closed'}
                              </Badge>
                            </div>

                            <p className="text-xs text-slate-500 mt-0.5">
                              Opened: <span className="font-medium text-slate-700 dark:text-slate-300">{format(new Date(shift.opened_at), 'MMM dd, yyyy - hh:mm a')}</span>
                              {shift.closed_at && (
                                <> &bull; Closed: <span className="font-medium text-slate-700 dark:text-slate-300">{format(new Date(shift.closed_at), 'MMM dd, yyyy - hh:mm a')}</span></>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Shift Stats Summary */}
                        <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="text-center px-2">
                            <p className="text-[10px] text-slate-400 font-semibold uppercase">Opening</p>
                            <p className="font-bold text-sm text-slate-700 dark:text-slate-200">Rs {Number(shift.starting_amount || 0).toLocaleString()}</p>
                          </div>
                          <div className="h-7 w-px bg-slate-200 dark:bg-slate-800" />
                          <div className="text-center px-2">
                            <p className="text-[10px] text-slate-400 font-semibold uppercase">Orders</p>
                            <p className="font-bold text-sm text-blue-600 dark:text-blue-400">{stats.ordersCount}</p>
                          </div>
                          <div className="h-7 w-px bg-slate-200 dark:bg-slate-800" />
                          <div className="text-center px-2">
                            <p className="text-[10px] text-slate-400 font-semibold uppercase">Sales</p>
                            <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">Rs {stats.totalSales.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedShiftForView(shift)}
                            className="h-9 text-xs font-semibold"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View Summary
                          </Button>

                          {isOpen && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCloseShiftClick(shift)}
                              className="h-9 text-xs font-bold bg-red-600 hover:bg-red-700"
                            >
                              <Printer className="h-3.5 w-3.5 mr-1" />
                              Close Shift (Print Receipts)
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Modal: View Selected Shift Details */}
        {selectedShiftForView && (
          <Dialog open={!!selectedShiftForView} onOpenChange={() => setSelectedShiftForView(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">
                  Shift Summary: {selectedShiftForView.cashier_name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Opened {format(new Date(selectedShiftForView.opened_at), 'PPP - hh:mm a')}
                </DialogDescription>
              </DialogHeader>

              {(() => {
                const stats = getShiftStats(selectedShiftForView);
                return (
                  <div className="space-y-4 py-2">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border text-center">
                        <p className="text-xs text-slate-500 font-medium">Opening Cash</p>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-100">Rs {Number(selectedShiftForView.starting_amount || 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900 text-center">
                        <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">Completed Orders</p>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-200">{stats.ordersCount}</p>
                      </div>
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900 text-center">
                        <p className="text-xs text-emerald-600 dark:text-emerald-300 font-medium">Total Shift Sales</p>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-200">Rs {stats.totalSales.toLocaleString()}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs uppercase text-slate-500 mb-2">Shift Orders Breakdown</h4>
                      <div className="max-h-60 overflow-y-auto border rounded-xl divide-y">
                        {stats.ordersList.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">No completed orders in this shift.</div>
                        ) : (
                          stats.ordersList.map((o: any, idx: number) => (
                            <div key={o.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-900">
                              <div>
                                <span className="font-bold text-slate-700 dark:text-slate-300 mr-2">#{idx + 1}</span>
                                <span className="text-slate-500">{format(new Date(o.created_at), 'hh:mm a')}</span>
                                <Badge variant="outline" className="ml-2 text-[9px] uppercase">{o.payment_method || 'cash'}</Badge>
                              </div>
                              <div className="font-bold text-emerald-600">Rs {Number(o.total_amount || 0).toLocaleString()}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        )}

        {/* Modal: Close Shift Confirmation & Ending Cash Input */}
        {closingShift && (
          <Dialog open={!!closingShift} onOpenChange={() => setClosingShift(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Close Shift & Print 2 Summary Receipts
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Closing shift for <strong>{closingShift.cashier_name}</strong> will automatically print the <strong>Orders Summary Receipt</strong> and <strong>Item Summary Receipt</strong>.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Closing / Ending Cash Balance (Rs.)</Label>
                  <Input
                    type="number"
                    value={endingAmountInput}
                    onChange={(e) => setEndingAmountInput(e.target.value)}
                    placeholder="Enter ending cash amount"
                    className="font-bold"
                  />
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-amber-800 dark:text-amber-300">Automatic Print Action:</p>
                  <p className="text-amber-700 dark:text-amber-400">1. Print Orders Summary Receipt (Total sales & payment methods)</p>
                  <p className="text-amber-700 dark:text-amber-400">2. Print Item Summary Receipt (Detailed product quantity sales)</p>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={() => setClosingShift(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={confirmCloseShift}
                    className="bg-red-600 hover:bg-red-700 font-bold"
                  >
                    Confirm Close Shift & Print Receipts
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Hidden Components for Thermal Printing */}
        <div style={{ display: 'none' }}>
          <div ref={summaryRef}>
            <DailySummary orders={printShiftOrders} dateRange={dateRange} />
          </div>
          <div ref={itemSummaryRef}>
            <ProductSalesSummary orders={printShiftFullOrders} dateRange={dateRange} query="" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ActiveShiftsModal;
