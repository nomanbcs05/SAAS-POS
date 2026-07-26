import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Utensils, Edit2, Trash2, ImagePlus, Loader2, Save, X, Flame, ChefHat, Coffee, Layers, Package } from 'lucide-react';
import { cn } from "@/lib/utils";
import { api } from '@/services/api';
import { useMutation } from '@tanstack/react-query';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface GenXRestaurantMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: any, quantity?: number) => void;
  categoryName?: string;
  menuKey?: string;
  iconName?: string;
}

interface MenuItem {
  name: string;
  price?: number;
  image?: string;
  sizes?: Record<string, number>;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Flame: <Flame className="h-7 w-7 text-orange-300" />,
  ChefHat: <ChefHat className="h-7 w-7 text-amber-300" />,
  Coffee: <Coffee className="h-7 w-7 text-yellow-300" />,
  Layers: <Layers className="h-7 w-7 text-green-300" />,
  Utensils: <Utensils className="h-7 w-7 text-blue-300" />,
  Package: <Package className="h-7 w-7 text-purple-300" />,
};

const HEADER_GRADIENTS: Record<string, string> = {
  Flame: 'from-orange-900 via-red-900 to-orange-800',
  ChefHat: 'from-amber-900 via-yellow-900 to-amber-800',
  Coffee: 'from-yellow-900 via-amber-900 to-yellow-800',
  Layers: 'from-green-900 via-emerald-900 to-green-800',
  Utensils: 'from-blue-900 via-indigo-900 to-blue-800',
  Package: 'from-purple-900 via-violet-900 to-purple-800',
};

const ACCENT_COLORS: Record<string, string> = {
  Flame: '#f97316',
  ChefHat: '#f59e0b',
  Coffee: '#eab308',
  Layers: '#22c55e',
  Utensils: '#3b82f6',
  Package: '#a855f7',
};

export default function GenXRestaurantMenuModal({
  isOpen,
  onClose,
  onAdd,
  categoryName = 'Menu',
  menuKey = '',
  iconName = 'Flame',
}: GenXRestaurantMenuModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categoryImage, setCategoryImage] = useState<string>('');
  const { isAdmin } = useMultiTenant();

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
        if (menuKey) localStorage.setItem('pos_category_image_' + menuKey, url);
        toast.success("Category image uploaded");
      } catch (_) {}
    }
  };

  // Load items from localStorage on open
  useEffect(() => {
    if (!isOpen || !menuKey) return;
    const saved = localStorage.getItem(menuKey);
    if (saved) {
      try {
        setMenuItems(JSON.parse(saved));
      } catch {
        setMenuItems([]);
      }
    }
    const savedImg = localStorage.getItem('pos_category_image_' + menuKey);
    if (savedImg) setCategoryImage(savedImg);
  }, [isOpen, menuKey]);

  const handleSaveEdits = () => {
    if (menuKey) {
      localStorage.setItem(menuKey, JSON.stringify(menuItems));
      toast.success('Menu saved!');
    }
    setIsEditingMode(false);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updated = [...menuItems];
    if (field === 'price') {
      updated[index] = { ...updated[index], price: Number(value) };
    } else if (updated[index].sizes && updated[index].sizes![field] !== undefined) {
      updated[index] = {
        ...updated[index],
        sizes: { ...updated[index].sizes!, [field]: Number(value) }
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setMenuItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setMenuItems(menuItems.filter((_, i) => i !== index));
  };

  const handleAddNewItem = () => {
    setMenuItems([...menuItems, { name: 'New Item', price: 0 }]);
  };

  const handleAddItemImage = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const updated = [...menuItems];
      updated[index] = { ...updated[index], image: reader.result as string };
      setMenuItems(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleAddItem = (item: MenuItem, size?: string) => {
    if (isEditingMode) return;
    const price = size ? item.sizes?.[size] : item.price;
    const name = size ? `${item.name} (${size})` : item.name;
    const product = {
      id: `genx-${menuKey}-${item.name.toLowerCase().replace(/\s+/g, '-')}${size ? `-${size.toLowerCase()}` : ''}`,
      name,
      price: price || 0,
      category: categoryName,
      image: item.image || '🍽️',
      sku: `GX-${item.name.substring(0, 3).toUpperCase()}${size ? `-${size[0]}` : ''}`,
    };
    onAdd(product, selectedQuantity);
    toast.success(`${name} (${selectedQuantity}x) added to cart`);
  };

  const cancelEditing = () => {
    const saved = menuKey ? localStorage.getItem(menuKey) : null;
    if (saved) setMenuItems(JSON.parse(saved));
    setIsEditingMode(false);
  };

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const gradientClass = HEADER_GRADIENTS[iconName] || HEADER_GRADIENTS.Flame;
  const accentColor = ACCENT_COLORS[iconName] || ACCENT_COLORS.Flame;
  const iconNode = CATEGORY_ICONS[iconName] || CATEGORY_ICONS.Flame;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setIsEditingMode(false); onClose(); } }}>
      <DialogContent className={cn("max-w-4xl p-0 overflow-hidden bg-white border-none rounded-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl [&>button]:hidden")}>
        {/* Header */}
        <div className={cn("bg-gradient-to-br px-6 py-5 text-white shrink-0", gradientClass)}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg relative overflow-hidden group">
                {categoryImage ? (
                  <img src={categoryImage} alt="Category" className="h-7 w-7 object-cover rounded-md" />
                ) : (
                  iconNode
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
                    {categoryName}
                  </DialogTitle>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isEditingMode ? "bg-red-500 text-white hover:bg-red-600" : "bg-white/10 text-white hover:bg-white/20"
                      )}
                      onClick={() => isEditingMode ? cancelEditing() : setIsEditingMode(true)}
                      title={isEditingMode ? "Cancel Editing" : "Edit Menu"}
                    >
                      {isEditingMode ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                <DialogDescription className="text-white/50 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  {isEditingMode ? "ADMIN MODE: EDITING ITEMS" : "Tap an item to add to cart"}
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

          {/* Search & Qty */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/10 border-none text-white placeholder:text-white/30 pl-10 h-11 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 h-11">
              <button
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 font-bold text-lg transition-all active:scale-90"
                onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
              >−</button>
              <span className="text-white font-black text-lg w-5 text-center">{selectedQuantity}</span>
              <button
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 font-bold text-lg transition-all active:scale-90"
                onClick={() => setSelectedQuantity(selectedQuantity + 1)}
              >+</button>
            </div>
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
          {isEditingMode && (
            <div className="flex gap-2 mb-4">
              <Button
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl"
                onClick={handleAddNewItem}
              >
                <Plus className="h-4 w-4 mr-2" /> Add New Item
              </Button>
              <Button
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl"
                onClick={handleSaveEdits}
              >
                <Save className="h-4 w-4 mr-2" /> Save Changes
              </Button>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-300">
              <Utensils className="h-16 w-16 mb-4 opacity-30" />
              <p className="font-bold text-slate-400">No items found</p>
              <p className="text-sm text-slate-300">Try a different search term</p>
            </div>
          ) : (
            <AnimatePresence>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredItems.map((item, index) => {
                  const originalIndex = menuItems.findIndex(mi => mi.name === item.name && mi.price === item.price);
                  const sizeKeys = item.sizes ? Object.keys(item.sizes) : [];
                  const hasImage = item.image && (item.image.startsWith('http') || item.image.startsWith('data:'));

                  return (
                    <motion.div
                      key={`item-${originalIndex}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.1 }}
                      className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden"
                    >
                      {/* Image placeholder */}
                      <div className="relative w-full h-24 bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {hasImage ? (
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-2xl">🍽️</span>
                            {isEditingMode && (
                              <span className="text-[9px] text-slate-400 font-bold uppercase">Upload Image</span>
                            )}
                          </div>
                        )}
                        {isEditingMode && (
                          <label className="absolute inset-0 cursor-pointer bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                            <ImagePlus className="h-6 w-6 text-white drop-shadow" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleAddItemImage(originalIndex, e)}
                            />
                          </label>
                        )}
                      </div>

                      <div className="p-3 flex flex-col flex-1 justify-between">
                        {isEditingMode ? (
                          <>
                            <Input
                              value={item.name}
                              onChange={(e) => handleUpdateItem(originalIndex, 'name', e.target.value)}
                              className="h-8 text-xs font-bold mb-2"
                              placeholder="Item Name"
                            />
                            {sizeKeys.length > 0 ? (
                              <div className="space-y-1">
                                {sizeKeys.map(sizeKey => (
                                  <div key={sizeKey} className="flex items-center gap-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase w-10 shrink-0">{sizeKey}</span>
                                    <Input
                                      type="number"
                                      value={item.sizes![sizeKey]}
                                      onChange={(e) => handleUpdateItem(originalIndex, sizeKey, e.target.value)}
                                      className="h-7 text-xs font-black flex-1"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <Input
                                type="number"
                                value={item.price}
                                onChange={(e) => handleUpdateItem(originalIndex, 'price', e.target.value)}
                                className="h-7 text-xs font-black"
                                placeholder="Price"
                              />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 h-7 text-red-400 hover:text-red-600 hover:bg-red-50 w-full rounded-lg text-xs"
                              onClick={() => handleRemoveItem(originalIndex)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Remove
                            </Button>
                          </>
                        ) : (
                          <>
                            <h3 className="text-[11px] font-black text-slate-900 leading-tight mb-2 line-clamp-2 uppercase tracking-tight">
                              {item.name}
                            </h3>
                            {sizeKeys.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {sizeKeys.map(sizeKey => (
                                  <button
                                    key={sizeKey}
                                    onClick={() => handleAddItem(item, sizeKey)}
                                    className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 hover:text-white"
                                    style={{
                                      background: '#f8fafc',
                                      border: `1.5px solid ${accentColor}30`,
                                    }}
                                    onMouseEnter={e => {
                                      (e.currentTarget as HTMLButtonElement).style.background = accentColor;
                                      (e.currentTarget as HTMLButtonElement).style.color = 'white';
                                    }}
                                    onMouseLeave={e => {
                                      (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc';
                                      (e.currentTarget as HTMLButtonElement).style.color = '#1e293b';
                                    }}
                                  >
                                    <span>{sizeKey}</span>
                                    <span>Rs. {item.sizes![sizeKey].toLocaleString()}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddItem(item)}
                                className="w-full text-center px-2 py-1.5 rounded-xl text-[10px] font-black transition-all active:scale-95 hover:text-white"
                                style={{
                                  background: '#f8fafc',
                                  border: `1.5px solid ${accentColor}30`,
                                }}
                                onMouseEnter={e => {
                                  (e.currentTarget as HTMLButtonElement).style.background = accentColor;
                                  (e.currentTarget as HTMLButtonElement).style.color = 'white';
                                }}
                                onMouseLeave={e => {
                                  (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc';
                                  (e.currentTarget as HTMLButtonElement).style.color = '#1e293b';
                                }}
                              >
                                Rs. {(item.price || 0).toLocaleString()}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t bg-white flex items-center justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
          </p>
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-xl font-bold"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
