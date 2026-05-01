import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Edit, Trash2, MoreHorizontal, Package, AlertTriangle, Loader2, Settings, ChefHat, Utensils, Tag, X, Save, ImagePlus } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api, Category } from '@/services/api';
import { DEFAULT_INDUS_DATA } from '@/components/pos/IndusMenuModal';

const ProductsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    price: '',
    cost: '',
    stock: '',
    category: '',
    image: '☕',
  });
  const [newCategory, setNewCategory] = useState({
    name: '',
    icon: 'Package',
  });

  // Virtual Menu States
  const [isVirtualMenuModalOpen, setIsVirtualMenuModalOpen] = useState(false);
  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);
  const [selectedVirtualCategory, setSelectedVirtualCategory] = useState<string | null>(null);
  const [virtualMenuItems, setVirtualMenuItems] = useState<any[]>([]);
  const [cardVisibility, setCardVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const savedVisibility = localStorage.getItem('pos_card_visibility');
    if (savedVisibility) {
      setCardVisibility(JSON.parse(savedVisibility));
    } else {
      // Default all to true if not set
      const initialVisibility: Record<string, boolean> = {};
      virtualCategories.forEach(cat => {
        initialVisibility[cat.id] = true;
      });
      setCardVisibility(initialVisibility);
    }
  }, []);

  const toggleVisibility = (id: string) => {
    const newVisibility = { ...cardVisibility, [id]: !cardVisibility[id] === false ? false : !cardVisibility[id] };
    // If it was undefined, it should be true, so toggle to false
    const currentVal = cardVisibility[id] === undefined ? true : cardVisibility[id];
    const toggledVal = !currentVal;
    
    const updatedVisibility = { ...cardVisibility, [id]: toggledVal };
    setCardVisibility(updatedVisibility);
    localStorage.setItem('pos_card_visibility', JSON.stringify(updatedVisibility));
    
    const catName = virtualCategories.find(c => c.id === id)?.name || id;
    uiToast({ 
      title: "Dashboard Updated", 
      description: `${catName} is now ${toggledVal ? 'visible' : 'hidden'} on dashboard` 
    });
  };

  const virtualCategories = [
    { id: 'barbq', name: 'BAR BQ', key: 'pos_menu_barbq', icon: ChefHat },
    { id: 'pizza', name: 'Pizzas', key: 'pos_menu_pizza', icon: Utensils },
    { id: 'roll', name: 'Rolls', key: 'pos_menu_roll', icon: Package },
    { id: 'burger', name: 'Burgers', key: 'pos_menu_burger', icon: Package },
    { id: 'broast', name: 'Broast', key: 'pos_menu_broast', icon: ChefHat },
    { id: 'sauce', name: 'Sauces', key: 'pos_menu_sauce', icon: Utensils },
    { id: 'deals', name: 'Deals', key: 'pos_menu_deals', icon: Tag },
    { id: 'fries', name: 'Fries', key: 'pos_menu_fries', icon: Package },
    { id: 'beverages', name: 'Beverages', key: 'pos_menu_beverages', icon: Package },
    { id: 'alacart', name: 'ALA CART', key: 'pos_menu_alacart', icon: Package },
    { id: 'indus_rice', name: 'RICE', key: 'pos_menu_indus_rice', filter: 'RICE', icon: Utensils },
    { id: 'indus_chicken_karahi', name: 'CHICKEN (Karahi)', key: 'pos_menu_indus_chicken_karahi', filter: 'CHICKEN (Karahi)', icon: Utensils },
    { id: 'indus_handi', name: 'HANDI (Chicken)', key: 'pos_menu_indus_handi_chicken', filter: 'HANDI (Chicken)', icon: Utensils },
    { id: 'indus_mutton_karahi', name: 'MUTTON (Karahi)', key: 'pos_menu_indus_mutton_karahi', filter: 'MUTTON (Karahi)', icon: Utensils },
    { id: 'indus_mutton_handi', name: 'MUTTON HANDI', key: 'pos_menu_indus_mutton_handi', filter: 'MUTTON HANDI', icon: Utensils },
    { id: 'indus_veg', name: 'VEGETARIAN', key: 'pos_menu_indus_veg', filter: 'VEGETARIAN', icon: Utensils },
    { id: 'indus_fried', name: 'FRIED', key: 'pos_menu_indus_fried', filter: 'FRIED', icon: Utensils },
    { id: 'indus_joints', name: 'JOINTS', key: 'pos_menu_indus_joints', filter: 'JOINTS', icon: Utensils },
    { id: 'indus_bbq', name: 'BBQ', key: 'pos_menu_indus_bbq', filter: 'BBQ', icon: ChefHat },
    { id: 'indus_roti', name: 'NAAN_ROTI', key: 'pos_menu_indus_roti', filter: 'NAAN_ROTI', icon: Utensils },
    { id: 'indus_salads', name: 'SALADS', key: 'pos_menu_indus_salads', filter: 'SALADS', icon: Utensils },
    { id: 'indus_tea', name: 'TEA', key: 'pos_menu_indus_tea', filter: 'TEA', icon: Utensils },
  ];

  const openVirtualMenuEditor = (category: any) => {
    setSelectedVirtualCategory(category.name);
    const saved = localStorage.getItem(category.key);
    if (saved) {
      setVirtualMenuItems(JSON.parse(saved));
    } else {
      let defaults: any[] = [];
      if (category.key.startsWith('pos_menu_indus')) {
        defaults = DEFAULT_INDUS_DATA
          .filter(item => item.category === category.filter)
          .map(item => ({
            name: item.name,
            price: item.price || (item.sizes ? item.sizes.Full : 0), // Defaulting to Full price if sizes exist
            image: (item as any).image || ''
          }));
      }
      setVirtualMenuItems(defaults);
    }
    setIsVirtualMenuModalOpen(true);
  };

  const saveVirtualMenu = () => {
    if (selectedVirtualCategory) {
      const category = virtualCategories.find(c => c.name === selectedVirtualCategory);
      if (category) {
        localStorage.setItem(category.key, JSON.stringify(virtualMenuItems));
        uiToast({ title: "Success", description: `${selectedVirtualCategory} menu updated` });
        setIsVirtualMenuModalOpen(false);
      }
    }
  };

  const { toast: uiToast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading: isProductsLoading, isError, error } = useQuery({
    queryKey: ['products'],
    queryFn: api.products.getAll,
  });

  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.getAll,
  });

  if (isError) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <p className="text-destructive font-medium">Failed to load products</p>
            <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })}>
              Retry
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const addProductMutation = useMutation({
    mutationFn: api.products.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      uiToast({
        title: "Success",
        description: "Product added successfully",
      });
      setIsProductDialogOpen(false);
      resetProductForm();
    },
    onError: (error) => {
      uiToast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, product }: { id: string, product: any }) => api.products.update(id, product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      uiToast({
        title: "Success",
        description: "Product updated successfully",
      });
      setIsProductDialogOpen(false);
      resetProductForm();
    },
    onError: (error) => {
      uiToast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: api.products.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      uiToast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: (error) => {
      uiToast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addCategoryMutation = useMutation({
    mutationFn: api.categories.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      uiToast({
        title: "Success",
        description: "Category added successfully",
      });
      setNewCategory({ name: '', icon: 'Package' });
    },
    onError: (error) => {
      uiToast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: api.categories.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      uiToast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: (error) => {
      uiToast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: api.products.uploadImage,
    onError: (error) => {
      console.error("Upload error details:", error);
      uiToast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload image. Please check your connection and try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const url = await uploadImageMutation.mutateAsync(file);
        setNewProduct({ ...newProduct, image: url });
        uiToast({
          title: "Success",
          description: "Image uploaded successfully",
        });
      } catch (error) {
        // Error handled by mutation onError
      }
    }
  };

  const handleVirtualItemImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const url = await uploadImageMutation.mutateAsync(file);
        const newItems = [...virtualMenuItems];
        newItems[index] = { ...newItems[index], image: url };
        setVirtualMenuItems(newItems);
        uiToast({
          title: "Success",
          description: "Image uploaded successfully",
        });
      } catch (error) {
        // Error handled by mutation onError
      }
    }
  };

  const resetProductForm = () => {
    setNewProduct({
      name: '',
      sku: '',
      price: '',
      cost: '',
      stock: '',
      category: '',
      image: '☕',
    });
    setEditingProduct(null);
  };

  const openAddDialog = () => {
    resetProductForm();
    setIsProductDialogOpen(true);
  };

  const openEditDialog = (product: any) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      sku: product.sku,
      price: product.price.toString(),
      cost: product.cost.toString(),
      stock: product.stock.toString(),
      category: product.category,
      image: product.image,
    });
    setIsProductDialogOpen(true);
  };

  const handleSaveProduct = () => {
    if (!newProduct.name || !newProduct.sku || !newProduct.price || !newProduct.cost || !newProduct.category) {
      uiToast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const productData = {
      name: newProduct.name,
      sku: newProduct.sku,
      price: parseFloat(newProduct.price),
      cost: parseFloat(newProduct.cost),
      stock: parseInt(newProduct.stock) || 0,
      category: newProduct.category,
      image: newProduct.image,
    };

    if (editingProduct) {
      updateProductMutation.mutate({
        id: editingProduct.id,
        product: productData,
      });
    } else {
      addProductMutation.mutate(productData);
    }
  };

  const handleAddCategory = () => {
    if (!newCategory.name) {
      uiToast({
        title: "Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }
    addCategoryMutation.mutate(newCategory);
  };

  const filteredProducts = useMemo(() => {
    let allDisplayProducts = [...products];

    // Add virtual products to the display list
    virtualCategories.forEach(vCat => {
      const saved = localStorage.getItem(vCat.key);
      let items = [];
      if (saved) {
        items = JSON.parse(saved);
      } else if (vCat.key.startsWith('pos_menu_indus')) {
        items = DEFAULT_INDUS_DATA
          .filter(item => item.category === vCat.filter)
          .map(item => ({
            name: item.name,
            price: item.price || (item.sizes ? item.sizes.Full : 0)
          }));
      }

      items.forEach((item: any, idx: number) => {
        allDisplayProducts.push({
          id: `virtual-${vCat.id}-${idx}`,
          name: item.name,
          sku: `VIRTUAL-${vCat.name.substring(0, 3).toUpperCase()}`,
          category: vCat.name,
          cost: 0,
          price: item.price,
          stock: 0,
          image: item.image || '📦',
          isVirtual: true
        } as any);
      });
    });

    return allDisplayProducts.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            product.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const lowStockCount = products.filter(p => p.stock <= 10).length;

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* Dashboard Card Visibility Modal */}
        <Dialog open={isVisibilityModalOpen} onOpenChange={setIsVisibilityModalOpen}>
          <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden bg-white border-none flex flex-col">
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
              <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight">Dashboard Cards</DialogTitle>
              <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                Toggle which virtual menu cards appear on POS dashboard
              </DialogDescription>
            </DialogHeader>
            <div className="p-6 space-y-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {virtualCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <cat.icon className="h-4 w-4 text-slate-600" />
                        </div>
                        <span className="font-bold text-sm text-slate-700">{cat.name}</span>
                      </div>
                      <Button
                        variant={cardVisibility[cat.id] !== false ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleVisibility(cat.id)}
                        className={cn(
                          "rounded-xl px-4 h-9 font-bold transition-all",
                          cardVisibility[cat.id] !== false 
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                            : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                        )}
                      >
                        {cardVisibility[cat.id] !== false ? 'Visible' : 'Hidden'}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t">
              <Button onClick={() => setIsVisibilityModalOpen(false)} className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest py-6">
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Virtual Menu Editor Dialog */}
        <Dialog open={isVirtualMenuModalOpen} onOpenChange={setIsVirtualMenuModalOpen}>
          <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden bg-white border-none flex flex-col max-h-[85vh]">
            <DialogHeader className="p-6 bg-slate-900 text-white shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight">
                    Edit {selectedVirtualCategory} Menu
                  </DialogTitle>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                    Manage items and prices for this selection modal
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-white hover:bg-white/10"
                  onClick={() => setIsVirtualMenuModalOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
              <div className="flex gap-3">
                <Button 
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold"
                  onClick={() => setVirtualMenuItems([...virtualMenuItems, { name: '', price: 0, image: '' }])}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Item
                </Button>
              </div>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-3">
                  {virtualMenuItems.map((item, index) => (
                    <div key={index} className="flex gap-3 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                      <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-white border border-slate-200 relative group/img cursor-pointer flex items-center justify-center hover:border-slate-300 transition-colors">
                        {item.image ? (
                          <img src={item.image} alt="Item" className="h-full w-full object-cover" />
                        ) : (
                          <ImagePlus className="h-5 w-5 text-slate-300 group-hover/img:text-slate-400 transition-colors" />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          onChange={(e) => handleVirtualItemImageUpload(index, e)}
                          title="Upload Image"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Item Name</Label>
                        <Input 
                          value={item.name} 
                          onChange={(e) => {
                            const newItems = [...virtualMenuItems];
                            newItems[index].name = e.target.value;
                            setVirtualMenuItems(newItems);
                          }}
                          className="bg-white border-none shadow-sm h-10 rounded-xl font-bold"
                          placeholder="e.g., Zinger Burger"
                        />
                      </div>
                      <div className="w-32">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-1 block">Price (Rs)</Label>
                        <Input 
                          type="number"
                          value={item.price} 
                          onChange={(e) => {
                            const newItems = [...virtualMenuItems];
                            newItems[index].price = parseFloat(e.target.value) || 0;
                            setVirtualMenuItems(newItems);
                          }}
                          className="bg-white border-none shadow-sm h-10 rounded-xl font-bold"
                        />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="mt-5 text-slate-300 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setVirtualMenuItems(virtualMenuItems.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <DialogFooter className="p-6 bg-slate-50 border-t flex items-center justify-between sm:justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {virtualMenuItems.length} Items in this menu
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsVirtualMenuModalOpen(false)} className="rounded-xl font-bold">
                  Cancel
                </Button>
                <Button onClick={saveVirtualMenu} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest px-8">
                  <Save className="h-4 w-4 mr-2" />
                  Save Menu
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="p-6 border-b bg-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Products</h1>
              <p className="text-muted-foreground">Manage your product catalog</p>
            </div>
            <div className="flex gap-2">
              {lowStockCount > 0 && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {lowStockCount} Low Stock
                </Badge>
              )}
              
              <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Categories
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Manage Categories</DialogTitle>
                    <DialogDescription>
                      Create and manage product categories for your store.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor="catName" className="sr-only">Name</Label>
                        <Input
                          id="catName"
                          placeholder="New category name"
                          value={newCategory.name}
                          onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleAddCategory} disabled={addCategoryMutation.isPending}>
                        {addCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </Button>
                    </div>
                    
                    <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                      {categories.map((category) => (
                        <div key={category.id} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                              <Package className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{category.name}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive h-8 w-8"
                            onClick={() => deleteCategoryMutation.mutate(category.id)}
                            disabled={deleteCategoryMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Utensils className="h-4 w-4 mr-2" />
                    Virtual Menus
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {virtualCategories.map((cat) => (
                    <DropdownMenuItem key={cat.id} onClick={() => openVirtualMenuEditor(cat)}>
                      <cat.icon className="h-4 w-4 mr-2" />
                      {cat.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" onClick={() => setIsVisibilityModalOpen(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Manage Cards
              </Button>

              <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openAddDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
                    <DialogDescription>
                      {editingProduct ? 'Make changes to your product here.' : 'Add a new product to your inventory.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newProduct.name}
                          onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sku">SKU</Label>
                        <Input
                          id="sku"
                          value={newProduct.sku}
                          onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Price</Label>
                        <Input
                          id="price"
                          type="number"
                          value={newProduct.price}
                          onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cost">Cost</Label>
                        <Input
                          id="cost"
                          type="number"
                          value={newProduct.cost}
                          onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stock">Stock</Label>
                        <Input
                          id="stock"
                          type="number"
                          value={newProduct.stock}
                          onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <select
                          id="category"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={newProduct.category}
                          onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                        >
                          <option value="">Select a category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="image">Image</Label>
                      <div className="flex gap-4 items-center">
                        <div className="h-16 w-16 rounded-md border flex items-center justify-center overflow-hidden bg-secondary shrink-0 relative">
                          {uploadImageMutation.isPending ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : newProduct.image?.startsWith('http') ? (
                            <img src={newProduct.image} alt="Preview" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-2xl">{newProduct.image}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <Input
                            id="image"
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadImageMutation.isPending}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Supported formats: JPG, PNG, GIF. Max size: 5MB.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveProduct} disabled={addProductMutation.isPending || updateProductMutation.isPending}>
                      {(addProductMutation.isPending || updateProductMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingProduct ? 'Save Changes' : 'Add Product'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
              >
                All
              </Button>
              {/* Only show categories that have items in them or are from the DB */}
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                </Button>
              ))}
              {/* Filter out virtual categories that match database category names to remove duplicates */}
              {virtualCategories
                .filter(vCat => !categories.some(dbCat => dbCat.name.toLowerCase() === vCat.name.toLowerCase()))
                .map((vCat) => (
                <Button
                  key={vCat.id}
                  variant={selectedCategory === vCat.name ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(vCat.name)}
                >
                  {vCat.name}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Products Table */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {isProductsLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="h-10 w-10 rounded overflow-hidden bg-secondary flex items-center justify-center">
                          {product.image?.startsWith('http') ? (
                            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-2xl">{product.image}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {categories.find(c => c.id === product.category)?.name || product.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        ${(product.cost || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${(product.price || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.stock <= 10 ? (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                            {product.stock}
                          </Badge>
                        ) : (
                          <span>{product.stock}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!product.isVirtual ? (
                              <>
                                <DropdownMenuItem onClick={() => openEditDialog(product)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Package className="h-4 w-4 mr-2" />
                                  Adjust Stock
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => deleteProductMutation.mutate(product.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem disabled>
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Managed via Virtual Menu
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-card text-sm text-muted-foreground">
          Showing {filteredProducts.length} of {products.length} products
        </div>
      </div>
    </MainLayout>
  );
};

export default ProductsPage;
