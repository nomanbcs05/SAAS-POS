import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Utensils, Edit2, Trash2, ImagePlus, Loader2, Save, X, Apple, Package } from 'lucide-react';
import { cn } from "@/lib/utils";
import { api } from '@/services/api';
import { useMutation } from '@tanstack/react-query';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface FreshBasketMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: any, quantity?: number) => void;
  category?: string;
}

interface MenuItem {
  name: string;
  category: string;
  price?: number;
  image?: string;
  sizes?: {
    [key: string]: number;
  };
}

export const DEFAULT_FRESHBASKET_DATA: MenuItem[] = [
  // FRUITS
  { name: "Apple / سیب", category: "FRUITS", price: 0 },
  { name: "Banana / کیلا", category: "FRUITS", price: 0 },
  { name: "Mango / آم", category: "FRUITS", price: 0 },
  { name: "Orange / سنگترہ", category: "FRUITS", price: 0 },
  { name: "Grapes / انگور", category: "FRUITS", price: 0 },
  { name: "Pomegranate / انار", category: "FRUITS", price: 0 },
  { name: "Watermelon / تربوز", category: "FRUITS", price: 0 },
  { name: "Melon / خربوزہ", category: "FRUITS", price: 0 },
  { name: "Guava / امرود", category: "FRUITS", price: 0 },
  { name: "Papaya / پپیتا", category: "FRUITS", price: 0 },
  { name: "Pineapple / انناس", category: "FRUITS", price: 0 },
  { name: "Strawberry / اسٹرابیری", category: "FRUITS", price: 0 },
  { name: "Peach / آڑو", category: "FRUITS", price: 0 },
  { name: "Pear / ناشپاتی", category: "FRUITS", price: 0 },
  { name: "Plum / آلوبخارا", category: "FRUITS", price: 0 },
  { name: "Cherry / چیری", category: "FRUITS", price: 0 },
  { name: "Coconut / ناریل", category: "FRUITS", price: 0 },
  { name: "Dates / کھجور", category: "FRUITS", price: 0 },
  { name: "Lychee / لیچی", category: "FRUITS", price: 0 },
  { name: "Apricot / خوبانی", category: "FRUITS", price: 0 },
  { name: "Fig / انجیر", category: "FRUITS", price: 0 },
  { name: "Jamun / جامن", category: "FRUITS", price: 0 },
  { name: "Kiwi / کیوی", category: "FRUITS", price: 0 },
  { name: "Sapodilla / Chikoo / چیکو", category: "FRUITS", price: 0 },
  // VEGETABLES
  { name: "Potato / آلو", category: "VEGETABLES", price: 0 },
  { name: "Onion / پیاز", category: "VEGETABLES", price: 0 },
  { name: "Tomato / ٹماٹر", category: "VEGETABLES", price: 0 },
  { name: "Garlic / لہسن", category: "VEGETABLES", price: 0 },
  { name: "Ginger / ادرک", category: "VEGETABLES", price: 0 },
  { name: "Green Chili / ہری مرچ", category: "VEGETABLES", price: 0 },
  { name: "Capsicum / شملہ مرچ", category: "VEGETABLES", price: 0 },
  { name: "Carrot / گاجر", category: "VEGETABLES", price: 0 },
  { name: "Radish / مولی", category: "VEGETABLES", price: 0 },
  { name: "Turnip / شلجم", category: "VEGETABLES", price: 0 },
  { name: "Beetroot / چقندر", category: "VEGETABLES", price: 0 },
  { name: "Cucumber / کھیرہ", category: "VEGETABLES", price: 0 },
  { name: "Bitter Gourd / کریلا", category: "VEGETABLES", price: 0 },
  { name: "Bottle Gourd / لوکی", category: "VEGETABLES", price: 0 },
  { name: "Ridge Gourd / توری", category: "VEGETABLES", price: 0 },
  { name: "Pumpkin / کدو", category: "VEGETABLES", price: 0 },
  { name: "Brinjal / Eggplant / بینگن", category: "VEGETABLES", price: 0 },
  { name: "Lady Finger / بھنڈی", category: "VEGETABLES", price: 0 },
  { name: "Peas / مٹر", category: "VEGETABLES", price: 0 },
  { name: "Cabbage / بند گوبھی", category: "VEGETABLES", price: 0 },
  { name: "Cauliflower / پھول گوبھی", category: "VEGETABLES", price: 0 },
  { name: "Spinach / پالک", category: "VEGETABLES", price: 0 },
  { name: "Coriander / دھنیا", category: "VEGETABLES", price: 0 },
  { name: "Mint / پودینہ", category: "VEGETABLES", price: 0 },
  { name: "Fenugreek / میتھی", category: "VEGETABLES", price: 0 },
  { name: "Green Beans / پھلیاں", category: "VEGETABLES", price: 0 },
  { name: "Lettuce / سلاد پتا", category: "VEGETABLES", price: 0 },
  { name: "Spring Onion / ہرا پیاز", category: "VEGETABLES", price: 0 },
  // DAILY ESSENTIALS
  { name: "Chicken / چکن", category: "DAILY ESSENTIALS", price: 0 },
  { name: "Fish / مچھلی", category: "DAILY ESSENTIALS", price: 0 },
  { name: "Eggs / انڈے", category: "DAILY ESSENTIALS", price: 0 },
  { name: "Dawn Bread / ڈان بریڈ", category: "DAILY ESSENTIALS", price: 0 },
  { name: "Jam / جیم", category: "DAILY ESSENTIALS", price: 0 },
];

export default function FreshBasketMenuModal({ isOpen, onClose, onAdd, category: initialCategory }: FreshBasketMenuModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(initialCategory || 'all');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const { isAdmin } = useMultiTenant();

  const categoryKey = initialCategory 
    ? `freshbasket_${initialCategory.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '')}`
    : 'freshbasket_all';

  const [categoryImage, setCategoryImage] = useState<string>(() => {
    const saved = localStorage.getItem('pos_category_image_' + categoryKey);
    if (saved) return saved;
    return '';
  });

  const uploadImageMutation = useMutation({
    mutationFn: api.products.uploadImage,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    },
  });

  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const url = await uploadImageMutation.mutateAsync(file);
        setCategoryImage(url);
        localStorage.setItem('pos_category_image_' + categoryKey, url);
        toast.success("Category image uploaded successfully");
      } catch (error) {
        // Error handled by mutation onError
      }
    }
  };

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    const key = initialCategory 
      ? `pos_menu_freshbasket_${initialCategory.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '')}`
      : 'pos_menu_freshbasket';
    
    const saved = localStorage.getItem(key);
    if (saved) {
      setMenuItems(JSON.parse(saved));
    } else {
      setMenuItems(DEFAULT_FRESHBASKET_DATA.filter(item => !initialCategory || item.category === initialCategory));
    }
  }, [isOpen, initialCategory]);

  const updateMenuState = (updatedItems: MenuItem[]) => {
    setMenuItems(updatedItems);
  };

  const cancelEditing = () => {
    const key = initialCategory 
      ? `pos_menu_freshbasket_${initialCategory.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '')}`
      : 'pos_menu_freshbasket';
    const saved = localStorage.getItem(key);
    if (saved) {
      setMenuItems(JSON.parse(saved));
    } else {
      setMenuItems(DEFAULT_FRESHBASKET_DATA.filter(item => !initialCategory || item.category === initialCategory));
    }
    setIsEditingMode(false);
  };

  const categories = Array.from(new Set(menuItems.map(item => item.category)));

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updated = [...menuItems];
    if (field === 'price') {
      updated[index] = { ...updated[index], price: Number(value) };
    } else if (updated[index].sizes && updated[index].sizes![field] !== undefined) {
      updated[index] = { 
        ...updated[index], 
        sizes: { 
          ...updated[index].sizes!, 
          [field]: Number(value) 
        } 
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    updateMenuState(updated);
  };

  const handleAddNewItem = () => {
    const newItem: MenuItem = {
      name: "New Item",
      category: selectedCategory === 'all' ? (categories[0] || 'FRUITS') : selectedCategory,
      price: 0
    };
    const updated = [...menuItems, newItem];
    updateMenuState(updated);
    toast.success('New item added (Unsaved)');
  };

  const handleRemoveItem = (index: number) => {
    const updated = menuItems.filter((_, i) => i !== index);
    updateMenuState(updated);
    toast.success('Item removed (Unsaved)');
  };

  const handleAddItem = (item: MenuItem, size?: string) => {
    if (isEditingMode) return;

    const price = size ? item.sizes?.[size] : item.price;
    const name = size ? `${item.name} (${size})` : item.name;

    const product = {
      id: `freshbasket-${item.category.toLowerCase().replace(/\s+/g, '-')}-${item.name.toLowerCase().replace(/\s+/g, '-')}${size ? `-${size.toLowerCase()}` : ''}`,
      name,
      price: price || 0,
      category: item.category,
      image: item.image || '🍎',
      sku: `FB-${item.name.substring(0, 3).toUpperCase()}${size ? `-${size[0]}` : ''}`,
    };

    onAdd(product, selectedQuantity);
    toast.success(`${name} (${selectedQuantity}x) added to cart`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setIsEditingMode(false);
        onClose();
      }
    }}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border-none rounded-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl [&>button]:hidden">
        {/* Header — Fresh Green Theme */}
        <div className="bg-emerald-800 bg-gradient-to-br from-emerald-800 to-green-700 px-6 py-5 text-white shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg relative overflow-hidden group">
                {categoryImage ? (
                  <img src={categoryImage} alt="Category" className="h-7 w-7 object-cover rounded-md" />
                ) : selectedCategory?.toLowerCase() === 'vegetables' ? (
                  <Package className="h-7 w-7 text-green-300" />
                ) : selectedCategory?.toLowerCase() === 'daily essentials' ? (
                  <Package className="h-7 w-7 text-green-300" />
                ) : (
                  <Apple className="h-7 w-7 text-green-300" />
                )}
                {isEditingMode && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    {uploadImageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 text-white animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4 text-white" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleCategoryImageUpload}
                      disabled={uploadImageMutation.isPending}
                    />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight">
                    {selectedCategory === 'all' ? 'Fresh Basket Menu' : `${selectedCategory} Menu`}
                  </DialogTitle>
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isEditingMode ? "bg-red-500 text-white hover:bg-red-600" : "bg-white/10 text-white hover:bg-white/20"
                      )}
                      onClick={() => {
                        if (isEditingMode) {
                          cancelEditing();
                        } else {
                          setIsEditingMode(true);
                        }
                      }}
                      title={isEditingMode ? "Cancel Editing" : "Edit Menu"}
                    >
                      {isEditingMode ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                <DialogDescription className="text-green-200/60 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  {isEditingMode ? "ADMIN MODE: EDITING ITEMS" : "Fresh Basket by Al Khalid — Fruits Menu"}
                </DialogDescription>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-90"
            >
              <Plus className="h-6 w-6 rotate-45" />
            </button>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-200/40" />
              <Input
                placeholder="Search fruits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/10 border-none text-white placeholder:text-green-200/30 pl-10 h-11 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
              />
            </div>
            {!initialCategory && (
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white/10 border-none text-white px-4 rounded-xl text-sm focus:ring-1 focus:ring-white/20 outline-none"
              >
                <option value="all" className="bg-emerald-900">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-emerald-900">{cat}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4 px-2 overflow-x-auto pb-2 scrollbar-hide">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <Button
                key={num}
                variant="ghost"
                className={cn(
                  "h-10 w-10 min-w-[2.5rem] rounded-xl font-black text-sm transition-all",
                  selectedQuantity === num 
                    ? "bg-green-500 text-white shadow-lg shadow-green-500/30 scale-110" 
                    : "bg-white/10 text-green-100 hover:bg-white/20"
                )}
                onClick={() => setSelectedQuantity(num)}
              >
                {num}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item, index) => {
              const originalIndex = menuItems.findIndex(mi => mi.name === item.name && mi.category === item.category);
              
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.1 }}
                  key={`item-${originalIndex}-${index}`}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                      {!isEditingMode && !item.sizes && (
                        <span className="text-sm font-black text-slate-900">
                          Rs. {item.price}
                        </span>
                      )}
                      {isEditingMode && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRemoveItem(originalIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {isEditingMode ? (
                      <Input 
                        value={item.name} 
                        onChange={(e) => handleUpdateItem(originalIndex, 'name', e.target.value)}
                        className="h-9 text-sm font-bold mb-4"
                        placeholder="Item Name"
                      />
                    ) : (
                      <h3 className="text-base font-bold text-slate-900 mb-4">{item.name}</h3>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {isEditingMode ? (
                      <div className="w-full space-y-2">
                        {item.sizes ? (
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(item.sizes).map(([size, price]) => (
                              <div key={size} className="flex-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">{size}</label>
                                <Input 
                                  type="number"
                                  value={price} 
                                  onChange={(e) => handleUpdateItem(originalIndex, size, e.target.value)}
                                  className="h-9 text-xs font-black"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Price</label>
                            <Input 
                              type="number"
                              value={item.price} 
                              onChange={(e) => handleUpdateItem(originalIndex, 'price', e.target.value)}
                              className="h-9 text-xs font-black"
                            />
                          </div>
                        )}
                        <select 
                          value={item.category}
                          onChange={(e) => handleUpdateItem(originalIndex, 'category', e.target.value)}
                          className="w-full h-9 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold uppercase px-2"
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    ) : item.sizes ? (
                      <>
                        {Object.entries(item.sizes).map(([size, price]) => (
                          <Button 
                            key={size}
                            onClick={() => handleAddItem(item, size)}
                            className="flex-1 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-900 border-none rounded-xl h-10 font-bold transition-all text-xs"
                          >
                            {size} (Rs. {price})
                          </Button>
                        ))}
                      </>
                    ) : (
                      <Button 
                        onClick={() => handleAddItem(item)}
                        className="w-full bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-900 border-none rounded-xl h-10 font-bold transition-all"
                      >
                        Add to Cart
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {isEditingMode && (
            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                className="flex-1 border-dashed border-2 h-14 rounded-2xl text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all"
                onClick={handleAddNewItem}
              >
                <Plus className="h-5 w-5 mr-2" />
                Add New Item to Menu
              </Button>
              <Button 
                className="flex-1 h-14 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all shadow-lg shadow-emerald-500/20"
                onClick={() => {
                  const key = initialCategory 
                    ? `pos_menu_freshbasket_${initialCategory.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '')}`
                    : 'pos_menu_freshbasket';
                  localStorage.setItem(key, JSON.stringify(menuItems));
                  setIsEditingMode(false);
                  toast.success('Menu changes saved successfully!');
                }}
              >
                <Save className="h-5 w-5 mr-2" />
                Save All Changes
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
