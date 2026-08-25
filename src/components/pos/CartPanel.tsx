import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, User, Search, X, Printer, Wallet, ChefHat, FileText, Tag, CheckCircle2, CreditCard } from 'lucide-react';
import Fuse from 'fuse.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCartStore, Customer } from '@/stores/cartStore';
import PrintPreviewModal from './PrintPreviewModal';
import Receipt from './Receipt';
import KOT from './KOT';
import Bill from './Bill';
import RiderSelectionModal from './RiderSelectionModal';
import { CreditCustomerModal } from './CreditCustomerModal';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useMultiTenant } from '@/hooks/useMultiTenant';

import TableSelectionModal from './TableSelectionModal';
import BillSettlementCalculatorModal from './BillSettlementCalculatorModal';

const CartPanel = () => {
  const navigate = useNavigate();
  const { tenant, cashierName: hookCashierName, isCashierLogin, profile, isAdmin } = useMultiTenant();
  const isCashier = isCashierLogin || profile?.role === 'cashier' || localStorage.getItem('active_role') === 'cashier';
  const {
    items,
    customer,
    subtotal,
    taxAmount,
    taxRate,
    discountAmount,
    serviceChargesAmount,
    total,
    updateQuantity,
    updatePrice,
    removeItem,
    setCustomer,
    orderType,
    setOrderType,
    clearCart,
    discount,
    discountType,
    setDiscount,
    serviceCharges,
    serviceChargesType,
    setServiceCharges,
    deliveryFee,
    tableId,
    setTableId,
    rider,
    setRider,
    customerAddress,
    setCustomerAddress,
    serverName,
    setServerName,
    editingOrderId
  } = useCartStore();

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'wallet' | 'credit'>('cash');
  const [discountInput, setDiscountInput] = useState('');
  const [serviceChargesInput, setServiceChargesInput] = useState('');
  const [showTableModal, setShowTableModal] = useState(false);
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showBillPreviewModal, setShowBillPreviewModal] = useState(false);
  const [billPreviewOrder, setBillPreviewOrder] = useState<any>(null);
  const [pendingAfterRider, setPendingAfterRider] = useState<'none' | 'bill' | 'complete'>('none');
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [previewActive, setPreviewActive] = useState<'none' | 'receipt' | 'kot' | 'bill'>('none');
  const [kotItemsToPrint, setKotItemsToPrint] = useState<any[]>([]);
  const [cashierName, setCashierName] = useState(hookCashierName || 'Anas');
  const [cartFlash, setCartFlash] = useState<string | null>(null);
  const cartFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const kotRef = useRef<HTMLDivElement>(null);
  const billRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (hookCashierName) {
      setCashierName(hookCashierName);
    }
  }, [hookCashierName]);

  // Flash notification: detect newly added item by items length change
  const prevItemsLengthRef = useRef(items.length);
  const prevItemsRef = useRef<typeof items>([]);
  useEffect(() => {
    if (items.length > 0) {
      // Find the item with changed quantity or a newly added item
      let flashName: string | null = null;
      if (items.length > prevItemsLengthRef.current) {
        // New item added
        const added = items[items.length - 1];
        flashName = added?.product?.name || null;
      } else if (items.length === prevItemsLengthRef.current) {
        // Same count — check if any quantity increased
        for (const item of items) {
          const prev = prevItemsRef.current.find(p => p.product.id === item.product.id);
          if (prev && item.quantity > prev.quantity) {
            flashName = item.product.name;
            break;
          }
        }
      }
      if (flashName) {
        setCartFlash(flashName);
        if (cartFlashTimerRef.current) clearTimeout(cartFlashTimerRef.current);
        cartFlashTimerRef.current = setTimeout(() => setCartFlash(null), 700);
      }
    }
    prevItemsLengthRef.current = items.length;
    prevItemsRef.current = items;
  }, [items]);

  const getServerNameWithRole = () => {
    const role = localStorage.getItem('active_role');
    if (role && role !== 'admin') {
      return `[${role}] ${serverName || ''}`.trim();
    }
    return serverName || null;
  };

  // Fetch tables to display selected table number
  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: api.tables.getAll,
  }) as any;

  // Fetch customers
  const { data: dbCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: api.customers.getAll,
  });

  const customers = useMemo(() => {
    return dbCustomers.map((c: any) => ({
      id: (c.id || c.customer_id).toString(),
      name: c.name,
      phone: c.phone,
      email: c.email,
      loyaltyPoints: c.loyalty_points || 0,
      totalSpent: Number(c.total_spent) || 0,
      visitCount: c.total_orders || 0,
      creditBalance: Number(c.credit_balance) || 0
    }));
  }, [dbCustomers]);

  const selectedTable = useMemo(() =>
    tables.find((t: any) => (t.id || t.table_id) === tableId),
    [tables, tableId]
  );

  const { data: openRegister } = useQuery({
    queryKey: ['open-register'],
    queryFn: api.registers.getOpen,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      if (editingOrderId) {
        return api.orders.update(editingOrderId, orderData.order, orderData.items);
      }
      return api.orders.create(orderData.order, orderData.items);
    },
    onSuccess: (newOrder: any) => {
      toast.dismiss();
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });

      if (editingOrderId) {
        setLastOrder((prev: any) => ({ 
          ...prev, 
          id: editingOrderId,
          orderNumber: newOrder?.orderNumber || prev?.orderNumber
        }));
      } else if (newOrder && typeof newOrder === 'object') {
        setLastOrder((prev: any) => ({ 
          ...prev, 
          id: newOrder.id,
          orderNumber: newOrder.orderNumber || prev?.orderNumber
        }));
      }

      // Auto-clear table for complete sale (dine-in)
      if (orderType === 'dine_in' && tableId) {
        api.tables.updateStatus(tableId, 'available').then(() => {
          queryClient.invalidateQueries({ queryKey: ['tables'] });
        }).catch(err => console.warn('Failed to clear table on complete:', err));
      }

      // Print immediately
      setTimeout(() => {
        handlePrint();
        toast.success(editingOrderId ? 'Order updated!' : 'Order completed!');
      }, 50);
    },
    onError: (error: any) => {
      toast.dismiss(); // Dismiss any loading toast
      console.error('Order creation failed:', error);
      // Supabase errors are objects with a message property, not necessarily Error instances
      const errorMessage = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      console.error('Detailed error message:', errorMessage);
      toast.error(`Failed to save order: ${errorMessage}`);
    }
  });

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${lastOrder?.orderNumber}`,
    onAfterPrint: async () => {
      toast.success('Receipt printed!', { duration: 1000 });
      
      // Auto-clear table if it's a dine-in order
      if (orderType === 'dine_in' && tableId) {
        try {
          await api.tables.updateStatus(tableId, 'available');
          queryClient.invalidateQueries({ queryKey: ['tables'] });
        } catch (err) {
          console.error('Failed to auto-clear table:', err);
        }
      }

      clearCart();
      navigate('/ongoing-orders');
    },
  });

  const handlePrintKOT = useReactToPrint({
    contentRef: kotRef,
    documentTitle: `KOT-${Date.now()}`,
    onAfterPrint: () => {
      toast.success('KOT sent to kitchen!', { duration: 1000 });
      
      // Save printed quantities
      if (lastOrder?.id) {
        const printedMap = JSON.parse(localStorage.getItem(`kot_printed_${lastOrder.id}`) || '{}');
        kotItemsToPrint.forEach(item => {
          printedMap[item.product.id] = (printedMap[item.product.id] || 0) + item.quantity;
        });
        localStorage.setItem(`kot_printed_${lastOrder.id}`, JSON.stringify(printedMap));
      }

      clearCart();
      navigate('/ongoing-orders');
    },
  });

  const handlePrintBill = useReactToPrint({
    contentRef: billRef,
    documentTitle: `Bill-${Date.now()}`,
    onAfterPrint: async () => {
      toast.success('Bill printed successfully', { duration: 1000 });

      // When bill is printed from the cart, we should save the order as completed
      // because the user wants to "save all the orders whose bills was printed once"
      if (items.length > 0) {
        try {
          const count = await api.orders.getDailyCount();
          const dailyId = count + 1;

          const orderInsert = {
            customer_id: customer?.id || null,
            total_amount: total,
            status: 'completed',
            payment_method: paymentMethod,
            order_type: orderType,
            table_id: tableId || null,
            server_name: getServerNameWithRole(),
            customer_address: customerAddress || null,
            register_id: null,
            daily_id: dailyId,
          };

          const orderItemsInsert = items.map(item => ({
            product_id: item.product.id,
            product_name: item.product.name,
            product_category: item.product.category,
            quantity: item.quantity,
            price: item.product.price
          }));

          const toastId = toast.loading('Saving order after bill print...');

          await api.orders.create({ ...orderInsert, tenant_id: tenant?.id }, orderItemsInsert);

          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });
          queryClient.invalidateQueries({ queryKey: ['products'] }); // stock updated inside api.orders.create

          toast.dismiss(toastId);
          toast.success('Order saved as completed', { duration: 1000 });
          
          // Auto-clear table if it's a dine-in order
          if (orderType === 'dine_in' && tableId) {
            try {
              await api.tables.updateStatus(tableId, 'available');
              queryClient.invalidateQueries({ queryKey: ['tables'] });
            } catch (err) {
              console.error('Failed to auto-clear table after bill:', err);
            }
          }

          // Clear cart and navigate away after printing bill
          clearCart();
          navigate('/ongoing-orders');
        } catch (error) {
          console.error('Failed to auto-save order after bill print:', error);
          toast.error('Failed to save order');
        }
      }
    },
  });

  const performShowBill = async () => {
    const orderData = await prepareOrderData();
    setLastOrder(orderData);
    // Print Bill directly (Silent)
    setTimeout(() => {
      handlePrintBill();
    }, 100);
  };

  const prepareOrderData = async (): Promise<{
    orderNumber: string;
    daily_id?: number;
    items: typeof items;
    customer: typeof customer;
    rider: typeof rider;
    customerAddress: typeof customerAddress;
    serverName: typeof serverName;
    tableId: string | null;
    orderType: typeof orderType;
    subtotal: number;
    taxAmount: number;
    taxRate: number;
    discountAmount: number;
    total: number;
    serviceChargesAmount: number;
    paymentMethod: typeof paymentMethod;
    createdAt: Date;
    cashierName: typeof cashierName;
    status?: string;
    isPrePayment?: boolean;
  }> => {
    const count = await api.orders.getDailyCount();
    let dailyId = count + 1;
    let dailyIdStr = dailyId.toString().padStart(2, '0');
    let effectiveServerName = (() => {
      const role = localStorage.getItem('active_role');
      if (role && role !== 'admin') {
        return `[${role}] ${serverName || ''}`.trim();
      }
      return serverName;
    })();

    if (editingOrderId) {
      const cachedOngoing: any[] = queryClient.getQueryData(['ongoing-orders']) || [];
      const cachedOrder = cachedOngoing.find((o: any) => o.id === editingOrderId);
      if (cachedOrder) {
        if (cachedOrder.daily_id) {
          dailyId = cachedOrder.daily_id;
          dailyIdStr = cachedOrder.daily_id.toString().padStart(2, '0');
        }
        if (!serverName && cachedOrder.server_name) {
          effectiveServerName = cachedOrder.server_name;
        }
      }
    }

    return {
      orderNumber: dailyIdStr,
      daily_id: dailyId,
      items: [...items],
      customer,
      rider, // Include rider
      customerAddress, // Include address
      serverName: effectiveServerName,
      tableId: selectedTable?.table_number ?? null,
      orderType,
      subtotal,
      taxAmount,
      taxRate: taxRate !== undefined && taxRate !== null ? taxRate : (tenant?.tax_rate !== undefined && tenant?.tax_rate !== null ? Number(tenant.tax_rate) : 0),
      discountAmount,
      serviceChargesAmount,
      deliveryFee,
      total,
      paymentMethod,
      createdAt: new Date(),
      cashierName, // Use real cashier name
      status: 'completed',
      isPrePayment: false,
    };
  };

  const createKOTOrderMutation = useMutation({
    mutationFn: async (orderData: { order: any; items: any[] }) => {
      if (editingOrderId) {
        return api.orders.update(editingOrderId, orderData.order, orderData.items);
      }
      return api.orders.create(orderData.order, orderData.items);
    },
    onSuccess: async (newOrder: any) => {
      queryClient.invalidateQueries({ queryKey: ['ongoing-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      // Prepare order data for KOT printing
      const orderData = await prepareOrderData();

      if (editingOrderId) {
        orderData.id = editingOrderId;
        // Priority: returned daily_id from update → orderNumber → cached ongoing order daily_id
        if (newOrder?.daily_id) {
          orderData.orderNumber = newOrder.daily_id.toString().padStart(2, '0');
        } else if (newOrder?.orderNumber) {
          orderData.orderNumber = newOrder.orderNumber;
        } else {
          // Fallback: look up the daily_id from the already-cached ongoing orders list
          const cachedOngoing: any[] = queryClient.getQueryData(['ongoing-orders']) || [];
          const cachedOrder = cachedOngoing.find((o: any) => o.id === editingOrderId);
          if (cachedOrder?.daily_id) {
            orderData.orderNumber = cachedOrder.daily_id.toString().padStart(2, '0');
          }
          // If still not found, keep whatever prepareOrderData returned (last resort)
        }
      } else if (newOrder && typeof newOrder === 'object') {
        orderData.id = newOrder.id;
        // Use the real daily_id from the saved order as KOT number
        if (newOrder.daily_id) {
          orderData.orderNumber = newOrder.daily_id.toString().padStart(2, '0');
        } else if (newOrder.orderNumber) {
          orderData.orderNumber = newOrder.orderNumber;
        }
      }

      const targetId = orderData.id;
      const printedMap = JSON.parse(localStorage.getItem(`kot_printed_${targetId}`) || '{}');
      let revCount = Number(localStorage.getItem(`kot_revision_${targetId}`) || 1);
      
      const hasPrintedBefore = Object.keys(printedMap).length > 0;
      const isRevision = !!(editingOrderId || hasPrintedBefore);
      if (isRevision) {
        revCount += 1;
        localStorage.setItem(`kot_revision_${targetId}`, String(revCount));
      }
      
      // Build the newly-added items (qty delta since last print)
      const newKotItems = orderData.items.map(item => {
        const previouslyPrinted = printedMap[item.product.id] || 0;
        const qtyToPrint = item.quantity - previouslyPrinted;
        return { ...item, quantity: qtyToPrint };
      }).filter(item => item.quantity > 0);

      // Build the already-printed items (show above the divider line on revised KOTs)
      const previousPrintedItems = isRevision
        ? orderData.items
            .map(item => {
              const previouslyPrinted = printedMap[item.product.id] || 0;
              return previouslyPrinted > 0 ? { ...item, quantity: previouslyPrinted } : null;
            })
            .filter(Boolean)
        : [];

      orderData.revisionNumber = revCount;
      orderData.previousItems = previousPrintedItems;
      orderData.newlyAddedItems = newKotItems;
      setKotItemsToPrint(newKotItems);
      setLastOrder(orderData);

      if (newKotItems.length > 0) {
        // Print KOT immediately
        setTimeout(() => {
          handlePrintKOT();
        }, 50);
      } else {
        toast.info('No new items to print on KOT', { duration: 1000 });
        clearCart();
        navigate('/ongoing-orders');
      }
    },
    onError: (error: any) => {
      console.error('Order creation failed:', error);
      const errorMessage = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      toast.error(`Failed to save order: ${errorMessage}`);
    }
  });



  const handleDone = async () => {
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const count = await api.orders.getDailyCount();
    const dailyId = count + 1;

    const orderInsert = {
      customer_id: customer?.id || null,
      total_amount: total,
      status: 'pending', // Set as pending for ongoing orders
      payment_method: 'cash', // Default payment method
      order_type: orderType,
      table_id: tableId || null,
      server_name: getServerNameWithRole(),
      customer_address: customerAddress || null,
      register_id: null,
      tenant_id: tenant?.id || null,
      daily_id: dailyId,
    };

    const orderItemsInsert = items.map(item => ({
      product_id: item.product.id,
      product_name: item.product.name,
      product_category: item.product.category,
      quantity: item.quantity,
      price: item.product.price
    }));

    const toastId = toast.loading('Saving order...');
    
    // Begin preparing print data in parallel with the save if possible
    // but for now, we wait for mutation to trigger it in onSuccess
    
    createKOTOrderMutation.mutate({ order: orderInsert, items: orderItemsInsert }, {
      onSettled: () => {
        toast.dismiss(toastId);
      }
    });
  };

  const handleShowBill = async () => {
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (orderType === 'delivery' && !rider) {
      setPendingAfterRider('bill');
      setShowRiderModal(true);
      return;
    }
    await performShowBill();
  };

  const performCompleteSale = async () => {
    const orderInsert: any = {
      customer_id: customer?.id || null,
      total_amount: total,
      status: 'completed',
      payment_method: paymentMethod,
      order_type: orderType,
      table_id: tableId || null,
      server_name: getServerNameWithRole(),
      customer_address: customerAddress || null,
      register_id: null,
      tenant_id: tenant?.id || null,
    };

    const orderItemsInsert = items.map(item => ({
      product_id: item.product.id,
      product_name: item.product.name,
      product_category: item.product.category,
      quantity: item.quantity,
      price: item.product.price
    }));

    const toastId = toast.loading('Processing...');
    const localOrder = await prepareOrderData();
    setLastOrder(localOrder);
    orderInsert.daily_id = (localOrder as any).daily_id ?? null;

    createOrderMutation.mutate({ order: orderInsert, items: orderItemsInsert }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['products'] });
      },
      onSettled: () => {
        toast.dismiss(toastId);
      }
    });
  };

  const handleCompleteSale = async () => {
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (paymentMethod === 'credit' && !customer) {
      toast.error('Customer selection is required for credit sales', {
        style: { background: '#ef4444', color: 'white', border: 'none' }
      });
      return;
    }
    if (orderType === 'delivery' && !rider) {
      setPendingAfterRider('complete');
      setShowRiderModal(true);
      return;
    }
    await performCompleteSale();
  };

  const handleSettleBill = async (receivedCash: number, remainingCash: number) => {
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    
    const orderData = await prepareOrderData();
    const fullOrderForPrint = {
      ...orderData,
      receivedCash,
      remainingCash,
    };
    setLastOrder(fullOrderForPrint);

    const orderInsert: any = {
      customer_id: customer?.id || null,
      total_amount: total,
      status: 'completed',
      payment_method: paymentMethod,
      order_type: orderType,
      table_id: tableId || null,
      server_name: getServerNameWithRole(),
      customer_address: customerAddress || null,
      register_id: null,
      tenant_id: tenant?.id || null,
      daily_id: orderData.daily_id ?? null,
    };

    const orderItemsInsert = items.map(item => ({
      product_id: item.product.id,
      product_name: item.product.name,
      product_category: item.product.category,
      quantity: item.quantity,
      price: item.product.price
    }));

    const toastId = toast.loading('Saving completed sale...');
    createOrderMutation.mutate({ order: orderInsert, items: orderItemsInsert }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['products'] }); // stock updated inside api.orders.create
      },
      onSettled: () => {
        toast.dismiss(toastId);
      }
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'u' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        handleClearCart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length]);

  const handleClearCart = () => {
    if (items.length === 0) return;
    clearCart();
    toast.error('Screen Cleared', {
      description: 'All items and customer data removed',
      duration: 2000,
    });
  };

  useEffect(() => {
    if (orderType !== 'delivery') {
      if (pendingAfterRider !== 'none') {
        setPendingAfterRider('none');
      }
      return;
    }
    if (!rider || pendingAfterRider === 'none') return;
    const action = pendingAfterRider;
    setPendingAfterRider('none');
    if (action === 'bill') {
      performShowBill();
    } else if (action === 'complete') {
      performCompleteSale();
    }
  }, [orderType, rider, pendingAfterRider]);

  return (
    <div className="flex flex-col h-full bg-card border-l font-sans pb-4 relative">
      {/* Header */}
      <div className="px-3 py-2 border-b flex justify-between items-center bg-muted/20 relative">
        <div>
          <h2 className="text-xs font-black font-heading tracking-wider uppercase text-slate-800">Current Order</h2>
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>

        {/* Tiny cart flash: shows item name for 700ms, positioned inside the header */}
        <div
          style={{ transition: 'opacity 0.15s, transform 0.15s' }}
          className={`flex items-center gap-1 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow pointer-events-none mx-auto
            ${cartFlash ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
          aria-live="polite"
        >
          <span>✓</span>
          <span className="max-w-[90px] truncate">{cartFlash ?? ''}</span>
        </div>

        {items.length > 0 && !isCashier && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearCart}
            className="h-6 px-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 text-[9px] font-bold uppercase tracking-wider"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {orderType === 'dine_in' && selectedTable && (
        <div className="px-3 py-1.5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between text-emerald-700">
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-full">
            Table: {selectedTable.table_number}
          </span>
          <span className="text-[10px] font-medium">
            {selectedTable.section} • {selectedTable.capacity} Seats
          </span>
        </div>
      )}

      {/* Cart Items */}
      <ScrollArea className="flex-1 p-3">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-muted-foreground"
            >
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Wallet className="h-8 w-8" />
              </div>
              <p className="font-medium">Cart is empty</p>
              <p className="text-sm">Add items to start a sale</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.product.id}
                  className="p-2.5 bg-background rounded-lg border"
                >
                  {/* Top row: image + name + delete */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                      {item.product.image?.startsWith('http') ? (
                        <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg">{item.product.image}</span>
                      )}
                    </div>
                    <p className="flex-1 font-bold font-heading text-[13px] leading-tight tracking-tight truncate">{item.product.name}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeItem(item.product.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {/* Bottom row: unit price + qty controls + line total */}                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Rs {item.product.price.toLocaleString()}/ea
                      </span>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.product.id, Math.max(0, item.quantity - 0.25))}
                          >
                            <Minus className="h-2.5 w-2.5" />
                          </Button>
                          <span className="w-10 text-center font-bold text-sm">
                            {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2)}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 0.25)}
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                        
                        {item.product.name.toLowerCase().includes('kg') && (
                          <div className="flex gap-1 items-center mt-1">
                            {[0.25, 0.5, 0.75, 1].map((val) => (
                              <Button
                                key={val}
                                variant={item.quantity === val ? "default" : "outline"}
                                size="sm"
                                className={cn(
                                  "h-6 px-1.5 text-[9px] font-black min-w-[35px] transition-all",
                                  item.quantity === val ? "bg-slate-900 text-white" : "text-slate-600 border-slate-200"
                                )}
                                onClick={() => updateQuantity(item.product.id, val)}
                              >
                                {val}kg
                              </Button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-1 items-center mt-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-[9px] font-black transition-all text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                Rs Amt
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-52 p-3" align="center">
                              <div className="space-y-2">
                                <h4 className="font-bold text-xs leading-none">Enter Rupee Amount</h4>
                                <p className="text-[10px] text-muted-foreground">
                                  {item.product.price > 0 ? "Qty will auto-calculate from rate" : "Price will set to entered amount"}
                                </p>
                                <div className="flex gap-2">
                                  <Input
                                    id={`amt-input-${item.product.id}`}
                                    type="number"
                                    placeholder="e.g. 100"
                                    className="h-8 text-sm flex-1"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const val = Number((e.currentTarget).value);
                                        if (val > 0) {
                                          if (item.product.price > 0) {
                                            updateQuantity(item.product.id, val / item.product.price);
                                          } else {
                                            updatePrice(item.product.id, val);
                                          }
                                          (e.currentTarget).value = '';
                                        }
                                      }
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black"
                                    onClick={() => {
                                      const input = document.getElementById(`amt-input-${item.product.id}`) as HTMLInputElement;
                                      if (input) {
                                        const val = Number(input.value);
                                        if (val > 0) {
                                          if (item.product.price > 0) {
                                            updateQuantity(item.product.id, val / item.product.price);
                                          } else {
                                            updatePrice(item.product.id, val);
                                          }
                                          input.value = '';
                                        }
                                      }
                                    }}
                                  >
                                    Set
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      <span className="font-black text-sm whitespace-nowrap">Rs {item.lineTotal.toLocaleString()}</span>
                    </div>

                </div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Payment Section */}
      <div className="border-t p-3 space-y-3 bg-muted/30">
        {/* Totals */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 font-bold font-heading uppercase tracking-wider text-[10px]">Subtotal</span>
            <span className="font-bold">Rs {subtotal.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-500 font-bold font-heading uppercase tracking-wider text-[10px]">
              <span>Discount</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-5 w-5 rounded-full">
                    <Tag className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="start">
                  <div className="space-y-4">
                    <h4 className="font-medium leading-none">Set Discount</h4>
                    <Tabs defaultValue={discountType} onValueChange={(v) => {
                      setDiscount(0, v as 'percentage' | 'fixed');
                      setDiscountInput('');
                    }}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="percentage">% Percent</TabsTrigger>
                        <TabsTrigger value="fixed">Rs Fixed</TabsTrigger>
                      </TabsList>
                      <div className="pt-4">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder={discountType === 'percentage' ? "Percentage (0-100)" : "Amount (Rs)"}
                            value={discountInput}
                            onChange={(e) => {
                              setDiscountInput(e.target.value);
                              setDiscount(Number(e.target.value), discountType);
                            }}
                          />
                        </div>
                      </div>
                    </Tabs>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setDiscount(0, 'percentage');
                        setDiscountInput('');
                      }}
                    >
                      Remove Discount
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <span className={discountAmount > 0 ? "text-success font-medium" : ""}>
              {discountAmount > 0 ? `-Rs ${discountAmount.toLocaleString()}` : '-'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-slate-500 font-bold font-heading uppercase tracking-wider text-[10px]">
              <span>Service Charges</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-5 w-5 rounded-full">
                    <Wallet className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="start">
                  <div className="space-y-4">
                    <h4 className="font-medium leading-none">Set Service Charges</h4>
                    <Tabs defaultValue={serviceChargesType} onValueChange={(v) => {
                      setServiceCharges(0, v as 'percentage' | 'fixed');
                      setServiceChargesInput('');
                    }}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="percentage">% Percent</TabsTrigger>
                        <TabsTrigger value="fixed">Rs Fixed</TabsTrigger>
                      </TabsList>
                      <div className="pt-4">
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder={serviceChargesType === 'percentage' ? "Percentage (0-100)" : "Amount (Rs)"}
                            value={serviceChargesInput}
                            onChange={(e) => {
                              setServiceChargesInput(e.target.value);
                              setServiceCharges(Number(e.target.value), serviceChargesType);
                            }}
                          />
                        </div>
                      </div>
                    </Tabs>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setServiceCharges(0, 'percentage');
                        setServiceChargesInput('');
                      }}
                    >
                      Remove Charges
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <span className={serviceChargesAmount > 0 ? "text-blue-600 font-medium" : ""}>
              {serviceChargesAmount > 0 ? `+Rs ${serviceChargesAmount.toLocaleString()}` : '-'}
            </span>
          </div>

          {(taxRate > 0 || taxAmount > 0) && (
            <div className="flex justify-between items-center text-slate-500 font-bold font-heading uppercase tracking-wider text-[10px]">
              <span>{tenant?.tax_name || 'GST'} ({taxRate}%)</span>
              <span className="font-bold text-slate-700">+Rs {Math.round(taxAmount || (subtotal - discountAmount + serviceChargesAmount) * (taxRate / 100)).toLocaleString()}</span>
            </div>
          )}

          {deliveryFee > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold font-heading uppercase tracking-wider text-[10px]">Delivery Fee</span>
              <span className="font-bold">Rs {deliveryFee.toLocaleString()}</span>
            </div>
          )}

          <Separator className="bg-slate-200" />
          
          {customer && (customer.creditBalance || 0) > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex justify-between text-sm font-bold font-heading text-red-500 uppercase tracking-wider">
                <span>Previous Due</span>
                <span>Rs {(customer.creditBalance || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xl font-black font-heading tracking-tighter uppercase text-slate-900 mt-1">
                <span>Total Payable</span>
                <span>Rs {(total + (customer.creditBalance || 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold font-heading text-slate-500 mb-1">
                <span>(Current Bill: Rs {total.toLocaleString()})</span>
              </div>
            </div>
          )}
          {(!customer || (customer.creditBalance || 0) <= 0) && (
            <div className="flex justify-between text-xl font-black font-heading tracking-tighter uppercase text-slate-900">
              <span>Total</span>
              <span>Rs {total.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Payment Selection & Pay (Print KOT) Button */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Select
            value={paymentMethod}
            onValueChange={(val: any) => {
              setPaymentMethod(val);
              if (val === 'credit') {
                setShowCreditModal(true);
              }
            }}
          >
            <SelectTrigger className="h-10 font-black font-heading uppercase tracking-wider text-xs bg-white border-2 border-slate-200">
              <div className="flex items-center gap-1.5 truncate">
                {paymentMethod === 'cash' && <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                {paymentMethod === 'credit' && <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                {paymentMethod === 'card' && <CreditCard className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                {paymentMethod === 'wallet' && <Wallet className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                <span className="truncate">{paymentMethod === 'credit' ? 'Credit' : paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'card' ? 'Card' : 'Wallet'}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash" className="font-bold text-xs uppercase">
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Cash
                </div>
              </SelectItem>
              <SelectItem value="credit" className="font-bold text-xs uppercase">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-blue-600" /> Credit (Udhaar)
                </div>
              </SelectItem>
              <SelectItem value="card" className="font-bold text-xs uppercase">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-purple-600" /> Card / POS
                </div>
              </SelectItem>
              <SelectItem value="wallet" className="font-bold text-xs uppercase">
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-amber-600" /> Digital Wallet
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="default"
            className="h-10 font-black font-heading uppercase tracking-widest text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20"
            onClick={handleCompleteSale}
            disabled={items.length === 0}
          >
            <Printer className="w-4 h-4 mr-1.5" /> Pay
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 h-8 text-[11px] font-extrabold font-heading uppercase tracking-wider border-2 border-emerald-500/30 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
            onClick={handleDone}
            disabled={items.length === 0}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Done
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-8 text-[11px] font-extrabold font-heading uppercase tracking-wider border-2 border-emerald-500/30 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
            onClick={() => {
              if (items.length === 0) { toast.error('Cart is empty'); return; }
              setShowSettlementModal(true);
            }}
            disabled={items.length === 0}
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            Settle
          </Button>
        </div>
      </div>

      {/* Hidden Print Container - Only used for actual react-to-print transmission */}
      <div className="hidden">
        {lastOrder && (
          <>
            <Receipt ref={receiptRef} order={lastOrder} />
            <KOT ref={kotRef} order={{ ...lastOrder, items: kotItemsToPrint.length > 0 ? kotItemsToPrint : lastOrder.items, previousItems: lastOrder.previousItems, newlyAddedItems: lastOrder.newlyAddedItems }} />
          </>
        )}
        {/* Bill ref always targets either billPreviewOrder or lastOrder – never both */}
        <Bill ref={billRef} order={billPreviewOrder ?? lastOrder ?? { orderNumber: '', items: [], customer: null, subtotal: 0, taxAmount: 0, discountAmount: 0, total: 0, paymentMethod: 'cash', createdAt: new Date(), cashierName: '' }} />
      </div>

      {/* Settle Bill Preview Modal */}
      <Dialog open={showBillPreviewModal} onOpenChange={setShowBillPreviewModal}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl bg-white">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              Bill Preview
            </DialogTitle>
            <DialogDescription className="text-[10px] text-slate-500">
              Review the bill before printing or settling
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[70vh] flex justify-center bg-gray-50 p-3">
            {billPreviewOrder && <Bill order={billPreviewOrder} />}
          </div>
          <div className="flex gap-2 p-3 border-t bg-white">
            <Button
              variant="outline"
              className="flex-1 h-10 font-bold text-xs uppercase tracking-wider"
              onClick={() => setShowBillPreviewModal(false)}
            >
              Close
            </Button>
            <Button
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-md"
              onClick={() => {
                setLastOrder(billPreviewOrder);
                setShowBillPreviewModal(false);
                setTimeout(() => handlePrintBill(), 150);
              }}
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print Bill
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PrintPreviewModal 
        isOpen={previewActive !== 'none' && !!lastOrder} 
        onClose={() => setPreviewActive('none')}
        onPrint={() => {
          if (previewActive === 'receipt') handlePrint();
          if (previewActive === 'kot') handlePrintKOT();
          if (previewActive === 'bill') handlePrintBill();
        }}
        title={`Print Preview - ${previewActive.toUpperCase()}`}
      >
        {lastOrder && previewActive === 'receipt' && <Receipt order={lastOrder} />}
        {lastOrder && previewActive === 'kot' && <KOT order={{ ...lastOrder, items: kotItemsToPrint.length > 0 ? kotItemsToPrint : lastOrder.items }} />}
        {lastOrder && previewActive === 'bill' && <Bill order={lastOrder} />}
      </PrintPreviewModal>

      <RiderSelectionModal
        isOpen={showRiderModal}
        onClose={() => setShowRiderModal(false)}
      />
      <CreditCustomerModal
        isOpen={showCreditModal}
        onClose={() => setShowCreditModal(false)}
        customers={customers}
        selectedCustomer={customer}
        onSelectCustomer={setCustomer}
        onPrintBill={async () => {
          if (items.length > 0) await handleShowBill();
          else toast.error('Cart is empty');
        }}
        onCompleteSale={async () => {
          if (items.length > 0) await handleCompleteSale();
          else toast.error('Cart is empty');
        }}
      />
      <TableSelectionModal
        isOpen={showTableModal}
        onClose={() => setShowTableModal(false)}
      />

      <BillSettlementCalculatorModal
        isOpen={showSettlementModal}
        onClose={() => setShowSettlementModal(false)}
        totalAmount={total}
        onSettle={handleSettleBill}
      />
    </div>
  );
};

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  customers: Customer[];
}

const CustomerSelector = ({ selectedCustomer, onSelect, customers }: CustomerSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fuse = useMemo(() => new Fuse(customers, {
    keys: ['name', 'phone', 'email'],
    threshold: 0.3,
  }), [customers]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers.slice(0, 50); // Show first 50 by default
    return fuse.search(searchQuery).slice(0, 50).map(r => r.item);
  }, [searchQuery, fuse, customers]);

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start h-12 text-base shadow-sm border-2">
          <User className="h-5 w-5 mr-3 text-muted-foreground" />
          {selectedCustomer ? (
            <span className="truncate font-medium">{selectedCustomer.name}</span>
          ) : (
            <span className="text-muted-foreground">Select Customer</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="h-64">
          <div className="p-2">
            {selectedCustomer && (
              <Button
                variant="ghost"
                className="w-full justify-start mb-2 text-muted-foreground"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Selection
              </Button>
            )}

            {filteredCustomers.map((customer) => (
              <Button
                key={customer.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start mb-1",
                  selectedCustomer?.id === customer.id && "bg-primary/10"
                )}
                onClick={() => handleSelect(customer)}
              >
                <div className="flex flex-col items-start text-left">
                  <span className="font-medium">{customer.name}</span>
                  <span className="text-xs text-muted-foreground">{customer.phone}</span>
                </div>
              </Button>
            ))}

            {filteredCustomers.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No customers found
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-2 border-t text-xs text-center text-muted-foreground">
          Showing {filteredCustomers.length} of {customers.length} customers
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CartPanel;
