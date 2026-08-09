import React, { useState, useEffect, useRef, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';
import { useReactToPrint } from 'react-to-print';
import Receipt from '@/components/pos/Receipt';
import KOT from '@/components/pos/KOT';
import { 
  Printer, 
  Trash2, 
  XSquare, 
  Utensils, 
  Search, 
  Clock, 
  Plus, 
  Minus, 
  Loader2, 
  User, 
  Armchair, 
  Barcode, 
  Zap, 
  ChefHat, 
  Receipt as ReceiptIcon 
} from 'lucide-react';

interface GenXBillItem {
  id: string; // product id
  product: any;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  amount: number;
  tableNo?: string;
}

const GenXPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, profile } = useMultiTenant();

  // Primary States
  const [selectedWaiter, setSelectedWaiter] = useState<string>('Cash / Parsal');
  const [tableNo, setTableNo] = useState<string>('1');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Quick Code Entry Row State
  const [itemCode, setItemCode] = useState<string>('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);

  // Bill Items & Table Selection
  const [billItems, setBillItems] = useState<GenXBillItem[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [searchQueryRight, setSearchQueryRight] = useState<string>('');

  // Operations / Printing States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastOrderForPrint, setLastOrderForPrint] = useState<any>(null);
  const [lastOrderForKOT, setLastOrderForKOT] = useState<any>(null);

  const receiptRef = useRef<HTMLDivElement>(null);
  const kotRef = useRef<HTMLDivElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: products = [], isLoading: isProductsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: api.products.getAll,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: api.tables.getAll,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: api.staff.getAll,
  });

  const { data: ongoingOrders = [] } = useQuery({
    queryKey: ['ongoing-orders'],
    queryFn: api.orders.getOngoing,
    refetchInterval: 5000,
  });

  const { data: dailyCount = 0 } = useQuery({
    queryKey: ['daily-order-count'],
    queryFn: () => api.orders.getDailyCount(),
  });

  // Focus code input on mount
  useEffect(() => {
    focusCodeInput();
  }, []);

  const focusCodeInput = () => {
    setTimeout(() => {
      if (codeInputRef.current) {
        codeInputRef.current.focus();
      }
    }, 50);
  };

  // Waiter Options
  const waiterOptions = useMemo(() => {
    const defaultWaiters = ['Cash / Parsal', 'Waiter 1', 'Waiter 2', 'Ali Hyder'];
    const staffNames = staffList.map((s: any) => s.name || s.full_name).filter(Boolean);
    return Array.from(new Set([...defaultWaiters, ...staffNames]));
  }, [staffList]);

  // Running orders filtered by selected waiter
  const waiterRunningOrders = useMemo(() => {
    return ongoingOrders.filter((order: any) => {
      if (selectedWaiter === 'Cash / Parsal') return true;
      return order.server_name === selectedWaiter || order.server_name?.toLowerCase() === selectedWaiter.toLowerCase();
    });
  }, [ongoingOrders, selectedWaiter]);

  // Total Calculation
  const totalAmount = useMemo(() => {
    return billItems.reduce((acc, item) => acc + item.amount, 0);
  }, [billItems]);

  // Filtered Item Master on Right Panel
  const filteredProductsRight = useMemo(() => {
    const q = searchQueryRight.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p: any) => {
      const matchName = p.name?.toLowerCase().includes(q);
      const matchCode = p.sku?.toLowerCase().includes(q);
      const matchId = p.id?.toLowerCase().includes(q);
      return matchName || matchCode || matchId;
    });
  }, [products, searchQueryRight]);

  // Load a running order into current bill
  const handleSelectRunningOrder = (order: any) => {
    setActiveOrderId(order.id);
    if (order.table_id) {
      const matchedTbl = tables.find((t: any) => t.id === order.table_id);
      if (matchedTbl) setTableNo(matchedTbl.table_number);
    }
    if (order.server_name) {
      setSelectedWaiter(order.server_name);
    }

    if (order.order_items && Array.isArray(order.order_items)) {
      const loadedItems: GenXBillItem[] = order.order_items.map((oi: any) => {
        const prod = oi.products || products.find((p: any) => p.id === oi.product_id) || {
          id: oi.product_id,
          name: oi.product_name || 'Item',
          sku: 'CODE',
          price: oi.price,
        };
        return {
          id: prod.id || oi.product_id,
          product: prod,
          sku: prod.sku || 'CODE',
          name: prod.name || oi.product_name || 'Item',
          price: Number(oi.price) || 0,
          quantity: Number(oi.quantity) || 1,
          amount: (Number(oi.price) || 0) * (Number(oi.quantity) || 1),
          tableNo: tableNo,
        };
      });
      setBillItems(loadedItems);
      toast.info(`Loaded Running Order #${order.daily_id || order.id.slice(0, 6)}`, { duration: 1500 });
    }
    focusCodeInput();
  };

  // Live item code matching preview
  const handleItemCodeChange = (val: string) => {
    setItemCode(val);
    if (!val.trim()) {
      setPreviewPrice(null);
      return;
    }

    const q = val.trim().toLowerCase();
    const found = products.find(
      (p: any) =>
        (p.sku && p.sku.toLowerCase() === q) ||
        (p.id && p.id.toLowerCase() === q) ||
        (p.name && p.name.toLowerCase() === q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
    );

    if (found) {
      setPreviewPrice(Number(found.price) || 0);
    } else {
      setPreviewPrice(null);
    }
  };

  // Add Item to Bill via Code Box or Click
  const addItemToBill = (product: any, qtyToAdd: number = 1) => {
    if (!product) return;

    setBillItems((prev) => {
      const idx = prev.findIndex((item) => item.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        const existing = updated[idx];
        const newQty = existing.quantity + qtyToAdd;
        updated[idx] = {
          ...existing,
          quantity: newQty,
          amount: newQty * existing.price,
          tableNo: tableNo,
        };
        setSelectedRowIndex(idx);
        return updated;
      } else {
        const newItem: GenXBillItem = {
          id: product.id,
          product,
          sku: product.sku || 'CODE',
          name: product.name,
          price: Number(product.price) || 0,
          quantity: qtyToAdd,
          amount: (Number(product.price) || 0) * qtyToAdd,
          tableNo: tableNo,
        };
        setSelectedRowIndex(prev.length);
        return [...prev, newItem];
      }
    });

    setItemCode('');
    setItemQty(1);
    setPreviewPrice(null);
    focusCodeInput();
  };

  // Code Input Enter key handler
  const handleCodeSubmit = () => {
    const query = itemCode.trim();
    if (!query) return;

    const qLower = query.toLowerCase();

    let found = products.find((p: any) => p.sku && p.sku.toLowerCase() === qLower);

    if (!found) {
      found = products.find((p: any) => p.id && p.id.toLowerCase() === qLower);
    }

    if (!found) {
      found = products.find((p: any) => p.name && p.name.toLowerCase() === qLower);
    }

    if (!found) {
      found = products.find((p: any) => p.sku && p.sku.toLowerCase().includes(qLower));
    }

    if (!found) {
      found = products.find((p: any) => p.name && p.name.toLowerCase().includes(qLower));
    }

    if (found) {
      addItemToBill(found, itemQty || 1);
    } else {
      toast.error(`Item code "${query}" not found`, { duration: 2000 });
      setItemCode('');
      setPreviewPrice(null);
      focusCodeInput();
    }
  };

  // Quantity updates inside bill table
  const updateTableItemQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    setBillItems((prev) => {
      const updated = [...prev];
      if (index >= 0 && index < updated.length) {
        const item = updated[index];
        updated[index] = {
          ...item,
          quantity: newQty,
          amount: newQty * item.price,
        };
      }
      return updated;
    });
  };

  // Remove specific item from bill table
  const handleRemoveItem = (index: number) => {
    setBillItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (selectedRowIndex >= updated.length) {
        setSelectedRowIndex(updated.length - 1);
      }
      return updated;
    });
    toast.info('Item removed', { duration: 1000 });
    focusCodeInput();
  };

  // 4 Bottom Buttons Handlers

  // Button 1: Remove Selected Item
  const handleRemoveClick = () => {
    if (billItems.length === 0) {
      toast.info('Bill is empty', { duration: 1000 });
      return;
    }
    const idx = selectedRowIndex >= 0 && selectedRowIndex < billItems.length ? selectedRowIndex : billItems.length - 1;
    handleRemoveItem(idx);
  };

  // Button 2: Close / New Bill
  const handleCloseClick = () => {
    if (billItems.length > 0) {
      if (!window.confirm('Clear current bill?')) return;
    }
    setBillItems([]);
    setActiveOrderId(null);
    setItemCode('');
    setItemQty(1);
    setPreviewPrice(null);
    setSelectedRowIndex(-1);
    toast.info('Bill reset', { duration: 1000 });
    focusCodeInput();
  };

  // Thermal Receipt Printing Setup
  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${lastOrderForPrint?.orderNumber || '00'}`,
    onAfterPrint: () => {
      toast.success('Receipt printed successfully', { duration: 1500 });
      setLastOrderForPrint(null);
    },
  });

  // Thermal KOT Printing Setup
  const handlePrintKOT = useReactToPrint({
    contentRef: kotRef,
    documentTitle: `KOT-${lastOrderForKOT?.orderNumber || '00'}`,
    onAfterPrint: () => {
      toast.success('KOT printed successfully', { duration: 1500 });
      setLastOrderForKOT(null);
    },
  });

  // Button 3: Print KOT
  const handleKOTClick = async () => {
    if (billItems.length === 0) {
      toast.error('Cannot print KOT for an empty bill.', { duration: 2000 });
      focusCodeInput();
      return;
    }

    try {
      setIsSaving(true);

      const matchedTableObj = tables.find((t: any) => t.table_number === tableNo || t.id === tableNo);
      const tableIdVal = matchedTableObj ? matchedTableObj.id : null;

      let orderDailyId = (dailyCount || 0) + 1;

      const orderInsert = {
        customer_id: null,
        total_amount: totalAmount,
        status: 'pending', // KOT orders are ongoing/pending
        payment_method: 'cash',
        order_type: 'dine_in',
        table_id: tableIdVal,
        server_name: selectedWaiter,
        customer_address: null,
        register_id: null,
        daily_id: orderDailyId,
        tenant_id: tenant?.id,
      };

      const orderItemsInsert = billItems.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        product_category: item.product?.category || 'General',
        quantity: item.quantity,
        price: item.price,
      }));

      let savedOrder: any;
      if (activeOrderId) {
        await api.orders.updateItems(activeOrderId, orderItemsInsert, totalAmount);
        savedOrder = { id: activeOrderId, daily_id: orderDailyId };
      } else {
        savedOrder = await api.orders.create(orderInsert, orderItemsInsert);
        if (savedOrder?.id) setActiveOrderId(savedOrder.id);
      }

      queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      const kotObj = {
        orderNumber: String(savedOrder?.daily_id || orderDailyId).padStart(2, '0'),
        items: billItems.map((item) => ({
          product: item.product,
          quantity: item.quantity,
        })),
        createdAt: new Date(),
        serverName: selectedWaiter,
        tableId: tableNo,
      };

      setLastOrderForKOT(kotObj);

      setTimeout(() => {
        handlePrintKOT();
      }, 100);

      toast.success(`KOT #${kotObj.orderNumber} sent to kitchen`, { duration: 2000 });
      focusCodeInput();
    } catch (err: any) {
      toast.error(`KOT Error: ${err.message || 'Failed to print KOT'}`, { duration: 3000 });
    } finally {
      setIsSaving(false);
    }
  };

  // Button 4: Save & Print Bill
  const handlePrintBillClick = async () => {
    if (billItems.length === 0) {
      toast.error('Cannot print an empty bill.', { duration: 2000 });
      focusCodeInput();
      return;
    }

    try {
      setIsSaving(true);

      const matchedTableObj = tables.find((t: any) => t.table_number === tableNo || t.id === tableNo);
      const tableIdVal = matchedTableObj ? matchedTableObj.id : null;

      let orderDailyId = (dailyCount || 0) + 1;

      const orderInsert = {
        customer_id: null,
        total_amount: totalAmount,
        status: 'completed',
        payment_method: 'cash',
        order_type: 'dine_in',
        table_id: tableIdVal,
        server_name: selectedWaiter,
        customer_address: null,
        register_id: null,
        daily_id: orderDailyId,
        tenant_id: tenant?.id,
      };

      const orderItemsInsert = billItems.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        product_category: item.product?.category || 'General',
        quantity: item.quantity,
        price: item.price,
      }));

      let savedOrder: any;
      if (activeOrderId) {
        await api.orders.updateStatus(activeOrderId, 'completed');
        savedOrder = { id: activeOrderId, daily_id: orderDailyId };
      } else {
        savedOrder = await api.orders.create(orderInsert, orderItemsInsert);
      }

      // Auto-release table if assigned
      if (tableIdVal) {
        try {
          await api.tables.updateStatus(tableIdVal, 'available');
          queryClient.invalidateQueries({ queryKey: ['tables'] });
        } catch (e) {
          console.warn('Table auto-release warning:', e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['daily-order-count'] });

      const printObj = {
        orderNumber: String(savedOrder?.daily_id || orderDailyId).padStart(2, '0'),
        items: billItems.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          variants: [],
          addons: [],
          itemNotes: '',
        })),
        customer: null,
        subtotal: totalAmount,
        taxAmount: 0,
        discountAmount: 0,
        total: totalAmount,
        paymentMethod: 'cash',
        orderType: 'dine_in',
        createdAt: new Date(),
        cashierName: selectedWaiter,
        serverName: selectedWaiter,
        tableId: tableNo,
        receivedCash: totalAmount,
        remainingCash: 0,
      };

      setLastOrderForPrint(printObj);

      setTimeout(() => {
        handlePrintReceipt();
      }, 100);

      toast.success(`Bill #${printObj.orderNumber} Completed & Printed!`, { duration: 2000 });

      // Reset bill for next customer
      setBillItems([]);
      setActiveOrderId(null);
      setItemCode('');
      setItemQty(1);
      setPreviewPrice(null);
      setSelectedRowIndex(-1);
      focusCodeInput();
    } catch (err: any) {
      toast.error(`Print Bill Error: ${err.message || 'Failed to complete bill'}`, { duration: 3000 });
    } finally {
      setIsSaving(false);
    }
  };

  const currentBillDisplay = activeOrderId 
    ? String(ongoingOrders.find((o: any) => o.id === activeOrderId)?.daily_id || '7').padStart(2, '0')
    : String((dailyCount || 0) + 1).padStart(2, '0');

  const currentKOTDisplay = String((dailyCount || 0) + 100).padStart(3, '0');

  return (
    <MainLayout>
      <div className="flex h-full w-full flex-col bg-slate-200 dark:bg-slate-950 font-mono select-none overflow-hidden">
        
        {/* Main Content split into LEFT (~55%) and RIGHT (~45%) matching old POS screenshot */}
        <div className="flex flex-1 overflow-hidden p-2 gap-2">
          
          {/* LEFT BILLING TERMINAL PANEL */}
          <div className="flex flex-col w-[58%] h-full bg-slate-300 dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-800 rounded-sm p-2 shadow-inner overflow-hidden gap-2">
            
            {/* Top Row 1: Bill # + Waiter Selector + Table Input */}
            <div className="flex items-center gap-3 bg-slate-200 dark:bg-slate-850 p-2 rounded border border-slate-400 dark:border-slate-700 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black uppercase text-slate-900 dark:text-slate-100">Bill # :</span>
                <span className="font-mono text-base font-black text-slate-950 dark:text-emerald-400 bg-white dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-400 dark:border-slate-700">
                  {currentBillDisplay}
                </span>
              </div>

              {/* Waiter Selection List */}
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">Waiter :</span>
                <select
                  value={selectedWaiter}
                  onChange={(e) => setSelectedWaiter(e.target.value)}
                  className="h-8 text-xs font-black uppercase bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 border border-slate-400 dark:border-slate-700 rounded px-2 flex-1 outline-hidden"
                >
                  {waiterOptions.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              {/* Table Input */}
              <div className="flex items-center gap-1.5 w-32">
                <span className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">Table :</span>
                <input
                  type="text"
                  value={tableNo}
                  onChange={(e) => setTableNo(e.target.value)}
                  className="h-8 w-14 text-center text-xs font-black bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 border border-slate-400 dark:border-slate-700 rounded outline-hidden"
                />
              </div>
            </div>

            {/* Top Row 2: Waiter's Running Orders Bar */}
            {waiterRunningOrders.length > 0 && (
              <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/50 p-1.5 rounded border border-amber-300 dark:border-amber-800 overflow-x-auto">
                <span className="text-[10px] font-black uppercase text-amber-900 dark:text-amber-300 shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Running ({selectedWaiter}):
                </span>
                <div className="flex gap-1.5 overflow-x-auto">
                  {waiterRunningOrders.map((ro: any) => {
                    const isActive = activeOrderId === ro.id;
                    const roNo = ro.daily_id ? String(ro.daily_id).padStart(2, '0') : ro.id.slice(0, 4);
                    return (
                      <button
                        key={ro.id}
                        onClick={() => handleSelectRunningOrder(ro)}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 transition-all ${
                          isActive
                            ? 'bg-amber-600 text-white border-amber-700 font-black shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        Order #{roNo} (Rs {Number(ro.total_amount || 0).toLocaleString()})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Item Code Search Box + Qty + Price Row */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-850 p-2 rounded border border-slate-400 dark:border-slate-700 shadow-xs">
              
              {/* Item Code Input Box */}
              <div className="flex-1 flex flex-col">
                <label className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                  Item Code (Press Enter)
                </label>
                <input
                  ref={codeInputRef}
                  type="text"
                  placeholder="Enter DishCode..."
                  value={itemCode}
                  onChange={(e) => handleItemCodeChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCodeSubmit();
                    }
                  }}
                  className="h-9 px-2 font-mono text-sm font-black uppercase bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100 border-2 border-slate-500 dark:border-slate-600 rounded focus:border-emerald-600 outline-hidden"
                />
              </div>

              {/* Qty Box */}
              <div className="w-20 flex flex-col">
                <label className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-400 mb-0.5">
                  Qty
                </label>
                <input
                  type="number"
                  min="1"
                  value={itemQty}
                  onChange={(e) => setItemQty(parseInt(e.target.value, 10) || 1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCodeSubmit();
                    }
                  }}
                  className="h-9 text-center font-mono text-sm font-black bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100 border border-slate-400 dark:border-slate-700 rounded outline-hidden"
                />
              </div>

              {/* Price / Rate Display Box */}
              <div className="w-28 flex flex-col">
                <label className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-400 mb-0.5 text-right">
                  Price (Rs)
                </label>
                <div className="h-9 flex items-center justify-end px-2 font-mono text-sm font-black bg-slate-200 dark:bg-slate-900 text-slate-950 dark:text-emerald-400 border border-slate-400 dark:border-slate-700 rounded">
                  {previewPrice !== null ? `Rs ${previewPrice.toLocaleString()}` : '0'}
                </div>
              </div>
            </div>

            {/* Main Bill Grid Table */}
            <div className="flex-1 bg-white dark:bg-slate-950 border-2 border-slate-400 dark:border-slate-800 rounded overflow-auto shadow-inner">
              <Table className="w-full font-mono text-xs border-collapse">
                <TableHeader className="bg-slate-800 text-white sticky top-0 z-10">
                  <TableRow className="h-8 border-b border-slate-700">
                    <TableHead className="w-10 text-center font-black text-white p-1">S. #</TableHead>
                    <TableHead className="w-16 font-black text-white p-1">Code</TableHead>
                    <TableHead className="font-black text-white p-1">Item Name</TableHead>
                    <TableHead className="w-16 text-right font-black text-white p-1">Rate</TableHead>
                    <TableHead className="w-16 text-center font-black text-white p-1">Qty</TableHead>
                    <TableHead className="w-20 text-right font-black text-white p-1">Amount</TableHead>
                    <TableHead className="w-12 text-center font-black text-white p-1">T. N</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {billItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center text-slate-400 font-bold">
                        No items added to current bill
                      </TableCell>
                    </TableRow>
                  ) : (
                    billItems.map((item, idx) => {
                      const isSelected = selectedRowIndex === idx;
                      return (
                        <TableRow
                          key={`${item.id}-${idx}`}
                          onClick={() => setSelectedRowIndex(idx)}
                          className={`h-8 border-b border-slate-200 dark:border-slate-800 cursor-pointer font-bold ${
                            isSelected
                              ? 'bg-slate-800 text-white font-black'
                              : idx % 2 === 0
                              ? 'bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-100'
                              : 'bg-slate-100 dark:bg-slate-900 text-slate-950 dark:text-slate-100'
                          }`}
                        >
                          <TableCell className="text-center p-1">{idx + 1}</TableCell>
                          <TableCell className="p-1 font-mono">{item.sku}</TableCell>
                          <TableCell className="p-1 truncate">{item.name}</TableCell>
                          <TableCell className="text-right p-1">{item.price}</TableCell>
                          <TableCell className="text-center p-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateTableItemQty(idx, parseInt(e.target.value, 10) || 0)}
                              className={`w-10 text-center font-bold h-6 border rounded ${
                                isSelected ? 'bg-slate-900 text-white border-slate-600' : 'bg-white text-black border-slate-300'
                              }`}
                            />
                          </TableCell>
                          <TableCell className="text-right p-1 font-black">{item.amount}</TableCell>
                          <TableCell className="text-center p-1 text-[10px]">{tableNo}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Bottom Controls Bar (4 Buttons: Print, Remove, KOT, Close) + KOT No + Total */}
            <div className="bg-slate-200 dark:bg-slate-850 p-2 rounded border border-slate-400 dark:border-slate-700 shadow-xs flex flex-col gap-2">
              
              {/* Row of 4 Action Buttons matching screenshot */}
              <div className="grid grid-cols-4 gap-2">
                
                {/* 1. Print Button */}
                <button
                  type="button"
                  onClick={handlePrintBillClick}
                  disabled={isSaving || billItems.length === 0}
                  className="h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-950 dark:text-slate-100 border-2 border-slate-400 dark:border-slate-600 rounded font-black text-xs uppercase shadow-sm flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" /> Print
                </button>

                {/* 2. Remove Button */}
                <button
                  type="button"
                  onClick={handleRemoveClick}
                  disabled={billItems.length === 0}
                  className="h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-950 dark:text-slate-100 border-2 border-slate-400 dark:border-slate-600 rounded font-black text-xs uppercase shadow-sm flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>

                {/* 3. KOT Button */}
                <button
                  type="button"
                  onClick={handleKOTClick}
                  disabled={isSaving || billItems.length === 0}
                  className="h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-950 dark:text-slate-100 border-2 border-slate-400 dark:border-slate-600 rounded font-black text-xs uppercase shadow-sm flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50"
                >
                  <ChefHat className="h-4 w-4" /> KOT
                </button>

                {/* 4. Close Button */}
                <button
                  type="button"
                  onClick={handleCloseClick}
                  className="h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-950 dark:text-slate-100 border-2 border-slate-400 dark:border-slate-600 rounded font-black text-xs uppercase shadow-sm flex items-center justify-center gap-1 active:scale-95"
                >
                  <XSquare className="h-4 w-4" /> Close
                </button>
              </div>

              {/* KOT No. & TOTAL Display Bar */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">KOT No. :</span>
                  <span className="font-mono text-sm font-black bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 px-3 py-0.5 border border-slate-400 dark:border-slate-700 rounded">
                    {currentKOTDisplay}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-base font-black uppercase text-slate-900 dark:text-slate-100">TOTAL :</span>
                  <span className="font-mono text-xl font-black bg-white dark:bg-slate-950 text-slate-950 dark:text-emerald-400 px-4 py-1 border-2 border-slate-500 dark:border-slate-700 rounded min-w-[120px] text-right">
                    {totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT ITEM MASTER PANEL (~42%) matching old POS screenshot */}
          <div className="flex flex-col w-[42%] h-full bg-slate-300 dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-800 rounded-sm p-2 shadow-inner overflow-hidden gap-2">
            
            {/* Header & Search Bar */}
            <div className="flex items-center justify-between bg-slate-800 text-white p-2 rounded-t shadow-xs">
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-emerald-400" /> Items Master List
              </span>

              {/* Search Filter Box */}
              <div className="relative w-48">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item/code..."
                  value={searchQueryRight}
                  onChange={(e) => setSearchQueryRight(e.target.value)}
                  className="h-7 w-full pl-7 pr-2 text-xs font-bold bg-slate-900 text-white border border-slate-600 rounded outline-hidden"
                />
              </div>
            </div>

            {/* Scrollable Item Master Grid Matching Screenshot (Columns: Code | Items Name | Rate) */}
            <div className="flex-1 bg-white dark:bg-slate-950 border-2 border-slate-400 dark:border-slate-800 rounded overflow-auto shadow-inner">
              <Table className="w-full font-mono text-xs border-collapse">
                <TableHeader className="bg-slate-700 text-white sticky top-0 z-10">
                  <TableRow className="h-8 border-b border-slate-600">
                    <TableHead className="w-16 font-black text-white p-1">Code</TableHead>
                    <TableHead className="font-black text-white p-1">Items Name</TableHead>
                    <TableHead className="w-20 text-right font-black text-white p-1">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isProductsLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-48 text-center text-slate-400 font-bold">
                        Loading item master list...
                      </TableCell>
                    </TableRow>
                  ) : filteredProductsRight.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-48 text-center text-slate-400 font-bold">
                        No items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProductsRight.map((prod: any, index: number) => (
                      <TableRow
                        key={prod.id}
                        onClick={() => {
                          setItemCode(prod.sku || prod.id);
                          setPreviewPrice(Number(prod.price) || 0);
                          addItemToBill(prod, 1);
                        }}
                        className={`h-8 border-b border-slate-200 dark:border-slate-800 cursor-pointer font-bold hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors ${
                          index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900'
                        }`}
                      >
                        <TableCell className="p-1 font-mono text-slate-700 dark:text-slate-300 font-black">
                          {prod.sku || 'CODE'}
                        </TableCell>
                        <TableCell className="p-1 text-slate-950 dark:text-slate-100 truncate">
                          {prod.name}
                        </TableCell>
                        <TableCell className="text-right p-1 font-black text-slate-950 dark:text-emerald-400">
                          {prod.price}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

          </div>

        </div>

        {/* Hidden Printable Receipts & KOT Components */}
        <div className="hidden">
          {lastOrderForPrint && <Receipt ref={receiptRef} order={lastOrderForPrint} />}
          {lastOrderForKOT && <KOT ref={kotRef} order={lastOrderForKOT} />}
        </div>
      </div>
    </MainLayout>
  );
};

export default GenXPage;
