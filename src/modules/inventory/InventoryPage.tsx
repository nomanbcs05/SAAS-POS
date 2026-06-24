import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    inventoryApi, 
    probeInventorySchema, 
    InventoryItem, 
    InventoryVendor, 
    InventoryPurchase, 
    InventoryPurchaseItem, 
    InventoryRecipe, 
    InventoryAdjustment 
} from './inventoryApi';
import { api } from '@/services/api';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';
import { 
    Plus, 
    Edit, 
    Trash2, 
    Search, 
    AlertCircle, 
    Check, 
    CheckCircle2, 
    Database, 
    ExternalLink, 
    Boxes, 
    Truck, 
    BookOpen, 
    BarChart3, 
    Calendar, 
    DollarSign, 
    Loader2, 
    TrendingUp, 
    AlertTriangle 
} from 'lucide-react';

export default function InventoryPage() {
    const { tenant } = useMultiTenant();
    const queryClient = useQueryClient();

    // Tabs
    const [activeTab, setActiveTab] = useState('items');

    // Modals
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
    const [editingVendor, setEditingVendor] = useState<InventoryVendor | null>(null);
    const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
    const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);

    // Form states - Item
    const [itemName, setItemName] = useState('');
    const [itemSku, setItemSku] = useState('');
    const [itemCategory, setItemCategory] = useState<'raw_material' | 'consumable' | 'packaging'>('raw_material');
    const [itemUnit, setItemUnit] = useState('kg');
    const [itemMinStock, setItemMinStock] = useState('5');
    const [itemCostPrice, setItemCostPrice] = useState('0');

    // Form states - Vendor
    const [vendorName, setVendorName] = useState('');
    const [vendorContact, setVendorContact] = useState('');
    const [vendorPhone, setVendorPhone] = useState('');
    const [vendorEmail, setVendorEmail] = useState('');
    const [vendorAddress, setVendorAddress] = useState('');

    // Form states - Purchase Invoice
    const [purchaseInvoice, setPurchaseInvoice] = useState('');
    const [purchaseVendorId, setPurchaseVendorId] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [purchaseRows, setPurchaseRows] = useState<Array<{ item_id: string; quantity: number; unit_price: number }>>([
        { item_id: '', quantity: 1, unit_price: 0 }
    ]);

    // Form states - Stock Adjustment
    const [adjType, setAdjType] = useState<'manual_adjustment' | 'waste' | 'expired'>('manual_adjustment');
    const [adjQuantity, setAdjQuantity] = useState('');
    const [adjReason, setAdjReason] = useState('');

    // Recipe Management state
    const [recipeProductId, setRecipeProductId] = useState('');
    const [recipeRows, setRecipeRows] = useState<Array<{ item_id: string; quantity: number }>>([]);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // ---------------------------------------------------------------------------
    // Database check query
    // ---------------------------------------------------------------------------
    const { data: schemaReady = false, isLoading: isCheckingSchema } = useQuery({
        queryKey: ['inventory-schema-probe'],
        queryFn: probeInventorySchema,
        retry: 0,
        refetchOnWindowFocus: false,
    });

    // ---------------------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------------------
    const { data: itemsList = [], isLoading: isLoadingItems } = useQuery({
        queryKey: ['inventory-items', tenant?.id],
        queryFn: () => inventoryApi.items.getAll(tenant?.id),
        enabled: !isCheckingSchema,
    });

    const { data: vendorsList = [], isLoading: isLoadingVendors } = useQuery({
        queryKey: ['inventory-vendors', tenant?.id],
        queryFn: () => inventoryApi.vendors.getAll(tenant?.id),
        enabled: !isCheckingSchema && (activeTab === 'purchases' || activeTab === 'vendors'),
    });

    const { data: purchasesList = [], isLoading: isLoadingPurchases } = useQuery({
        queryKey: ['inventory-purchases', tenant?.id],
        queryFn: () => inventoryApi.purchases.getAll(tenant?.id),
        enabled: !isCheckingSchema && activeTab === 'purchases',
    });

    const { data: recipesList = [], isLoading: isLoadingRecipes } = useQuery({
        queryKey: ['inventory-recipes', tenant?.id],
        queryFn: () => inventoryApi.recipes.getAll(tenant?.id),
        enabled: !isCheckingSchema && activeTab === 'recipes',
    });

    const { data: adjustmentsList = [], isLoading: isLoadingAdjustments } = useQuery({
        queryKey: ['inventory-adjustments', tenant?.id],
        queryFn: () => inventoryApi.adjustments.getAll(tenant?.id),
        enabled: !isCheckingSchema && activeTab === 'reports',
    });

    const { data: productsList = [] } = useQuery({
        queryKey: ['products'],
        queryFn: () => api.products.getAll(),
        enabled: !isCheckingSchema && activeTab === 'recipes',
    });

    const { data: completedOrders = [] } = useQuery({
        queryKey: ['orders-completed'],
        queryFn: async () => {
            const all = await api.orders.getAll();
            return all.filter((o: any) => o.status === 'completed');
        },
        enabled: !isCheckingSchema && activeTab === 'reports',
    });

    // ---------------------------------------------------------------------------
    // Mutations
    // ---------------------------------------------------------------------------
    const saveItemMutation = useMutation({
        mutationFn: (item: Omit<InventoryItem, 'id' | 'created_at'>) => 
            editingItem 
                ? inventoryApi.items.update(editingItem.id, item) 
                : inventoryApi.items.create({ ...item, tenant_id: tenant?.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            toast.success(editingItem ? 'Item updated successfully' : 'Item added successfully');
            setIsItemModalOpen(false);
            resetItemForm();
        },
        onError: (err: any) => toast.error('Error saving item: ' + err.message)
    });

    const deleteItemMutation = useMutation({
        mutationFn: (id: string) => inventoryApi.items.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            toast.success('Item deleted successfully');
        },
        onError: (err: any) => toast.error('Error deleting item: ' + err.message)
    });

    const saveVendorMutation = useMutation({
        mutationFn: (vendor: Omit<InventoryVendor, 'id' | 'created_at'>) => 
            editingVendor 
                ? inventoryApi.vendors.update(editingVendor.id, vendor) 
                : inventoryApi.vendors.create({ ...vendor, tenant_id: tenant?.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-vendors'] });
            toast.success(editingVendor ? 'Supplier updated successfully' : 'Supplier added successfully');
            setIsVendorModalOpen(false);
            resetVendorForm();
        },
        onError: (err: any) => toast.error('Error saving vendor: ' + err.message)
    });

    const deleteVendorMutation = useMutation({
        mutationFn: (id: string) => inventoryApi.vendors.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-vendors'] });
            toast.success('Supplier deleted successfully');
        },
        onError: (err: any) => toast.error('Error deleting supplier: ' + err.message)
    });

    const savePurchaseMutation = useMutation({
        mutationFn: (data: { purchase: Omit<InventoryPurchase, 'id' | 'created_at' | 'status'>, rows: typeof purchaseRows }) => {
            const total = data.rows.reduce((sum, r) => sum + (Number(r.quantity) * Number(r.unit_price)), 0);
            const formattedRows = data.rows.map(r => ({
                item_id: r.item_id,
                quantity: Number(r.quantity),
                unit_price: Number(r.unit_price),
                total_price: Number(r.quantity) * Number(r.unit_price)
            }));
            return inventoryApi.purchases.create(
                { ...data.purchase, total_amount: total, tenant_id: tenant?.id },
                formattedRows
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-purchases'] });
            toast.success('Purchase invoice generated as Pending.');
            setIsPurchaseModalOpen(false);
            resetPurchaseForm();
        },
        onError: (err: any) => toast.error('Error creating purchase: ' + err.message)
    });

    const approvePurchaseMutation = useMutation({
        mutationFn: (id: string) => inventoryApi.purchases.approve(id, 'POS Admin'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-purchases'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            toast.success('Purchase invoice approved. Stock replenished!');
        },
        onError: (err: any) => toast.error('Error approving purchase: ' + err.message)
    });

    const adjustStockMutation = useMutation({
        mutationFn: (adj: Omit<InventoryAdjustment, 'id' | 'created_at'>) => inventoryApi.items.adjustStock(adj),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
            toast.success('Stock adjustment logged successfully');
            setIsAdjustmentModalOpen(false);
            resetAdjustmentForm();
        },
        onError: (err: any) => toast.error('Error adjusting stock: ' + err.message)
    });

    const saveRecipeMutation = useMutation({
        mutationFn: (data: { productId: string; rows: Array<{ item_id: string; quantity: number }> }) => 
            inventoryApi.recipes.saveRecipeItems(data.productId, data.rows, tenant?.id || undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-recipes'] });
            toast.success('Recipe configured successfully');
        },
        onError: (err: any) => toast.error('Error saving recipe: ' + err.message)
    });

    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------
    const resetItemForm = () => {
        setEditingItem(null);
        setItemName('');
        setItemSku('');
        setItemCategory('raw_material');
        setItemUnit('kg');
        setItemMinStock('5');
        setItemCostPrice('0');
    };

    const handleOpenAddItem = () => {
        resetItemForm();
        setIsItemModalOpen(true);
    };

    const handleOpenEditItem = (item: InventoryItem) => {
        setEditingItem(item);
        setItemName(item.name);
        setItemSku(item.sku || '');
        setItemCategory(item.category);
        setItemUnit(item.unit);
        setItemMinStock(String(item.min_stock));
        setItemCostPrice(String(item.cost_price));
        setIsItemModalOpen(true);
    };

    const handleSubmitItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!itemName || !itemUnit) {
            toast.error('Item name and Unit are required');
            return;
        }
        saveItemMutation.mutate({
            name: itemName,
            sku: itemSku || undefined,
            category: itemCategory,
            unit: itemUnit,
            min_stock: Number(itemMinStock) || 0,
            cost_price: Number(itemCostPrice) || 0,
            current_stock: editingItem ? editingItem.current_stock : 0
        });
    };

    const resetVendorForm = () => {
        setEditingVendor(null);
        setVendorName('');
        setVendorContact('');
        setVendorPhone('');
        setVendorEmail('');
        setVendorAddress('');
    };

    const handleOpenAddVendor = () => {
        resetVendorForm();
        setIsVendorModalOpen(true);
    };

    const handleOpenEditVendor = (vendor: InventoryVendor) => {
        setEditingVendor(vendor);
        setVendorName(vendor.name);
        setVendorContact(vendor.contact_person || '');
        setVendorPhone(vendor.phone || '');
        setVendorEmail(vendor.email || '');
        setVendorAddress(vendor.address || '');
        setIsVendorModalOpen(true);
    };

    const handleSubmitVendor = (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendorName) {
            toast.error('Supplier name is required');
            return;
        }
        saveVendorMutation.mutate({
            name: vendorName,
            contact_person: vendorContact || undefined,
            phone: vendorPhone || undefined,
            email: vendorEmail || undefined,
            address: vendorAddress || undefined
        });
    };

    const resetPurchaseForm = () => {
        setPurchaseInvoice('');
        setPurchaseVendorId('');
        setPurchaseDate(new Date().toISOString().split('T')[0]);
        setPurchaseRows([{ item_id: '', quantity: 1, unit_price: 0 }]);
    };

    const handleAddPurchaseRow = () => {
        setPurchaseRows([...purchaseRows, { item_id: '', quantity: 1, unit_price: 0 }]);
    };

    const handleRemovePurchaseRow = (index: number) => {
        setPurchaseRows(purchaseRows.filter((_, i) => i !== index));
    };

    const handlePurchaseRowChange = (index: number, field: string, val: string | number) => {
        const rows = [...purchaseRows];
        (rows[index] as any)[field] = val;
        setPurchaseRows(rows);
    };

    const handleSubmitPurchase = (e: React.FormEvent) => {
        e.preventDefault();
        if (!purchaseInvoice || !purchaseVendorId) {
            toast.error('Invoice number and Supplier are required');
            return;
        }
        const invalidRow = purchaseRows.some(r => !r.item_id || Number(r.quantity) <= 0 || Number(r.unit_price) < 0);
        if (invalidRow) {
            toast.error('Please complete all purchase invoice items with valid quantities/prices.');
            return;
        }
        savePurchaseMutation.mutate({
            purchase: {
                invoice_number: purchaseInvoice,
                vendor_id: purchaseVendorId,
                purchase_date: purchaseDate,
                total_amount: 0
            },
            rows: purchaseRows
        });
    };

    const resetAdjustmentForm = () => {
        setAdjustingItem(null);
        setAdjType('manual_adjustment');
        setAdjQuantity('');
        setAdjReason('');
    };

    const handleOpenAdjustment = (item: InventoryItem) => {
        resetAdjustmentForm();
        setAdjustingItem(item);
        setIsAdjustmentModalOpen(true);
    };

    const handleSubmitAdjustment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustingItem || !adjQuantity) {
            toast.error('Quantity is required');
            return;
        }
        const qty = Number(adjQuantity);
        if (isNaN(qty) || qty === 0) {
            toast.error('Quantity must be a non-zero number');
            return;
        }
        // Force negative value for waste/expired logs
        const finalQty = (adjType === 'waste' || adjType === 'expired') ? -Math.abs(qty) : qty;
        adjustStockMutation.mutate({
            item_id: adjustingItem.id,
            type: adjType,
            quantity: finalQty,
            reason: adjReason || undefined,
            created_by: 'POS Admin',
            tenant_id: tenant?.id || null
        });
    };

    // Recipe handlers
    const handleLoadRecipe = (prodId: string) => {
        setRecipeProductId(prodId);
        const filtered = recipesList.filter(r => r.product_id === prodId);
        if (filtered.length > 0) {
            setRecipeRows(filtered.map(f => ({ item_id: f.item_id, quantity: f.quantity })));
        } else {
            setRecipeRows([{ item_id: '', quantity: 0 }]);
        }
    };

    const handleAddRecipeRow = () => {
        setRecipeRows([...recipeRows, { item_id: '', quantity: 0 }]);
    };

    const handleRemoveRecipeRow = (index: number) => {
        setRecipeRows(recipeRows.filter((_, i) => i !== index));
    };

    const handleRecipeRowChange = (index: number, field: string, val: string | number) => {
        const rows = [...recipeRows];
        (rows[index] as any)[field] = val;
        setRecipeRows(rows);
    };

    const handleSubmitRecipe = (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipeProductId) {
            toast.error('Please select a menu product');
            return;
        }
        const validRows = recipeRows.filter(r => r.item_id && Number(r.quantity) > 0);
        saveRecipeMutation.mutate({
            productId: recipeProductId,
            rows: validRows
        });
    };

    // ---------------------------------------------------------------------------
    // Filtered data & calculations
    // ---------------------------------------------------------------------------
    const filteredItems = itemsList.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const stockAlerts = itemsList.filter(i => i.current_stock <= i.min_stock);

    const stockValuation = itemsList.reduce((sum, item) => sum + (item.current_stock * item.cost_price), 0);

    const totalWasteCost = adjustmentsList
        .filter(a => a.type === 'waste' || a.type === 'expired')
        .reduce((sum, adj) => {
            const item = itemsList.find(i => i.id === adj.item_id);
            const cost = item ? Number(item.cost_price) : 0;
            return sum + (Math.abs(adj.quantity) * cost);
        }, 0);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <MainLayout>
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
                <header className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                            <Boxes className="h-6 w-6 text-primary" />
                            Inventory System
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium">Track raw ingredients, recipe portions, invoices, and waste audits.</p>
                    </div>

                    <div className="flex gap-2">
                        {activeTab === 'items' && (
                            <Button onClick={handleOpenAddItem} className="gap-2 font-semibold">
                                <Plus className="h-4 w-4" /> Add Item
                            </Button>
                        )}
                        {activeTab === 'vendors' && (
                            <Button onClick={handleOpenAddVendor} className="gap-2 font-semibold">
                                <Plus className="h-4 w-4" /> Add Supplier
                            </Button>
                        )}
                        {activeTab === 'purchases' && (
                            <Button onClick={() => setIsPurchaseModalOpen(true)} className="gap-2 font-semibold">
                                <Plus className="h-4 w-4" /> Log Invoice
                            </Button>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-6">
                    {/* Database Check Alert */}
                    {!isCheckingSchema && !schemaReady && (
                        <Card className="border-amber-200 bg-amber-50/50 shadow-sm mb-6">
                            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-amber-900 text-sm">Database Sync Disabled (Local Storage Mode)</h4>
                                        <p className="text-xs text-amber-700 mt-1 max-w-2xl font-medium">
                                            The inventory database tables were not found in your Supabase project. The application is running in local storage mode. Data is saved locally on this browser.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold gap-1.5"
                                        onClick={() => setIsSetupDialogOpen(true)}
                                    >
                                        <Database className="h-3.5 w-3.5" /> Run One-Time Setup
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Tabs value={activeTab} onValueChange={(tab) => {
                        setActiveTab(tab);
                        setSearchQuery('');
                    }} className="space-y-6">
                        <TabsList className="bg-white border shadow-sm grid grid-cols-6 max-w-4xl h-11 p-1">
                            <TabsTrigger value="items" className="font-bold flex gap-1.5 text-xs">
                                <Boxes className="h-4 w-4" /> Ingredients
                            </TabsTrigger>
                            <TabsTrigger value="stock" className="font-bold flex gap-1.5 text-xs">
                                <TrendingUp className="h-4 w-4" /> Stock Control
                            </TabsTrigger>
                            <TabsTrigger value="purchases" className="font-bold flex gap-1.5 text-xs">
                                <Truck className="h-4 w-4" /> Purchases
                            </TabsTrigger>
                            <TabsTrigger value="recipes" className="font-bold flex gap-1.5 text-xs">
                                <BookOpen className="h-4 w-4" /> Recipes (BOM)
                            </TabsTrigger>
                            <TabsTrigger value="vendors" className="font-bold flex gap-1.5 text-xs">
                                <Truck className="h-4 w-4" /> Suppliers
                            </TabsTrigger>
                            <TabsTrigger value="reports" className="font-bold flex gap-1.5 text-xs">
                                <BarChart3 className="h-4 w-4" /> Reports
                            </TabsTrigger>
                        </TabsList>

                        {/* ==================================================== */}
                        {/* TAB 1: INVENTORY ITEMS */}
                        {/* ==================================================== */}
                        <TabsContent value="items" className="m-0 space-y-4">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className="pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <CardTitle>Ingredients Directory</CardTitle>
                                        <CardDescription>Setup raw ingredients and specify low-stock boundaries</CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                            <SelectTrigger className="w-40 bg-white">
                                                <SelectValue placeholder="Category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Categories</SelectItem>
                                                <SelectItem value="raw_material">Raw Materials</SelectItem>
                                                <SelectItem value="consumable">Consumables</SelectItem>
                                                <SelectItem value="packaging">Packaging</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="relative w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                placeholder="Search by name, SKU..." 
                                                className="pl-9 bg-white"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingItems ? (
                                        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                    ) : filteredItems.length === 0 ? (
                                        <div className="text-center py-12 border border-dashed rounded-lg bg-slate-50">
                                            <Boxes className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                            <h3 className="text-lg font-bold text-slate-700">No Ingredients Configured</h3>
                                            <p className="text-sm text-slate-500">Add raw ingredients to start tracking inventory.</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-md border overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">Name</th>
                                                        <th className="px-4 py-3">SKU</th>
                                                        <th className="px-4 py-3">Category</th>
                                                        <th className="px-4 py-3">Unit</th>
                                                        <th className="px-4 py-3">Min Level</th>
                                                        <th className="px-4 py-3">WAC Cost</th>
                                                        <th className="px-4 py-3 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700">
                                                    {filteredItems.map(item => (
                                                        <tr key={item.id} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 font-bold text-slate-900">{item.name}</td>
                                                            <td className="px-4 py-3 text-xs font-mono">{item.sku || '-'}</td>
                                                            <td className="px-4 py-3 capitalize">{item.category.replace('_', ' ')}</td>
                                                            <td className="px-4 py-3">{item.unit}</td>
                                                            <td className="px-4 py-3 font-bold text-slate-500">{item.min_stock} {item.unit}</td>
                                                            <td className="px-4 py-3 font-bold text-emerald-700">₹{item.cost_price.toFixed(2)}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleOpenEditItem(item)}>
                                                                        <Edit className="h-4.5 w-4.5 text-slate-500" />
                                                                    </Button>
                                                                    <Button size="icon" variant="outline" className="h-8 w-8 text-rose-600 hover:text-rose-700" onClick={() => { if(confirm('Delete this item?')) deleteItemMutation.mutate(item.id); }}>
                                                                        <Trash2 className="h-4.5 w-4.5" />
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ==================================================== */}
                        {/* TAB 2: STOCK CONTROL */}
                        {/* ==================================================== */}
                        <TabsContent value="stock" className="m-0 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="border-slate-200">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Value</p>
                                            <h3 className="text-2xl font-black text-slate-800 mt-1">₹{stockValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h3>
                                        </div>
                                        <div className="p-3 rounded-full bg-emerald-50 text-emerald-600"><DollarSign className="h-6 w-6" /></div>
                                    </CardContent>
                                </Card>
                                <Card className="border-slate-200">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Low Stock Items</p>
                                            <h3 className={`text-2xl font-black mt-1 ${stockAlerts.length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{stockAlerts.length}</h3>
                                        </div>
                                        <div className={`p-3 rounded-full ${stockAlerts.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}><AlertTriangle className="h-6 w-6" /></div>
                                    </CardContent>
                                </Card>
                                <Card className="border-slate-200">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Ingredient Count</p>
                                            <h3 className="text-2xl font-black text-slate-800 mt-1">{itemsList.length}</h3>
                                        </div>
                                        <div className="p-3 rounded-full bg-blue-50 text-blue-600"><Boxes className="h-6 w-6" /></div>
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="shadow-sm border-slate-200">
                                <CardHeader className="pb-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div>
                                            <CardTitle>Inventory Stocks</CardTitle>
                                            <CardDescription>View current stocks and apply manual adjustments/wastage</CardDescription>
                                        </div>
                                        <div className="relative w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                placeholder="Search stock..." 
                                                className="pl-9 bg-white"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingItems ? (
                                        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                    ) : (
                                        <div className="rounded-md border overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">Ingredient</th>
                                                        <th className="px-4 py-3">Category</th>
                                                        <th className="px-4 py-3">Status</th>
                                                        <th className="px-4 py-3">Remaining Stock</th>
                                                        <th className="px-4 py-3">Portion Cost</th>
                                                        <th className="px-4 py-3">Stock Value</th>
                                                        <th className="px-4 py-3 text-right">Audit</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700">
                                                    {itemsList.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())).map(item => {
                                                        const isLow = item.current_stock <= item.min_stock;
                                                        const isOutOfStock = item.current_stock <= 0;
                                                        return (
                                                            <tr key={item.id} className="hover:bg-slate-50/50">
                                                                <td className="px-4 py-3 font-bold text-slate-900">{item.name}</td>
                                                                <td className="px-4 py-3 capitalize">{item.category.replace('_', ' ')}</td>
                                                                <td className="px-4 py-3">
                                                                    {isOutOfStock ? (
                                                                        <Badge variant="destructive" className="font-semibold text-[10px]">Out Of Stock</Badge>
                                                                    ) : isLow ? (
                                                                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold text-[10px]">Low Stock</Badge>
                                                                    ) : (
                                                                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-[10px]">Healthy</Badge>
                                                                    )}
                                                                </td>
                                                                <td className={`px-4 py-3 font-black ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>
                                                                    {item.current_stock} {item.unit}
                                                                </td>
                                                                <td className="px-4 py-3">₹{item.cost_price.toFixed(2)}</td>
                                                                <td className="px-4 py-3 font-black text-slate-900">₹{(item.current_stock * item.cost_price).toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <Button size="sm" variant="outline" className="font-bold text-xs h-8 border-slate-300" onClick={() => handleOpenAdjustment(item)}>
                                                                        Adjust Stock
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ==================================================== */}
                        {/* TAB 3: PURCHASES */}
                        {/* ==================================================== */}
                        <TabsContent value="purchases" className="m-0 space-y-4">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle>Purchase Invoices</CardTitle>
                                    <CardDescription>Log new purchases or approve pending items to replenish inventory stock</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingPurchases ? (
                                        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                    ) : purchasesList.length === 0 ? (
                                        <div className="text-center py-12 border border-dashed rounded-lg bg-slate-50">
                                            <Truck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                            <h3 className="text-lg font-bold text-slate-700">No Purchase Invoices</h3>
                                            <p className="text-sm text-slate-500">Record supplier purchases to update ingredient stock.</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-md border overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">Invoice Number</th>
                                                        <th className="px-4 py-3">Supplier</th>
                                                        <th className="px-4 py-3">Date</th>
                                                        <th className="px-4 py-3">Total Cost</th>
                                                        <th className="px-4 py-3">Status</th>
                                                        <th className="px-4 py-3 text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700">
                                                    {purchasesList.map(p => (
                                                        <tr key={p.id} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 font-bold text-slate-900">{p.invoice_number}</td>
                                                            <td className="px-4 py-3">{p.vendor_name}</td>
                                                            <td className="px-4 py-3">{p.purchase_date}</td>
                                                            <td className="px-4 py-3 font-bold">₹{p.total_amount.toFixed(2)}</td>
                                                            <td className="px-4 py-3">
                                                                {p.status === 'Approved' ? (
                                                                    <Badge className="bg-emerald-500 text-white font-semibold text-[10px] flex items-center gap-1 w-max">
                                                                        <Check className="h-3 w-3" /> Approved
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge className="bg-amber-500 text-white font-semibold text-[10px] w-max">
                                                                        Pending Approval
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                {p.status === 'Pending' && (
                                                                    <Button 
                                                                        size="sm" 
                                                                        className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                                                                        onClick={() => { if(confirm('Approve purchase? This will add quantities to stock.')) approvePurchaseMutation.mutate(p.id); }}
                                                                        disabled={approvePurchaseMutation.isPending}
                                                                    >
                                                                        Approve
                                                                    </Button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ==================================================== */}
                        {/* TAB 4: RECIPES / BOM */}
                        {/* ==================================================== */}
                        <TabsContent value="recipes" className="m-0 space-y-4">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle>Bill of Materials (BOM) System</CardTitle>
                                    <CardDescription>Link raw ingredients and portion weights to POS menu products for automatic sales deduction</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Products List Sidebar */}
                                        <div className="border rounded-md p-4 bg-white h-[500px] flex flex-col">
                                            <h4 className="font-bold text-slate-800 border-b pb-2 mb-3 uppercase text-xs tracking-wider">Select Product</h4>
                                            <div className="flex-1 overflow-auto space-y-1 pr-1">
                                                {productsList.map(prod => (
                                                    <button
                                                        key={prod.id}
                                                        className={`w-full text-left px-3 py-2.5 rounded-md text-xs font-semibold flex items-center justify-between transition-colors ${
                                                            recipeProductId === prod.id 
                                                                ? 'bg-primary text-white shadow-sm' 
                                                                : 'hover:bg-slate-100 text-slate-700'
                                                        }`}
                                                        onClick={() => handleLoadRecipe(prod.id)}
                                                    >
                                                        <span>{prod.name}</span>
                                                        <Badge variant="outline" className={`font-mono text-[9px] ${recipeProductId === prod.id ? 'border-white text-white' : 'border-slate-300'}`}>
                                                            ₹{prod.price}
                                                        </Badge>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Recipe Details Editor */}
                                        <div className="col-span-2 border rounded-md p-6 bg-white flex flex-col h-[500px]">
                                            {recipeProductId ? (
                                                <form onSubmit={handleSubmitRecipe} className="flex flex-col h-full">
                                                    <div className="flex items-center justify-between border-b pb-3 mb-4">
                                                        <div>
                                                            <h3 className="font-bold text-slate-900 text-sm">
                                                                Configuring recipe for: {productsList.find(p => p.id === recipeProductId)?.name}
                                                            </h3>
                                                            <p className="text-xs text-muted-foreground font-medium mt-0.5">Specify ingredients and exact portions consumed per sale.</p>
                                                        </div>
                                                        <Button type="button" size="sm" variant="outline" className="font-semibold gap-1.5" onClick={handleAddRecipeRow}>
                                                            <Plus className="h-4 w-4" /> Add Ingredient
                                                        </Button>
                                                    </div>

                                                    <div className="flex-1 overflow-auto space-y-4 pr-1">
                                                        {recipeRows.length === 0 ? (
                                                            <div className="text-center py-12 text-slate-500 text-xs">
                                                                No ingredients added to this recipe yet.
                                                            </div>
                                                        ) : (
                                                            recipeRows.map((row, index) => (
                                                                <div key={index} className="flex items-center gap-4">
                                                                    <div className="flex-1">
                                                                        <Label className="text-xs font-bold text-slate-700">Ingredient</Label>
                                                                        <Select 
                                                                            value={row.item_id} 
                                                                            onValueChange={(v) => handleRecipeRowChange(index, 'item_id', v)}
                                                                        >
                                                                            <SelectTrigger className="w-full bg-slate-50 mt-1">
                                                                                <SelectValue placeholder="Select Ingredient" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {itemsList.map(item => (
                                                                                    <SelectItem key={item.id} value={item.id}>
                                                                                        {item.name} ({item.unit})
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                    <div className="w-32">
                                                                        <Label className="text-xs font-bold text-slate-700">Portion Size</Label>
                                                                        <Input 
                                                                            type="number" 
                                                                            step="any"
                                                                            className="bg-slate-50 mt-1" 
                                                                            placeholder="e.g. 0.1" 
                                                                            value={row.quantity || ''}
                                                                            onChange={(e) => handleRecipeRowChange(index, 'quantity', Number(e.target.value))}
                                                                        />
                                                                    </div>
                                                                    <div className="pt-6">
                                                                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 text-rose-600" onClick={() => handleRemoveRecipeRow(index)}>
                                                                            <Trash2 className="h-4.5 w-4.5" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>

                                                    <div className="border-t pt-4 mt-4 flex justify-end">
                                                        <Button type="submit" className="font-semibold" disabled={saveRecipeMutation.isPending}>
                                                            {saveRecipeMutation.isPending ? 'Saving...' : 'Save Recipe'}
                                                        </Button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400">
                                                    <BookOpen className="h-12 w-12 mb-3" />
                                                    <p className="font-bold text-sm">No Product Selected</p>
                                                    <p className="text-xs">Select a product from the sidebar to set up or edit its recipe ingredients.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ==================================================== */}
                        {/* TAB 5: SUPPLIERS / VENDORS */}
                        {/* ==================================================== */}
                        <TabsContent value="vendors" className="m-0 space-y-4">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle>Suppliers & Vendors</CardTitle>
                                    <CardDescription>Manage supply sources and view invoice histories</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingVendors ? (
                                        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                    ) : vendorsList.length === 0 ? (
                                        <div className="text-center py-12 border border-dashed rounded-lg bg-slate-50">
                                            <Truck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                            <h3 className="text-lg font-bold text-slate-700">No Suppliers Configured</h3>
                                            <p className="text-sm text-slate-500">Create a supplier card to log purchase invoices.</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-md border overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                                                    <tr>
                                                        <th className="px-4 py-3">Supplier Name</th>
                                                        <th className="px-4 py-3">Contact Person</th>
                                                        <th className="px-4 py-3">Phone</th>
                                                        <th className="px-4 py-3">Email</th>
                                                        <th className="px-4 py-3">Address</th>
                                                        <th className="px-4 py-3 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700">
                                                    {vendorsList.map(vendor => (
                                                        <tr key={vendor.id} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 font-bold text-slate-900">{vendor.name}</td>
                                                            <td className="px-4 py-3">{vendor.contact_person || '-'}</td>
                                                            <td className="px-4 py-3 text-xs">{vendor.phone || '-'}</td>
                                                            <td className="px-4 py-3 text-xs">{vendor.email || '-'}</td>
                                                            <td className="px-4 py-3 max-w-xs truncate">{vendor.address || '-'}</td>
                                                            <td className="px-4 py-3 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleOpenEditVendor(vendor)}>
                                                                        <Edit className="h-4.5 w-4.5 text-slate-500" />
                                                                    </Button>
                                                                    <Button size="icon" variant="outline" className="h-8 w-8 text-rose-600 hover:text-rose-700" onClick={() => { if(confirm('Delete this vendor?')) deleteVendorMutation.mutate(vendor.id); }}>
                                                                        <Trash2 className="h-4.5 w-4.5" />
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* ==================================================== */}
                        {/* TAB 6: REPORTS & ALERTS */}
                        {/* ==================================================== */}
                        <TabsContent value="reports" className="m-0 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Stock Alerts Widget */}
                                <Card className="border-slate-200 shadow-sm">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                            <AlertCircle className="h-4.5 w-4.5 text-rose-500" /> Low Stock Alerts
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {stockAlerts.length === 0 ? (
                                            <div className="text-center py-6 text-xs text-slate-500">
                                                All ingredients maintain healthy stock levels.
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-[250px] overflow-auto pr-1">
                                                {stockAlerts.map(i => (
                                                    <div key={i.id} className="flex justify-between items-center p-2 border rounded-md bg-slate-50/50">
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-800">{i.name}</p>
                                                            <p className="text-[10px] text-slate-500">Minimum: {i.min_stock} {i.unit}</p>
                                                        </div>
                                                        <Badge variant="destructive" className="font-bold text-[10px]">
                                                            {i.current_stock} {i.unit} left
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Waste Report Summary */}
                                <Card className="border-slate-200 shadow-sm">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                            <AlertTriangle className="h-4.5 w-4.5 text-amber-500" /> Waste & Expired Cost Loss
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-center py-6 border rounded-md bg-rose-50/20 border-rose-100">
                                            <p className="text-xs font-bold text-rose-700">Financial Value of Waste / Loss</p>
                                            <h3 className="text-3xl font-black text-rose-600 mt-1">₹{totalWasteCost.toFixed(2)}</h3>
                                            <p className="text-[10px] text-rose-500 font-medium mt-1">Sum of manual waste and expired stock logs.</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Audit Logs */}
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle>Inventory Transaction Log</CardTitle>
                                    <CardDescription>Chronological sequence of all stock changes (sales, adjustments, waste, purchases)</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingAdjustments ? (
                                        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                    ) : adjustmentsList.length === 0 ? (
                                        <div className="text-center py-12 text-slate-400 text-xs">
                                            No transaction entries logged in the system.
                                        </div>
                                    ) : (
                                        <div className="rounded-md border overflow-hidden max-h-[350px] overflow-y-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                                                    <tr>
                                                        <th className="px-4 py-3">Ingredient</th>
                                                        <th className="px-4 py-3">Transaction</th>
                                                        <th className="px-4 py-3">Change Qty</th>
                                                        <th className="px-4 py-3">Remarks</th>
                                                        <th className="px-4 py-3">Auditor</th>
                                                        <th className="px-4 py-3">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-700">
                                                    {adjustmentsList.map(adj => (
                                                        <tr key={adj.id} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 font-bold text-slate-900">{adj.item_name}</td>
                                                            <td className="px-4 py-3">
                                                                <span className={`capitalize text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                                    adj.type === 'purchase_addition' ? 'bg-emerald-50 text-emerald-700' :
                                                                    adj.type === 'sale_deduction' ? 'bg-blue-50 text-blue-700' :
                                                                    'bg-amber-50 text-amber-700'
                                                                }`}>
                                                                    {adj.type.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                            <td className={`px-4 py-3 font-black ${adj.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {adj.quantity > 0 ? `+${adj.quantity}` : adj.quantity} {adj.item_unit}
                                                            </td>
                                                            <td className="px-4 py-3 text-xs max-w-xs truncate">{adj.reason || '-'}</td>
                                                            <td className="px-4 py-3 text-xs">{adj.created_by || 'System'}</td>
                                                            <td className="px-4 py-3 text-xs">{new Date(adj.created_at || '').toLocaleDateString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </main>
            </div>

            {/* ==================================================== */}
            {/* MODALS */}
            {/* ==================================================== */}

            {/* MODAL: ADD/EDIT INGREDIENT */}
            <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase text-slate-900">
                            {editingItem ? 'Edit Ingredient' : 'Add Ingredient'}
                        </DialogTitle>
                        <DialogDescription>Setup ingredient boundaries and cataloging.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitItem} className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">Item Name</Label>
                            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Fresh Onions" className="bg-slate-50" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">SKU Code (Optional)</Label>
                                <Input value={itemSku} onChange={(e) => setItemSku(e.target.value)} placeholder="e.g. RAW-ONION" className="bg-slate-50" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Portion Unit</Label>
                                <Input value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} placeholder="e.g. kg, grams, liters" className="bg-slate-50" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Category</Label>
                                <Select value={itemCategory} onValueChange={(v: any) => setItemCategory(v)}>
                                    <SelectTrigger className="w-full bg-slate-50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="raw_material">Raw Material</SelectItem>
                                        <SelectItem value="consumable">Consumable</SelectItem>
                                        <SelectItem value="packaging">Packaging</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Min Stock Alert Level</Label>
                                <Input type="number" value={itemMinStock} onChange={(e) => setItemMinStock(e.target.value)} className="bg-slate-50" />
                            </div>
                        </div>
                        {!editingItem && (
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Starting Cost Price (₹)</Label>
                                <Input type="number" value={itemCostPrice} onChange={(e) => setItemCostPrice(e.target.value)} className="bg-slate-50" />
                            </div>
                        )}
                        <DialogFooter className="pt-4 border-t gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saveItemMutation.isPending}>
                                {saveItemMutation.isPending ? 'Saving...' : 'Save Item'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL: ADD/EDIT SUPPLIER */}
            <Dialog open={isVendorModalOpen} onOpenChange={setIsVendorModalOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase text-slate-900">
                            {editingVendor ? 'Edit Supplier' : 'Add Supplier'}
                        </DialogTitle>
                        <DialogDescription>Setup supplier catalogs and boundaries.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitVendor} className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">Supplier Name</Label>
                            <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. Metro Food Suppliers" className="bg-slate-50" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Contact Person</Label>
                                <Input value={vendorContact} onChange={(e) => setVendorContact(e.target.value)} placeholder="e.g. John Doe" className="bg-slate-50" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Phone Number</Label>
                                <Input value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} placeholder="e.g. +91 9999999999" className="bg-slate-50" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">Email Address</Label>
                            <Input type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} placeholder="e.g. contact@metro.com" className="bg-slate-50" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">Physical Address</Label>
                            <Input value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} placeholder="e.g. Warehouse 10, Industrial Area" className="bg-slate-50" />
                        </div>
                        <DialogFooter className="pt-4 border-t gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsVendorModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={saveVendorMutation.isPending}>
                                {saveVendorMutation.isPending ? 'Saving...' : 'Save Supplier'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL: LOG PURCHASE INVOICE */}
            <Dialog open={isPurchaseModalOpen} onOpenChange={setIsPurchaseModalOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase text-slate-900">
                            Log Supplier Invoice
                        </DialogTitle>
                        <DialogDescription>Input purchase invoices. Approving invoices will automatically increase current stock.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitPurchase} className="space-y-4 pt-2">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Invoice Number</Label>
                                <Input value={purchaseInvoice} onChange={(e) => setPurchaseInvoice(e.target.value)} placeholder="e.g. INV-2026-001" className="bg-slate-50" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Supplier</Label>
                                <Select value={purchaseVendorId} onValueChange={setPurchaseVendorId}>
                                    <SelectTrigger className="bg-slate-50">
                                        <SelectValue placeholder="Select Vendor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vendorsList.map(v => (
                                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Purchase Date</Label>
                                <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="bg-slate-50" />
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-xs uppercase text-slate-600">Invoice Items</h4>
                                <Button type="button" size="sm" variant="outline" className="font-semibold text-xs gap-1" onClick={handleAddPurchaseRow}>
                                    <Plus className="h-3 w-3" /> Add Item
                                </Button>
                            </div>

                            <div className="space-y-3 max-h-[250px] overflow-auto pr-1">
                                {purchaseRows.map((row, index) => (
                                    <div key={index} className="flex gap-3 items-end">
                                        <div className="flex-1">
                                            <Label className="text-[10px] font-bold text-slate-500">Ingredient</Label>
                                            <Select value={row.item_id} onValueChange={(v) => handlePurchaseRowChange(index, 'item_id', v)}>
                                                <SelectTrigger className="bg-slate-50 h-8 mt-1">
                                                    <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {itemsList.map(item => (
                                                        <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-24">
                                            <Label className="text-[10px] font-bold text-slate-500">Quantity</Label>
                                            <Input type="number" step="any" className="bg-slate-50 h-8 mt-1" value={row.quantity} onChange={(e) => handlePurchaseRowChange(index, 'quantity', Number(e.target.value))} />
                                        </div>
                                        <div className="w-28">
                                            <Label className="text-[10px] font-bold text-slate-500">Unit Price (₹)</Label>
                                            <Input type="number" className="bg-slate-50 h-8 mt-1" value={row.unit_price} onChange={(e) => handlePurchaseRowChange(index, 'unit_price', Number(e.target.value))} />
                                        </div>
                                        {purchaseRows.length > 1 && (
                                            <Button type="button" variant="outline" size="icon" className="h-8 w-8 text-rose-600 mt-1 shrink-0" onClick={() => handleRemovePurchaseRow(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter className="pt-4 border-t gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsPurchaseModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={savePurchaseMutation.isPending}>
                                {savePurchaseMutation.isPending ? 'Saving...' : 'Create Invoice'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL: STOCK ADJUSTMENT */}
            <Dialog open={isAdjustmentModalOpen} onOpenChange={setIsAdjustmentModalOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase text-slate-900">
                            Adjust Stock quantity
                        </DialogTitle>
                        <DialogDescription>
                            Manually adjust stock for <strong className="text-slate-900">{adjustingItem?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmitAdjustment} className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">Adjustment Type</Label>
                            <Select value={adjType} onValueChange={(v: any) => setAdjType(v)}>
                                <SelectTrigger className="w-full bg-slate-50">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manual_adjustment">Manual Adjustment (Add/Subtract)</SelectItem>
                                    <SelectItem value="waste">Waste Entry (Deduct)</SelectItem>
                                    <SelectItem value="expired">Expired Entry (Deduct)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">Quantity ({adjustingItem?.unit})</Label>
                            <Input type="number" step="any" placeholder="e.g. 5 or -2" value={adjQuantity} onChange={(e) => setAdjQuantity(e.target.value)} className="bg-slate-50" />
                            <p className="text-[10px] text-muted-foreground mt-0.5">Wastages and expirations will automatically subtract quantities.</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">Reason / Remarks</Label>
                            <Input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="e.g. Periodic count check" className="bg-slate-50" />
                        </div>
                        <DialogFooter className="pt-4 border-t gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsAdjustmentModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={adjustStockMutation.isPending}>
                                {adjustStockMutation.isPending ? 'Submitting...' : 'Apply Adjustment'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL: DATABASE SETUP GUIDE */}
            <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-black uppercase text-lg text-slate-900">
                            <Database className="h-5 w-5 text-primary" /> Setup Inventory Tables
                        </DialogTitle>
                        <DialogDescription className="font-semibold text-slate-600">
                            Follow these 2 simple steps to enable cloud database synchronization for the Inventory Management module.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 my-2 text-sm text-slate-700">
                        <div className="border rounded-md p-4 bg-slate-50 space-y-2">
                            <h5 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs font-semibold">1</span>
                                Open Supabase SQL Editor
                            </h5>
                            <p className="text-xs text-slate-600 pl-7 font-medium">
                                Click the link below to open the SQL editor in your Supabase dashboard:
                            </p>
                            <div className="pl-7 pt-1">
                                <a
                                    href="https://supabase.com/dashboard/project/jrzpsrmticjbpobloqej/sql/new"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-black uppercase"
                                >
                                    Open Supabase SQL Editor <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        </div>

                        <div className="border rounded-md p-4 bg-slate-50 space-y-2">
                            <h5 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs font-semibold">2</span>
                                Copy & Run SQL Migration Script
                            </h5>
                            <p className="text-xs text-slate-600 pl-7 font-medium">
                                Copy the SQL code block below, paste it into the Supabase editor window, and click <strong className="text-slate-800">Run</strong>.
                            </p>
                            <div className="pl-7 relative">
                                <pre className="text-[10px] bg-slate-900 text-slate-200 p-3 rounded-md overflow-x-auto max-h-60 font-mono">
                                    {`-- Run the script contained in:
-- supabase/migrations/20260625_create_inventory_management.sql`}
                                </pre>
                                <Button
                                    size="sm"
                                    className="absolute right-2 top-2 h-7 px-2.5 text-xs font-bold"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`-- MIGRATION PLACEHOLDER`);
                                        toast.success("Script copied!");
                                    }}
                                >
                                    Copy SQL
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0 border-t pt-4">
                        <Button onClick={() => window.location.reload()} className="w-full sm:w-auto font-bold uppercase">
                            I've run the SQL (Refresh Page)
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
