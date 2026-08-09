import React, { useState, useEffect, useRef, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Search, 
  Clock, 
  ChefHat,
  Zap,
  RefreshCw
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

// 64 Rajput Restaurant Menu Items as Guaranteed Default Fallback
const RAJPUT_DEFAULT_PRODUCTS = [
  { id: 'rajput-61', sku: '61', name: 'Tea', price: 90, category: 'Soups' },
  { id: 'rajput-62', sku: '62', name: 'Lasi', price: 130, category: 'Fast Food' },
  { id: 'rajput-63', sku: '63', name: 'M-Water 1.5ltr', price: 120, category: 'English' },
  { id: 'rajput-64', sku: '64', name: 'M-Water 500mg', price: 60, category: 'English' },
  { id: 'rajput-65', sku: '65', name: 'S-drink (reg)', price: 60, category: 'Salads' },
  { id: 'rajput-66', sku: '66', name: 'S-Drink 500ml', price: 120, category: 'English' },
  { id: 'rajput-67', sku: '67', name: 'S-Drink 1.5ltr', price: 200, category: 'English' },
  { id: 'rajput-68', sku: '68', name: 'S-Drink ( Tin )', price: 120, category: 'English' },
  { id: 'rajput-69', sku: '69', name: 'Milk 500ml + Soda 250ml', price: 250, category: 'Beverage' },
  { id: 'rajput-70', sku: '70', name: 'Milk 1000ml + Soda 500ml', price: 500, category: 'Beverage' },
  { id: 'rajput-71', sku: '71', name: 'Milk (Sada) 250ml', price: 70, category: 'Beverage' },
  { id: 'rajput-72', sku: '72', name: 'Milk (Sugar) 250ml', price: 60, category: 'Beverage' },
  { id: 'rajput-73', sku: '73', name: 'Milk (Sada) 375ml', price: 90, category: 'Beverage' },
  { id: 'rajput-74', sku: '74', name: 'Milk 500ml', price: 140, category: 'Beverage' },
  { id: 'rajput-75', sku: '75', name: 'Milk (Sugar) 375ml', price: 110, category: 'Beverage' },
  { id: 'rajput-76', sku: '76', name: 'Milk (sada) 500ml', price: 120, category: 'Beverage' },
  { id: 'rajput-77', sku: '77', name: 'Dahi 250gm', price: 90, category: 'Beverage' },
  { id: 'rajput-78', sku: '78', name: 'Dahi 500gm', price: 180, category: 'Beverage' },
  { id: 'rajput-79', sku: '79', name: 'Dahi 1 Kg', price: 360, category: 'Beverage' },
  { id: 'rajput-80', sku: '80', name: 'Chapati', price: 15, category: 'Chinese' },
  { id: 'rajput-81', sku: '81', name: 'Roti', price: 20, category: 'Fast Food' },
  { id: 'rajput-82', sku: '82', name: 'Raita', price: 50, category: 'Fast Food' },
  { id: 'rajput-83', sku: '83', name: 'Salad', price: 50, category: 'Fast Food' },
  { id: 'rajput-84', sku: '84', name: 'Per Head', price: 200, category: 'Salads' },
  { id: 'rajput-85', sku: '85', name: 'Egg Omlate', price: 70, category: 'Fast Food' },
  { id: 'rajput-86', sku: '86', name: 'Egg Half fry', price: 70, category: 'Fast Food' },
  { id: 'rajput-88', sku: '88', name: 'Dal', price: 150, category: 'Pakistani' },
  { id: 'rajput-89', sku: '89', name: 'Dal Fry', price: 200, category: 'Pakistani' },
  { id: 'rajput-90', sku: '90', name: 'Chana', price: 180, category: 'Pakistani' },
  { id: 'rajput-91', sku: '91', name: 'Chana Fry', price: 220, category: 'Pakistani' },
  { id: 'rajput-94', sku: '94', name: 'Ch: Qurma', price: 250, category: 'Pakistani' },
  { id: 'rajput-96', sku: '96', name: 'Dal (100)', price: 100, category: 'Pakistani' },
  { id: 'rajput-99', sku: '99', name: 'Anda Garabe', price: 150, category: 'Pakistani' },
  { id: 'rajput-100', sku: '100', name: 'Ch: Karahi (Q)', price: 500, category: 'Pakistani' },
  { id: 'rajput-101', sku: '101', name: 'Ch: Karahi (H)', price: 1000, category: 'Pakistani' },
  { id: 'rajput-102', sku: '102', name: 'Ch:Karahi (F)', price: 2000, category: 'Pakistani' },
  { id: 'rajput-103', sku: '103', name: 'Ch: White Karahi (Q)', price: 550, category: 'Pakistani' },
  { id: 'rajput-104', sku: '104', name: 'Ch: White Karahi (H)', price: 1100, category: 'Pakistani' },
  { id: 'rajput-105', sku: '105', name: 'Ch: White Karahi (F)', price: 2200, category: 'Pakistani' },
  { id: 'rajput-106', sku: '106', name: 'Ch: Green Karahi (Q)', price: 550, category: 'Pakistani' },
  { id: 'rajput-107', sku: '107', name: 'Ch: Green Karahi (H)', price: 1100, category: 'Pakistani' },
  { id: 'rajput-108', sku: '108', name: 'Ch: Green Karahi (F)', price: 2200, category: 'Pakistani' },
  { id: 'rajput-109', sku: '109', name: 'Ch: Brown (Q)', price: 500, category: 'Pakistani' },
  { id: 'rajput-110', sku: '110', name: 'Ch: Brown (H)', price: 1000, category: 'Pakistani' },
  { id: 'rajput-111', sku: '111', name: 'Ch: Brown (F)', price: 2000, category: 'Pakistani' },
  { id: 'rajput-112', sku: '112', name: 'Ch:white Bonless (750)', price: 2100, category: 'Pakistani' },
  { id: 'rajput-113', sku: '113', name: 'Ch:white Bonless (H)', price: 1400, category: 'Pakistani' },
  { id: 'rajput-114', sku: '114', name: 'Ch:handi Bonless 3 (pao)', price: 2100, category: 'Beverage' },
  { id: 'rajput-115', sku: '115', name: 'Ch: Handi Bonless (Q)', price: 700, category: 'Pakistani' },
  { id: 'rajput-116', sku: '116', name: 'Ch: Handi Bonless (H)', price: 1400, category: 'Pakistani' },
  { id: 'rajput-117', sku: '117', name: 'Ch: Handi Bonless (F)', price: 2800, category: 'Pakistani' },
  { id: 'rajput-118', sku: '118', name: 'Mutton Karahi (Q)', price: 1000, category: 'Chinese' },
  { id: 'rajput-119', sku: '119', name: 'Mutton Karahi (H)', price: 2000, category: 'Chinese' },
  { id: 'rajput-120', sku: '120', name: 'Mutton Karahi (F)', price: 4000, category: 'Chinese' },
  { id: 'rajput-121', sku: '121', name: 'Mutton Brown (Q)', price: 1000, category: 'Chinese' },
  { id: 'rajput-122', sku: '122', name: 'Mutton Brown (H)', price: 2000, category: 'Chinese' },
  { id: 'rajput-123', sku: '123', name: 'Mutton Brown (F)', price: 4000, category: 'Chinese' },
  { id: 'rajput-166', sku: '166', name: 'Bun', price: 60, category: 'Fast Food' },
  { id: 'rajput-168', sku: '168', name: 'Milk (Sugar) 1ltr', price: 280, category: 'Beverage' },
  { id: 'rajput-170', sku: '170', name: 'Tika Bihari', price: 400, category: 'Pakistani' },
  { id: 'rajput-187', sku: '187', name: 'Chapati', price: 15, category: 'Chinese' },
  { id: 'rajput-212', sku: '212', name: 'Labour Salan', price: 0, category: 'Pakistani' },
  { id: 'rajput-213', sku: '213', name: 'Haff Cutt Labour', price: 0, category: 'Pakistani' },
  { id: 'rajput-214', sku: '214', name: 'Labour Roti', price: 0, category: 'Fast Food' },
];

const GenXPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { tenant, profile } = useMultiTenant();

  // Primary States
  const [selectedWaiter, setSelectedWaiter] = useState<string>('CASH / PARSAL');
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
  const { data: dbProducts = [] } = useQuery({
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
    refetchInterval: 3000,
  });

  const { data: dailyCount = 0 } = useQuery({
    queryKey: ['daily-order-count'],
    queryFn: () => api.orders.getDailyCount(),
  });

  // Effective products array: combines DB products + Default Rajput Products so master list is NEVER empty
  const products = useMemo(() => {
    if (!dbProducts || dbProducts.length === 0) {
      return RAJPUT_DEFAULT_PRODUCTS;
    }
    // Merge DB products with Rajput defaults if missing any SKUs
    const combined = [...dbProducts];
    RAJPUT_DEFAULT_PRODUCTS.forEach((def) => {
      if (!combined.some((p: any) => p.sku === def.sku || p.name === def.name)) {
        combined.push(def as any);
      }
    });
    return combined;
  }, [dbProducts]);

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

  const handleSeedRajputMenu = async () => {
    try {
      setIsSaving(true);
      await api.products.seedRajputRestaurant();
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Rajput Restaurant menu items synced! (64 items)', { duration: 2500 });
    } catch (err: any) {
      toast.error('Failed to sync menu: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Waiter Options
  const waiterOptions = useMemo(() => {
    const defaultWaiters = ['CASH / PARSAL', 'FAISAL BASHIR', 'WAITER 1', 'WAITER 2', 'ALI HYDER'];
    const staffNames = staffList.map((s: any) => (s.name || s.full_name || '').toUpperCase()).filter(Boolean);
    return Array.from(new Set([...defaultWaiters, ...staffNames]));
  }, [staffList]);

  // Running orders filtered by selected waiter
  const waiterRunningOrders = useMemo(() => {
    return ongoingOrders.filter((order: any) => {
      if (!selectedWaiter) return true;
      if (selectedWaiter === 'CASH / PARSAL') return true;
      const sName = (order.server_name || '').toUpperCase();
      const wName = selectedWaiter.toUpperCase();
      return sName === wName || sName.includes(wName) || wName.includes(sName);
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
      setSelectedWaiter(order.server_name.toUpperCase());
    }

    if (order.order_items && Array.isArray(order.order_items)) {
      const loadedItems: GenXBillItem[] = order.order_items.map((oi: any) => {
        const prod = oi.products || products.find((p: any) => p.id === oi.product_id || p.sku === oi.product_name) || {
          id: oi.product_id || crypto.randomUUID(),
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
      const idx = prev.findIndex((item) => item.id === product.id || item.sku === product.sku);
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
          id: product.id || crypto.randomUUID(),
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

  // Button 2: Close / Reset Bill
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
        await api.orders.updateItems(activeOrderId, orderItemsInsert);
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
        await api.orders.updateItems(activeOrderId, orderItemsInsert);
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
    ? String(ongoingOrders.find((o: any) => o.id === activeOrderId)?.daily_id || '02').padStart(2, '0')
    : String((dailyCount || 0) + 1).padStart(2, '0');

  const currentKOTDisplay = String((dailyCount || 0) + 100).padStart(3, '0');

  return (
    <MainLayout>
      <div className="flex h-full w-full flex-col bg-slate-200 dark:bg-slate-950 font-mono select-none overflow-hidden">
        
        {/* Main Content split into LEFT (~58%) and RIGHT (~42%) matching old POS screenshot */}
        <div className="flex flex-1 overflow-hidden p-2 gap-2">
          
          {/* LEFT BILLING TERMINAL PANEL */}
          <div className="flex flex-col w-[58%] h-full bg-slate-300 dark:bg-slate-900 border-2 border-slate-400 dark:border-slate-800 rounded-sm p-2 shadow-inner overflow-hidden gap-2">
            
            {/* Top Row 1: Bill # + Waiter Selector + Table Input */}
            <div className="flex items-center gap-3 bg-slate-200 dark:bg-slate-850 p-2 rounded border border-slate-400 dark:border-slate-700 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black uppercase text-slate-900 dark:text-slate-100">BILL # :</span>
                <span className="font-mono text-base font-black text-slate-950 dark:text-emerald-400 bg-white dark:bg-slate-950 px-3 py-0.5 rounded border border-slate-400 dark:border-slate-700">
                  {currentBillDisplay}
                </span>
              </div>

              {/* Waiter Selection List */}
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">WAITER :</span>
                <select
                  value={selectedWaiter}
                  onChange={(e) => {
                    setSelectedWaiter(e.target.value);
                    setActiveOrderId(null);
                    setBillItems([]);
                  }}
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
                <span className="text-xs font-bold uppercase text-slate-800 dark:text-slate-200">TABLE :</span>
                <input
                  type="text"
                  value={tableNo}
                  onChange={(e) => setTableNo(e.target.value)}
                  className="h-8 w-14 text-center text-xs font-black bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 border border-slate-400 dark:border-slate-700 rounded outline-hidden"
                />
              </div>
            </div>

            {/* Top Row 2: Waiter's Running Orders Bar (Highlighted Amber Bar as requested) */}
            {waiterRunningOrders.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-950/60 p-2 rounded border-2 border-amber-400 dark:border-amber-700 overflow-x-auto shadow-xs">
                <span className="text-xs font-black uppercase text-amber-950 dark:text-amber-300 shrink-0 flex items-center gap-1">
                  <Clock className="h-4 w-4 text-amber-700" /> RUNNING ({selectedWaiter}):
                </span>
                <div className="flex gap-2 overflow-x-auto">
                  {waiterRunningOrders.map((ro: any) => {
                    const isActive = activeOrderId === ro.id;
                    const roNo = ro.daily_id ? String(ro.daily_id).padStart(2, '0') : ro.id.slice(0, 4);
                    return (
                      <button
                        key={ro.id}
                        onClick={() => handleSelectRunningOrder(ro)}
                        className={`text-xs font-black px-3 py-1 rounded border-2 flex items-center gap-1.5 transition-all ${
                          isActive
                            ? 'bg-amber-600 text-white border-amber-800 shadow-md scale-105'
                            : 'bg-white dark:bg-slate-900 text-amber-950 dark:text-amber-200 border-amber-400 dark:border-amber-700 hover:bg-amber-200'
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
                  ITEM CODE (PRESS ENTER)
                </label>
                <input
                  ref={codeInputRef}
                  type="text"
                  placeholder="ENTER DISHCODE..."
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
                  QTY
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
                  PRICE (RS)
                </label>
                <div className="h-9 flex items-center justify-end px-2 font-mono text-sm font-black bg-slate-200 dark:bg-slate-900 text-slate-950 dark:text-emerald-400 border border-slate-400 dark:border-slate-700 rounded">
                  {previewPrice !== null ? `Rs ${previewPrice.toLocaleString()}` : '0'}
                </div>
              </div>
            </div>

            {/* Main Bill Grid Table matching exact columns */}
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

            {/* Bottom Controls Bar (4 Buttons: PRINT, REMOVE, KOT, CLOSE) + KOT No + TOTAL */}
            <div className="bg-slate-200 dark:bg-slate-850 p-2 rounded border border-slate-400 dark:border-slate-700 shadow-xs flex flex-col gap-2">
              
              {/* Row of 4 Action Buttons matching screenshot */}
              <div className="grid grid-cols-4 gap-2">
                
                {/* 1. PRINT Button */}
                <button
                  type="button"
                  onClick={handlePrintBillClick}
                  disabled={isSaving || billItems.length === 0}
                  className="h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-950 dark:text-slate-100 border-2 border-slate-400 dark:border-slate-600 rounded font-black text-xs uppercase shadow-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> PRINT
                </button>

                {/* 2. REMOVE Button */}
                <button
                  type="button"
                  onClick={handleRemoveClick}
                  disabled={billItems.length === 0}
                  className="h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-950 dark:text-slate-100 border-2 border-slate-400 dark:border-slate-600 rounded font-black text-xs uppercase shadow-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" /> REMOVE
                </button>

                {/* 3. KOT Button */}
                <button
                  type="button"
                  onClick={handleKOTClick}
                  disabled={isSaving || billItems.length === 0}
                  className="h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-950 dark:text-slate-100 border-2 border-slate-400 dark:border-slate-600 rounded font-black text-xs uppercase shadow-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <ChefHat className="h-4 w-4" /> KOT
                </button>

                {/* 4. CLOSE Button */}
                <button
                  type="button"
                  onClick={handleCloseClick}
                  className="h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-950 dark:text-slate-100 border-2 border-slate-400 dark:border-slate-600 rounded font-black text-xs uppercase shadow-sm flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <XSquare className="h-4 w-4" /> CLOSE
                </button>
              </div>

              {/* KOT No. & TOTAL Display Bar */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-slate-800 dark:text-slate-200">KOT NO. :</span>
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
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-emerald-400" /> ITEMS MASTER LIST
                </span>
                <button
                  type="button"
                  onClick={handleSeedRajputMenu}
                  className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded shadow-xs transition-colors flex items-center gap-1"
                  title="Click to sync Rajput Restaurant items list"
                >
                  <RefreshCw className="h-3 w-3" /> Sync Rajput Menu
                </button>
              </div>

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
                  {filteredProductsRight.map((prod: any, index: number) => (
                    <TableRow
                      key={prod.id || `${prod.sku}-${index}`}
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
                  ))}
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
