import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Utensils, ChefHat, Edit2, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface IndusMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: any) => void;
  category?: string; // Optional category filter
}

interface MenuItem {
  name: string;
  category: string;
  price?: number;
  sizes?: {
    Half: number;
    Full: number;
  };
}

export const DEFAULT_INDUS_DATA: MenuItem[] = [
  // DRY
  { name: "Mutton Brown", category: "DRY", price: 3450 },
  { name: "Chicken Brown", category: "DRY", price: 1950 },
  { name: "Chicken Dhaka", category: "DRY", price: 950 },
  { name: "Finger Chicken (8)", category: "DRY", price: 900 },
  { name: "Dynamint Chicken (8)", category: "DRY", price: 750 },
  
  // CHINESE GRAVY
  { name: "Indus Sp. Gravy", category: "CHINESE GRAVY", price: 1100 },
  { name: "Chicken Manchurian", category: "CHINESE GRAVY", price: 1050 },
  { name: "Chicken Shashlik", category: "CHINESE GRAVY", price: 1050 },
  { name: "Chicken Chilli Gravy", category: "CHINESE GRAVY", price: 1050 },
  
  // RICE
  { name: "Indus Sp. Rice", category: "RICE", price: 850 },
  { name: "Chicken Fried Rice", category: "RICE", price: 700 },
  { name: "Vegetable Rice", category: "RICE", price: 600 },
  { name: "Masla Rice", category: "RICE", price: 750 },
  { name: "Kabli Pulao", category: "RICE", price: 800 },
  { name: "Chicken Biryani", category: "RICE", price: 700 },
  
  // CHICKEN (Karahi)
  { name: "Indus Sp. Karahi", category: "CHICKEN (Karahi)", sizes: { Half: 1000, Full: 2000 } },
  { name: "Butt Karahi", category: "CHICKEN (Karahi)", sizes: { Half: 900, Full: 1750 } },
  { name: "Shenwari Karhai", category: "CHICKEN (Karahi)", sizes: { Half: 950, Full: 1850 } },
  { name: "Red Karahi", category: "CHICKEN (Karahi)", sizes: { Half: 850, Full: 1600 } },
  { name: "Achari Karahi", category: "CHICKEN (Karahi)", sizes: { Half: 850, Full: 1650 } },
  { name: "White Karahi", category: "CHICKEN (Karahi)", sizes: { Half: 900, Full: 1800 } },
  
  // HANDI (Chicken)
  { name: "Indus Sp. Handi", category: "HANDI (Chicken)", sizes: { Half: 1100, Full: 2100 } },
  { name: "Makhani Handi", category: "HANDI (Chicken)", sizes: { Half: 1300, Full: 2250 } },
  { name: "Red Handi", category: "HANDI (Chicken)", sizes: { Half: 1000, Full: 2050 } },
  { name: "Achari Handi", category: "HANDI (Chicken)", sizes: { Half: 1100, Full: 2100 } },
  { name: "White Handi", category: "HANDI (Chicken)", sizes: { Half: 1050, Full: 2000 } },
  { name: "Zeera Handi", category: "HANDI (Chicken)", sizes: { Half: 1050, Full: 2000 } },
  { name: "Mughlai Handi", category: "HANDI (Chicken)", sizes: { Half: 1100, Full: 1950 } },
  
  // MUTTON (Karahi)
  { name: "Indus Sp. Karahi", category: "MUTTON (Karahi)", sizes: { Half: 2100, Full: 3800 } },
  { name: "Butt Karahi", category: "MUTTON (Karahi)", sizes: { Half: 2000, Full: 3700 } },
  { name: "Shenwari Karhai", category: "MUTTON (Karahi)", sizes: { Half: 2000, Full: 3700 } },
  { name: "Red Karahi", category: "MUTTON (Karahi)", sizes: { Half: 1800, Full: 3350 } },
  { name: "Achari Karahi", category: "MUTTON (Karahi)", sizes: { Half: 1900, Full: 3600 } },
  { name: "White Karahi", category: "MUTTON (Karahi)", sizes: { Half: 1900, Full: 3600 } },
  
  // MUTTON HANDI
  { name: "Indus Sp. Handi", category: "MUTTON HANDI", sizes: { Half: 2100, Full: 3800 } },
  { name: "Makhani Handi", category: "MUTTON HANDI", sizes: { Half: 2150, Full: 3900 } },
  { name: "Red Handi", category: "MUTTON HANDI", sizes: { Half: 1750, Full: 3400 } },
  { name: "Achari Handi", category: "MUTTON HANDI", sizes: { Half: 1900, Full: 3600 } },
  { name: "White Handi", category: "MUTTON HANDI", sizes: { Half: 2150, Full: 3750 } },
  { name: "Zeera Handi", category: "MUTTON HANDI", sizes: { Half: 1950, Full: 3650 } },
  { name: "Mughlai Handi", category: "MUTTON HANDI", sizes: { Half: 1750, Full: 3300 } },

  // CHAI
  { name: "Chia Full", category: "CHAI", price: 100 },
  { name: "Chia Half", category: "CHAI", price: 50 },
  { name: "Badami Chai", category: "CHAI", price: 120 },
  { name: "Kawa Chai", category: "CHAI", price: 50 },

  // ROTI
  { name: "Tandoori Roti", category: "ROTI", price: 25 },
  { name: "Plain Naan", category: "ROTI", price: 30 },
  { name: "Garlic Naan", category: "ROTI", price: 40 },
];

export default function IndusMenuModal({ isOpen, onClose, onAdd, category: initialCategory }: IndusMenuModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>(initialCategory || 'all');
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const { isAdmin } = useMultiTenant();

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    const key = initialCategory 
      ? `pos_menu_indus_${initialCategory.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '')}`
      : 'pos_menu_indus';
    
    const saved = localStorage.getItem(key);
    if (saved) {
      setMenuItems(JSON.parse(saved));
    } else {
      setMenuItems(DEFAULT_INDUS_DATA.filter(item => !initialCategory || item.category === initialCategory));
    }
  }, [isOpen, initialCategory]);

  const saveMenu = (updatedItems: MenuItem[]) => {
    const key = initialCategory 
      ? `pos_menu_indus_${initialCategory.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '')}`
      : 'pos_menu_indus';
    setMenuItems(updatedItems);
    localStorage.setItem(key, JSON.stringify(updatedItems));
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
    } else if (field === 'Half' || field === 'Full') {
      updated[index] = { 
        ...updated[index], 
        sizes: { 
          ...(updated[index].sizes || { Half: 0, Full: 0 }), 
          [field]: Number(value) 
        } 
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    saveMenu(updated);
  };

  const handleAddNewItem = () => {
    const newItem: MenuItem = {
      name: "New Item",
      category: selectedCategory === 'all' ? (categories[0] || 'GENERAL') : selectedCategory,
      price: 0
    };
    const updated = [...menuItems, newItem];
    saveMenu(updated);
    toast.success('New item added');
  };

  const handleRemoveItem = (index: number) => {
    const updated = menuItems.filter((_, i) => i !== index);
    saveMenu(updated);
    toast.success('Item removed');
  };

  const handleAddItem = (item: MenuItem, size?: 'Half' | 'Full') => {
    if (isEditingMode) return;

    const price = size ? item.sizes?.[size] : item.price;
    const name = size ? `${item.name} (${size})` : item.name;

    const product = {
      id: `indus-${item.category.toLowerCase().replace(/\s+/g, '-')}-${item.name.toLowerCase().replace(/\s+/g, '-')}${size ? `-${size.toLowerCase()}` : ''}`,
      name,
      price: price || 0,
      category: item.category,
      image: '🍲',
      sku: `IND-${item.name.substring(0, 3).toUpperCase()}${size ? `-${size[0]}` : ''}`,
    };

    onAdd(product);
    toast.success(`${name} added to cart`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setIsEditingMode(false);
        onClose();
      }
    }}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border-none rounded-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl [&>button]:hidden">
        {/* Header */}
        <div className="bg-slate-900 bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5 text-white shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Utensils className="h-7 w-7 text-blue-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight">
                    {selectedCategory === 'all' ? 'Cafe Indus Menu' : `${selectedCategory} Menu`}
                  </DialogTitle>
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isEditingMode ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-white/10 text-white hover:bg-white/20"
                      )}
                      onClick={() => setIsEditingMode(!isEditingMode)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  {isEditingMode ? "ADMIN MODE: EDITING ITEMS" : "Exclusive Menu for Cafe Indus"}
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/10 border-none text-white placeholder:text-slate-500 pl-10 h-11 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
              />
            </div>
            {!initialCategory && (
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-white/10 border-none text-white px-4 rounded-xl text-sm focus:ring-1 focus:ring-white/20 outline-none"
              >
                <option value="all" className="bg-slate-800">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-slate-800">{cat}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item, index) => {
              // Find the original index in menuItems to update correctly
              const originalIndex = menuItems.findIndex(mi => mi.name === item.name && mi.category === item.category);
              
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.1 }}
                  key={`${item.category}-${item.name}-${index}`}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
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

                  <div className="flex gap-2">
                    {isEditingMode ? (
                      <div className="w-full space-y-2">
                        {item.sizes ? (
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Half</label>
                              <Input 
                                type="number"
                                value={item.sizes.Half} 
                                onChange={(e) => handleUpdateItem(originalIndex, 'Half', e.target.value)}
                                className="h-9 text-xs font-black"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Full</label>
                              <Input 
                                type="number"
                                value={item.sizes.Full} 
                                onChange={(e) => handleUpdateItem(originalIndex, 'Full', e.target.value)}
                                className="h-9 text-xs font-black"
                              />
                            </div>
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
                        <Button 
                          onClick={() => handleAddItem(item, 'Half')}
                          className="flex-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-900 border-none rounded-xl h-10 font-bold transition-all"
                        >
                          Half (Rs. {item.sizes.Half})
                        </Button>
                        <Button 
                          onClick={() => handleAddItem(item, 'Full')}
                          className="flex-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-900 border-none rounded-xl h-10 font-bold transition-all"
                        >
                          Full (Rs. {item.sizes.Full})
                        </Button>
                      </>
                    ) : (
                      <Button 
                        onClick={() => handleAddItem(item)}
                        className="w-full bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-900 border-none rounded-xl h-10 font-bold transition-all"
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
            <Button 
              variant="outline" 
              className="w-full mt-6 border-dashed border-2 h-14 rounded-2xl text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
              onClick={handleAddNewItem}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add New Item to Menu
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
