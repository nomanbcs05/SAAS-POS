import React, { useState, useEffect, useRef, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { 
  Zap, 
  Search, 
  Trash2, 
  Printer, 
  Plus, 
  Minus, 
  RotateCcw, 
  Utensils, 
  ShoppingBag, 
  Truck, 
  User, 
  Armchair, 
  Barcode, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';

interface GenXBillItem {
  id: string; // product id
  product: any;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  amount: number;
}

const GenXPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, profile } = useMultiTenant();

  // Inputs & Bill State
  const [codeQuery, setCodeQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [orderType, setOrderType] = useState<'dine_in' | 'take_away' | 'delivery'>('dine_in');
  const [tableId, setTableId] = useState<string>('');
  const [waiterName, setWaiterName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'wallet' | 'credit'>('cash');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [billItems, setBillItems] = useState<GenXBillItem[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Printing state
  const [lastOrderForPrint, setLastOrderForPrint] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // React Query Data
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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.getAll,
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

  // Categories list extraction
  const categoryList = useMemo(() => {
    const set = new Set<string>();
    set.add('All');
    if (categories && Array.isArray(categories)) {
      categories.forEach((cat: any) => {
        if (cat?.name) set.add(cat.name);
      });
    }
    if (products && Array.isArray(products)) {
      products.forEach((p: any) => {
        if (p?.category) set.add(p.category);
      });
    }
    return Array.from(set);
  }, [categories, products]);

  // Filtered product master list
  const filteredProducts = useMemo(() => {
    return products.filter((p: any) => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;

      const matchesName = p.name?.toLowerCase().includes(q);
      const matchesSku = p.sku?.toLowerCase().includes(q);
      const matchesId = p.id?.toLowerCase().includes(q);

      return matchesCategory && (matchesName || matchesSku || matchesId);
    });
  }, [products, searchQuery, selectedCategory]);

  // Subtotal & Totals calculation
  const subtotal = useMemo(() => {
    return billItems.reduce((acc, item) => acc + item.amount, 0);
  }, [billItems]);

  const discount = useMemo(() => {
    const val = parseFloat(discountInput) || 0;
    if (val < 0) return 0;
    if (val > subtotal) return subtotal;
    return val;
  }, [discountInput, subtotal]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discount);
  }, [subtotal, discount]);

  // Add Product to Current Bill
  const addProductToBill = (product: any) => {
    if (!product) return;

    setBillItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.id === product.id);

      if (existingIndex >= 0) {
        const updated = [...prevItems];
        const currentItem = updated[existingIndex];
        const newQty = currentItem.quantity + 1;
        updated[existingIndex] = {
          ...currentItem,
          quantity: newQty,
          amount: newQty * currentItem.price,
        };
        setSelectedRowIndex(existingIndex);
        return updated;
      } else {
        const newItem: GenXBillItem = {
          id: product.id,
          product,
          sku: product.sku || 'N/A',
          name: product.name,
          price: Number(product.price) || 0,
          quantity: 1,
          amount: Number(product.price) || 0,
        };
        setSelectedRowIndex(prevItems.length);
        return [...prevItems, newItem];
      }
    });

    toast.success(`Added ${product.name}`, { duration: 1000 });
    setCodeQuery('');
    focusCodeInput();
  };

  // Handle Enter on Code Entry input
  const handleCodeSubmit = () => {
    const query = codeQuery.trim();
    if (!query) return;

    const queryLower = query.toLowerCase();

    // 1. Try exact SKU match (case-insensitive)
    let found = products.find((p: any) => p.sku && p.sku.toLowerCase() === queryLower);

    // 2. Try exact ID match
    if (!found) {
      found = products.find((p: any) => p.id && p.id.toLowerCase() === queryLower);
    }

    // 3. Try exact Name match (case-insensitive)
    if (!found) {
      found = products.find((p: any) => p.name && p.name.toLowerCase() === queryLower);
    }

    // 4. Fallback SKU partial match
    if (!found) {
      found = products.find((p: any) => p.sku && p.sku.toLowerCase().includes(queryLower));
    }

    // 5. Fallback Name partial match
    if (!found) {
      found = products.find((p: any) => p.name && p.name.toLowerCase().includes(queryLower));
    }

    if (found) {
      addProductToBill(found);
    } else {
      toast.error(`Invalid item code: "${query}"`, { duration: 2000 });
      setCodeQuery('');
      focusCodeInput();
    }
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCodeSubmit();
    }
  };

  // Quantity modification
  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeItem(index);
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

  // Item removal
  const removeItem = (index: number) => {
    setBillItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (selectedRowIndex >= updated.length) {
        setSelectedRowIndex(updated.length - 1);
      }
      return updated;
    });
    toast.info('Item removed from bill', { duration: 1000 });
    focusCodeInput();
  };

  // Remove selected or last item (F2)
  const handleRemoveSelectedOrLast = () => {
    if (billItems.length === 0) {
      toast.info('Bill is empty', { duration: 1000 });
      return;
    }

    const targetIndex = selectedRowIndex >= 0 && selectedRowIndex < billItems.length 
      ? selectedRowIndex 
      : billItems.length - 1;

    removeItem(targetIndex);
  };

  // New Bill (F5)
  const handleNewBill = () => {
    if (billItems.length > 0) {
      if (!window.confirm('Clear current bill and start a new one?')) {
        return;
      }
    }
    setBillItems([]);
    setDiscountInput('0');
    setCodeQuery('');
    setSelectedRowIndex(-1);
    toast.info('New bill started', { duration: 1000 });
    focusCodeInput();
  };

  // Thermal Printing hook
  const handlePrintReceipt = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${lastOrderForPrint?.orderNumber || '00'}`,
    onAfterPrint: () => {
      toast.success('Receipt printed successfully', { duration: 1500 });
      setLastOrderForPrint(null);
    },
  });

  // Save & Print (F4)
  const handleSaveAndPrint = async () => {
    if (billItems.length === 0) {
      toast.error('Cannot save an empty bill. Add items first.', { duration: 2000 });
      focusCodeInput();
      return;
    }

    if (isSaving) return;

    try {
      setIsSaving(true);

      const nextCount = await api.orders.getDailyCount();
      const dailyId = nextCount + 1;

      // Find table details if selected
      const selectedTable = tables.find((t: any) => t.id === tableId);
      const tableName = selectedTable ? selectedTable.table_number : null;

      // Server / Waiter name fallback
      const activeWaiter = waiterName || profile?.full_name || tenant?.default_cashier_name || 'Cashier';

      const orderInsert = {
        customer_id: null,
        total_amount: grandTotal,
        status: 'completed',
        payment_method: paymentMethod,
        order_type: orderType,
        table_id: tableId || null,
        server_name: activeWaiter,
        customer_address: null,
        register_id: null,
        daily_id: dailyId,
        tenant_id: tenant?.id,
      };

      const orderItemsInsert = billItems.map((item) => ({
        product_id: item.id,
        product_name: item.name,
        product_category: item.product?.category || 'General',
        quantity: item.quantity,
        price: item.price,
      }));

      const createdOrder = await api.orders.create(orderInsert, orderItemsInsert);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['daily-order-count'] });

      // Auto-clear table if dine-in
      if (orderType === 'dine_in' && tableId) {
        try {
          await api.tables.updateStatus(tableId, 'available');
          queryClient.invalidateQueries({ queryKey: ['tables'] });
        } catch (tableErr) {
          console.warn('Could not auto-release table:', tableErr);
        }
      }

      toast.success(`Bill #${String(dailyId).padStart(2, '0')} saved successfully!`, { duration: 2000 });

      // Format order object for Receipt printing component
      const printOrderObj = {
        orderNumber: String(dailyId).padStart(2, '0'),
        items: billItems.map((item) => ({
          product: item.product,
          quantity: item.quantity,
          variants: [],
          addons: [],
          itemNotes: '',
        })),
        customer: null,
        subtotal: subtotal,
        taxAmount: 0,
        discountAmount: discount,
        total: grandTotal,
        paymentMethod: paymentMethod,
        orderType: orderType,
        createdAt: new Date(),
        cashierName: activeWaiter,
        serverName: activeWaiter,
        tableId: tableName || tableId || null,
        receivedCash: grandTotal,
        remainingCash: 0,
      };

      setLastOrderForPrint(printOrderObj);

      // Trigger print after state render update
      setTimeout(() => {
        handlePrintReceipt();
      }, 100);

      // Clear bill for next transaction
      setBillItems([]);
      setDiscountInput('0');
      setCodeQuery('');
      setSelectedRowIndex(-1);
      focusCodeInput();
    } catch (err: any) {
      console.error('Failed to save bill:', err);
      toast.error(`Error saving bill: ${err.message || 'Unknown error'}`, { duration: 3000 });
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard Shortcuts Listener (F2, F4, F5, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleRemoveSelectedOrLast();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleSaveAndPrint();
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleNewBill();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setCodeQuery('');
        focusCodeInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [billItems, selectedRowIndex, isSaving, grandTotal, subtotal, discount, paymentMethod, orderType, tableId, waiterName, profile, tenant]);

  const currentBillNo = String((dailyCount || 0) + 1).padStart(2, '0');

  return (
    <MainLayout>
      <div className="flex h-full w-full flex-col bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">
        {/* Top App Bar Header */}
        <div className="flex h-14 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-500/20">
              <Zap className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-heading text-base font-black tracking-wider uppercase text-slate-900 dark:text-slate-100 flex items-center gap-2">
                GENX FAST BILLING
                <Badge variant="outline" className="border-emerald-500 text-emerald-600 font-mono text-[10px] uppercase font-bold px-1.5 py-0">
                  CODE ENTRY MODE
                </Badge>
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">Ultra-Fast POS Terminal</p>
            </div>
          </div>

          {/* Bill No & Keyboard Guide */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1 text-emerald-800 dark:text-emerald-300">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold uppercase tracking-wider">Bill #:</span>
              <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">#{currentBillNo}</span>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
              <span className="bg-white dark:bg-slate-900 px-1 rounded shadow-xs font-bold border border-slate-300 dark:border-slate-700">ENTER</span> Add
              <span className="ml-1 bg-white dark:bg-slate-900 px-1 rounded shadow-xs font-bold border border-slate-300 dark:border-slate-700">F2</span> Del
              <span className="ml-1 bg-white dark:bg-slate-900 px-1 rounded shadow-xs font-bold border border-slate-300 dark:border-slate-700">F4</span> Save
              <span className="ml-1 bg-white dark:bg-slate-900 px-1 rounded shadow-xs font-bold border border-slate-300 dark:border-slate-700">F5</span> New
              <span className="ml-1 bg-white dark:bg-slate-900 px-1 rounded shadow-xs font-bold border border-slate-300 dark:border-slate-700">ESC</span> Clear
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden p-3 gap-3">
          
          {/* LEFT PANEL (~65%) */}
          <div className="flex flex-col w-[65%] gap-3 h-full overflow-hidden">
            
            {/* Header Controls (Order Type, Table, Waiter, Payment Method) */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs shrink-0">
              <CardContent className="p-3">
                <div className="grid grid-cols-12 gap-3 items-center">
                  
                  {/* Order Type Toggle */}
                  <div className="col-span-5 flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setOrderType('dine_in')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                        orderType === 'dine_in'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Utensils className="h-3.5 w-3.5" /> Dine-In
                    </button>
                    <button
                      onClick={() => setOrderType('take_away')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                        orderType === 'take_away'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <ShoppingBag className="h-3.5 w-3.5" /> Takeaway
                    </button>
                    <button
                      onClick={() => setOrderType('delivery')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                        orderType === 'delivery'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Truck className="h-3.5 w-3.5" /> Delivery
                    </button>
                  </div>

                  {/* Table Selector */}
                  <div className="col-span-3">
                    <Select value={tableId} onValueChange={setTableId}>
                      <SelectTrigger className="h-9 text-xs font-semibold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 truncate">
                          <Armchair className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <SelectValue placeholder="Select Table" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Table</SelectItem>
                        {tables.map((tbl: any) => (
                          <SelectItem key={tbl.id} value={tbl.id}>
                            Table #{tbl.table_number} ({tbl.section || 'Indoor'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Waiter / Server Selector */}
                  <div className="col-span-4">
                    <Select value={waiterName} onValueChange={setWaiterName}>
                      <SelectTrigger className="h-9 text-xs font-semibold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 truncate">
                          <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <SelectValue placeholder="Select Waiter" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ali Hyder">Ali Hyder (Default)</SelectItem>
                        {staffList.map((stf: any) => (
                          <SelectItem key={stf.id} value={stf.name || stf.full_name}>
                            {stf.name || stf.full_name} ({stf.role || 'Staff'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* High-Contrast Code Entry Input */}
            <Card className="border-2 border-emerald-500/80 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-md shrink-0 transition-all">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0 shadow-sm">
                    <Barcode className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="genx-code-input" className="block text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-1">
                      Scan / Enter Item Code (DishCode) + Press ENTER
                    </label>
                    <Input
                      id="genx-code-input"
                      ref={codeInputRef}
                      type="text"
                      placeholder="e.g. 101, A1, MUTTON, or scan barcode..."
                      value={codeQuery}
                      onChange={(e) => setCodeQuery(e.target.value)}
                      onKeyDown={handleCodeKeyDown}
                      className="h-11 font-mono text-lg font-black tracking-wide bg-white dark:bg-slate-900 border-2 border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-600 shadow-inner"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleCodeSubmit}
                    className="h-11 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold tracking-wider uppercase text-xs shadow-sm"
                  >
                    ADD ITEM
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Billing Items Table */}
            <Card className="flex-1 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto">
                <Table className="w-full">
                  <TableHeader className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                    <TableRow className="h-9 border-b border-slate-200 dark:border-slate-700">
                      <TableHead className="w-12 text-center text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">S#</TableHead>
                      <TableHead className="w-24 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">Code</TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Item Name</TableHead>
                      <TableHead className="w-24 text-right text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Rate</TableHead>
                      <TableHead className="w-28 text-center text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Qty</TableHead>
                      <TableHead className="w-28 text-right text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Amount</TableHead>
                      <TableHead className="w-12 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-48 text-center">
                          <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                            <Barcode className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                            <p className="text-sm font-bold text-slate-500">Bill is currently empty</p>
                            <p className="text-xs text-slate-400">Enter dish code above or click items from the item master on the right.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      billItems.map((item, idx) => {
                        const isSelected = selectedRowIndex === idx;
                        return (
                          <TableRow
                            key={`${item.id}-${idx}`}
                            onClick={() => setSelectedRowIndex(idx)}
                            className={`h-11 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-l-emerald-600 font-semibold'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <TableCell className="text-center text-xs font-mono font-bold text-slate-500">{idx + 1}</TableCell>
                            <TableCell className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">{item.sku}</TableCell>
                            <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.name}</TableCell>
                            <TableCell className="text-right text-xs font-mono text-slate-600 dark:text-slate-300">Rs {item.price.toLocaleString()}</TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(idx, item.quantity - 1)}
                                  className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateQuantity(idx, parseInt(e.target.value, 10) || 0)}
                                  className="h-7 w-12 text-center font-mono font-bold text-xs p-0 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(idx, item.quantity + 1)}
                                  className="h-6 w-6 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono font-black text-slate-900 dark:text-slate-100">
                              Rs {item.amount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-slate-400 hover:text-red-600 transition-colors"
                                title="Remove item (F2)"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Totals & Action Buttons Footer */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md shrink-0">
              <CardContent className="p-3">
                <div className="grid grid-cols-12 gap-3 items-center">
                  
                  {/* Payment Method Selector */}
                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Payment Method</label>
                    <Select value={paymentMethod} onValueChange={(val: any) => setPaymentMethod(val)}>
                      <SelectTrigger className="h-9 text-xs font-bold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="wallet">Digital Wallet</SelectItem>
                        <SelectItem value="credit">Credit (Udhaar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subtotal & Discount Inputs */}
                  <div className="col-span-4 flex items-center justify-between gap-2 px-2 border-x border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-500">Subtotal</span>
                      <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">Rs {subtotal.toLocaleString()}</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Discount (Rs)</label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        className="h-8 w-24 font-mono font-bold text-xs text-right bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  {/* Grand Total Prominent Display */}
                  <div className="col-span-5 flex items-center justify-end gap-3">
                    <div className="text-right">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Grand Total</span>
                      <span className="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
                        Rs {grandTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="grid grid-cols-12 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveSelectedOrLast}
                    disabled={billItems.length === 0}
                    className="col-span-3 h-10 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950 font-bold text-xs uppercase"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> REMOVE ITEM (F2)
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleNewBill}
                    className="col-span-3 h-10 border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 font-bold text-xs uppercase"
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" /> NEW BILL (F5)
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSaveAndPrint}
                    disabled={isSaving || billItems.length === 0}
                    className="col-span-6 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> SAVING...
                      </>
                    ) : (
                      <>
                        <Printer className="h-4 w-4 mr-2" /> SAVE & PRINT BILL (F4)
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* RIGHT PANEL (~35%) - ITEM MASTER */}
          <div className="flex flex-col w-[35%] h-full gap-3 overflow-hidden">
            <Card className="flex-1 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col overflow-hidden">
              <CardHeader className="p-3 pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>ITEM MASTER (SEARCH & SELECT)</span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {filteredProducts.length} Items
                  </Badge>
                </CardTitle>

                {/* Search Bar */}
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search by code or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-9 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Category Pills Filter */}
                <ScrollArea className="w-full whitespace-nowrap mt-2 pb-1">
                  <div className="flex gap-1">
                    {categoryList.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                          selectedCategory === cat
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardHeader>

              {/* Scrollable Item Master List */}
              <CardContent className="flex-1 p-2 overflow-auto">
                {isProductsLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                    <p className="text-xs">Loading items...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                    <AlertCircle className="h-8 w-8 text-slate-300 mb-1" />
                    <p className="text-xs font-bold text-slate-500">No items found</p>
                    <p className="text-[11px] text-slate-400">Try adjusting your search query or category filter.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {filteredProducts.map((prod: any) => (
                      <div
                        key={prod.id}
                        onClick={() => addProductToBill(prod)}
                        className="group flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Badge variant="outline" className="font-mono text-[10px] font-black text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 shrink-0">
                            {prod.sku || 'CODE'}
                          </Badge>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                              {prod.name}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {prod.category || 'General'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-xs font-black text-slate-900 dark:text-slate-100">
                            Rs {Number(prod.price).toLocaleString()}
                          </span>
                          <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Hidden Printable Receipt Component */}
        <div className="hidden">
          {lastOrderForPrint && <Receipt ref={receiptRef} order={lastOrderForPrint} />}
        </div>
      </div>
    </MainLayout>
  );
};

export default GenXPage;
