import { create } from 'zustand';

export interface Product {
  description?: string | null;
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  image: string | null;
  barcode?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  lineTotal: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  loyaltyPoints: number;
  totalSpent: number;
  visitCount: number;
}

interface CartState {
  items: CartItem[];
  customer: Customer | null;
  tableId: string | null; // Changed to string for UUID
  serverName: string | null; // Added serverName
  rider: { name: string } | null; // Added rider
  customerAddress: string | null; // Added customerAddress
  orderType: 'dine_in' | 'take_away' | 'delivery';
  discount: number;
  discountType: 'percentage' | 'fixed';
  serviceCharges: number;
  serviceChargesType: 'percentage' | 'fixed';
  taxRate: number;
  
  editingOrderId: string | null; // Track if we're editing an existing order
  
  // Computed values
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  serviceChargesAmount: number;
  deliveryFee: number;
  total: number;
  
  // Actions
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setCustomer: (customer: Customer | null) => void;
  setTableId: (tableId: string | null) => void; // Changed to string for UUID
  setServerName: (name: string | null) => void; // Added setServerName
  setRider: (rider: { name: string } | null) => void; // Added setRider
  setCustomerAddress: (address: string | null) => void; // Added setCustomerAddress
  setOrderType: (type: 'dine_in' | 'take_away' | 'delivery') => void;
  setDiscount: (discount: number, type: 'percentage' | 'fixed') => void;
  setServiceCharges: (amount: number, type: 'percentage' | 'fixed') => void;
  clearCart: () => void;
  calculateTotals: () => void;
  loadOrder: (order: any) => void;
  setTaxRate: (rate: number) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customer: null,
  tableId: null, // Initialize tableId
  serverName: null, // Initialize serverName
  rider: null, // Initialize rider
  customerAddress: null, // Initialize customerAddress
  orderType: 'dine_in',
  discount: 0,
  discountType: 'percentage',
  serviceCharges: 0,
  serviceChargesType: 'percentage',
  taxRate: 0, // No tax
  editingOrderId: null,
  
  subtotal: 0,
  taxAmount: 0,
  discountAmount: 0,
  serviceChargesAmount: 0,
  deliveryFee: 0,
  total: 0,
  
  setTaxRate: (rate) => {
    set({ taxRate: rate });
    get().calculateTotals();
  },
  
  addItem: (product) => {
    set((state) => {
      const existingItem = state.items.find(item => item.product.id === product.id);
      
      let newItems: CartItem[];
      if (existingItem) {
        newItems = state.items.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, lineTotal: (item.quantity + 1) * item.product.price }
            : item
        );
      } else {
        newItems = [...state.items, { product, quantity: 1, lineTotal: product.price }];
      }
      
      const subtotal = newItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const discountAmount = state.discountType === 'percentage' 
        ? subtotal * (state.discount / 100) 
        : state.discount;
      const serviceChargesAmount = state.serviceChargesType === 'percentage'
        ? subtotal * (state.serviceCharges / 100)
        : state.serviceCharges;
      const taxAmount = (subtotal - discountAmount + serviceChargesAmount) * (state.taxRate / 100);
      const deliveryFee = state.orderType === 'delivery' ? 50 : 0;
      const total = subtotal - discountAmount + serviceChargesAmount + taxAmount + deliveryFee;
      
      return { items: newItems, subtotal, discountAmount, serviceChargesAmount, taxAmount, deliveryFee, total };
    });
  },
  
  removeItem: (productId) => {
    set((state) => {
      const newItems = state.items.filter(item => item.product.id !== productId);
      const subtotal = newItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const discountAmount = state.discountType === 'percentage' 
        ? subtotal * (state.discount / 100) 
        : state.discount;
      const serviceChargesAmount = state.serviceChargesType === 'percentage'
        ? subtotal * (state.serviceCharges / 100)
        : state.serviceCharges;
      const taxAmount = (subtotal - discountAmount + serviceChargesAmount) * (state.taxRate / 100);
      const deliveryFee = state.orderType === 'delivery' ? 50 : 0;
      const total = subtotal - discountAmount + serviceChargesAmount + taxAmount + deliveryFee;
      
      return { items: newItems, subtotal, discountAmount, serviceChargesAmount, taxAmount, deliveryFee, total };
    });
  },
  
  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    
    set((state) => {
      const newItems = state.items.map(item =>
        item.product.id === productId
          ? { ...item, quantity, lineTotal: quantity * item.product.price }
          : item
      );
      
      const subtotal = newItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const discountAmount = state.discountType === 'percentage' 
        ? subtotal * (state.discount / 100) 
        : state.discount;
      const serviceChargesAmount = state.serviceChargesType === 'percentage'
        ? subtotal * (state.serviceCharges / 100)
        : state.serviceCharges;
      const taxAmount = (subtotal - discountAmount + serviceChargesAmount) * (state.taxRate / 100);
      const deliveryFee = state.orderType === 'delivery' ? 50 : 0;
      const total = subtotal - discountAmount + serviceChargesAmount + taxAmount + deliveryFee;
      
      return { items: newItems, subtotal, discountAmount, serviceChargesAmount, taxAmount, deliveryFee, total };
    });
  },
  
  setCustomer: (customer) => set({ customer }),
  setTableId: (tableId) => set({ tableId }), // Added implementation
  setServerName: (serverName) => set({ serverName }), // Added setServerName implementation
  setRider: (rider) => set({ rider }), // Added setRider implementation
  setCustomerAddress: (customerAddress) => set({ customerAddress }), // Added setCustomerAddress implementation
  setOrderType: (orderType) => {
    set((state) => {
      const deliveryFee = orderType === 'delivery' ? 50 : 0;
      const total = state.subtotal - state.discountAmount + state.serviceChargesAmount + state.taxAmount + deliveryFee;
      
      // Clear relevant fields when switching types
      return { 
        orderType, 
        deliveryFee, 
        total,
        tableId: orderType === 'dine_in' ? state.tableId : null,
        rider: orderType === 'delivery' ? state.rider : null,
        customerAddress: orderType === 'delivery' ? state.customerAddress : null
      };
    });
  },

  setDiscount: (discount, type) => {
    set((state) => {
      const discountAmount = type === 'percentage' 
        ? state.subtotal * (discount / 100) 
        : discount;
      const taxAmount = (state.subtotal - discountAmount + state.serviceChargesAmount) * (state.taxRate / 100);
      const deliveryFee = state.orderType === 'delivery' ? 50 : 0;
      const total = state.subtotal - discountAmount + state.serviceChargesAmount + taxAmount + deliveryFee;
      
      return { discount, discountType: type, discountAmount, taxAmount, deliveryFee, total };
    });
  },

  setServiceCharges: (amount, type) => {
    set((state) => {
      const serviceChargesAmount = type === 'percentage'
        ? state.subtotal * (amount / 100)
        : amount;
      const taxAmount = (state.subtotal - state.discountAmount + serviceChargesAmount) * (state.taxRate / 100);
      const deliveryFee = state.orderType === 'delivery' ? 50 : 0;
      const total = state.subtotal - state.discountAmount + serviceChargesAmount + taxAmount + deliveryFee;
      
      return { serviceCharges: amount, serviceChargesType: type, serviceChargesAmount, taxAmount, deliveryFee, total };
    });
  },
  
  clearCart: () => set({
    items: [],
    customer: null,
    tableId: null, // Clear tableId
    rider: null, // Clear rider
    customerAddress: null, // Clear customerAddress
    discount: 0,
    discountType: 'percentage',
    serviceCharges: 0,
    serviceChargesType: 'percentage',
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    serviceChargesAmount: 0,
    deliveryFee: 0,
    total: 0,
    editingOrderId: null,
  }),
  
  loadOrder: (order) => {
    const items = order.order_items.map((item: any) => ({
      product: {
        id: item.product_id || `virtual-${Date.now()}-${Math.random()}`,
        name: item.products?.name || item.product_name || 'Unknown Product',
        price: item.price,
        sku: item.products?.sku || '',
        cost: item.products?.cost || 0,
        stock: item.products?.stock || 0,
        category: item.products?.category || item.product_category || 'General',
        image: item.products?.image || '🍽️',
        description: item.products?.description || ''
      },
      quantity: item.quantity,
      lineTotal: item.price * item.quantity
    }));

    const customer = order.customers ? {
      id: order.customer_id?.toString() || '',
      name: order.customers.name,
      phone: order.customers.phone || '',
      email: order.customers.email || '',
      loyaltyPoints: order.customers.loyalty_points || 0,
      totalSpent: order.customers.total_spent || 0,
      visitCount: order.customers.visit_count || 0
    } : null;

    set({
      items,
      customer,
      tableId: order.table_id,
      orderType: order.order_type as any,
      editingOrderId: order.id,
      discount: 0, // Assuming no discount for now or we could load it if it's in DB
      discountType: 'percentage'
    });
    
    get().calculateTotals();
  },
  
  calculateTotals: () => {
    set((state) => {
      const subtotal = state.items.reduce((sum, item) => sum + item.lineTotal, 0);
      const discountAmount = state.discountType === 'percentage' 
        ? subtotal * (state.discount / 100) 
        : state.discount;
      const serviceChargesAmount = state.serviceChargesType === 'percentage'
        ? subtotal * (state.serviceCharges / 100)
        : state.serviceCharges;
      const taxAmount = (subtotal - discountAmount + serviceChargesAmount) * (state.taxRate / 100);
      const deliveryFee = state.orderType === 'delivery' ? 30 : 0;
      const total = subtotal - discountAmount + serviceChargesAmount + taxAmount + deliveryFee;
      
      return { subtotal, discountAmount, serviceChargesAmount, taxAmount, deliveryFee, total };
    });
  },
}));
