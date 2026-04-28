import { useState, useMemo, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Edit2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Product } from '@/stores/cartStore';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

interface ArabicBroastModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAdd: (product: Product) => void;
}

const ArabicBroastModal = ({ isOpen, onClose, products, onAdd }: ArabicBroastModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { isAdmin } = useMultiTenant();
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [menuItems, setMenuItems] = useState<Product[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('pos_menu_arabic_broast');
    if (saved) {
      setMenuItems(JSON.parse(saved));
    } else {
      setMenuItems(products);
    }
  }, [isOpen, products]);

  const saveMenu = (updated: Product[]) => {
    setMenuItems(updated);
    localStorage.setItem('pos_menu_arabic_broast', JSON.stringify(updated));
  };

  const handleUpdateItem = (index: number, field: keyof Product, value: any) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], [field]: field === 'price' ? Number(value) : value };
    saveMenu(updated);
  };

  const handleAddItem = () => {
    const newItem: Product = {
      id: `arabic-broast-${Date.now()}`,
      name: "New Broast Item",
      price: 0,
      category: 'Arabic Broast',
      image: '🍗',
      sku: `ARB-${Date.now().toString().slice(-4)}`
    };
    const updated = [...menuItems, newItem];
    saveMenu(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = menuItems.filter((_, i) => i !== index);
    saveMenu(updated);
    toast.success('Item removed');
  };

  const filteredItems = useMemo(() => {
    return menuItems.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [menuItems, searchQuery]);

  const broastItems = filteredItems.filter(p => !p.name.toUpperCase().includes('COMBO'));
  const combos = filteredItems.filter(p => p.name.toUpperCase().includes('COMBO'));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setIsEditingMode(false);
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border-none rounded-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl [&>button]:hidden">
        {/* Header Section */}
        <div className="bg-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-5 text-white shrink-0 relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Arabic Broast</DialogTitle>
                {isAdmin && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "h-8 w-8 rounded-full",
                      isEditingMode ? "bg-white text-emerald-600 hover:bg-white/90" : "bg-white/10 text-white hover:bg-white/20"
                    )}
                    onClick={() => setIsEditingMode(!isEditingMode)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <DialogDescription className="text-emerald-50/80 text-xs font-bold uppercase tracking-widest mt-0.5">
                {isEditingMode ? "ADMIN MODE: EDITING ITEMS" : "Authentic Spicy Injected Broast"}
              </DialogDescription>
            </div>
            <button 
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-90 z-50"
            >
              <Plus className="h-6 w-6 rotate-45" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-100/50" />
            <Input
              placeholder="Search items or combos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border-none text-white placeholder:text-emerald-100/50 pl-10 h-11 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 custom-scrollbar">
          <div className="p-6 space-y-8">
            {/* Broast Items Section */}
            {broastItems.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Broast Items</h3>
                </div>
                <div className="grid gap-2.5">
                  {broastItems.map((item, index) => {
                    const originalIndex = menuItems.findIndex(mi => mi.id === item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => !isEditingMode && onAdd(item)}
                        className={cn(
                          "group flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 transition-all text-left",
                          !isEditingMode && "hover:bg-emerald-50 hover:border-emerald-200 shadow-sm hover:shadow-md cursor-pointer"
                        )}
                      >
                        <div className="flex-1 pr-4">
                          {isEditingMode ? (
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                                onClick={() => handleRemoveItem(originalIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Input 
                                value={item.name} 
                                onChange={(e) => handleUpdateItem(originalIndex, 'name', e.target.value)}
                                className="h-9 text-sm font-bold"
                              />
                            </div>
                          ) : (
                            <p className="font-bold text-slate-800 text-[15px] group-hover:text-emerald-700 transition-colors">{item.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-5 shrink-0">
                          {isEditingMode ? (
                            <Input 
                              type="number"
                              value={item.price} 
                              onChange={(e) => handleUpdateItem(originalIndex, 'price', e.target.value)}
                              className="h-9 w-24 text-sm font-black"
                            />
                          ) : (
                            <>
                              <span className="font-black text-slate-900 text-base">Rs {item.price.toLocaleString()}</span>
                              <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
                                <Plus className="h-4 w-4 text-slate-400 group-hover:text-white" />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Combos Section */}
            {combos.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Exclusive Combos</h3>
                </div>
                <div className="grid gap-2.5">
                  {combos.map((item, index) => {
                    const originalIndex = menuItems.findIndex(mi => mi.id === item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => !isEditingMode && onAdd(item)}
                        className={cn(
                          "group flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 transition-all text-left",
                          !isEditingMode && "hover:bg-emerald-50 hover:border-emerald-200 shadow-sm hover:shadow-md cursor-pointer"
                        )}
                      >
                        <div className="flex-1 pr-4">
                          {isEditingMode ? (
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                                onClick={() => handleRemoveItem(originalIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Input 
                                value={item.name} 
                                onChange={(e) => handleUpdateItem(originalIndex, 'name', e.target.value)}
                                className="h-9 text-sm font-bold"
                              />
                            </div>
                          ) : (
                            <>
                              <p className="font-black text-emerald-600 text-[15px] group-hover:text-emerald-700 transition-colors mb-1">{item.name}</p>
                              {(item as any).description && (
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">{(item as any).description}</p>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-5 shrink-0">
                          {isEditingMode ? (
                            <Input 
                              type="number"
                              value={item.price} 
                              onChange={(e) => handleUpdateItem(originalIndex, 'price', e.target.value)}
                              className="h-9 w-24 text-sm font-black"
                            />
                          ) : (
                            <>
                              <span className="font-black text-slate-900 text-base whitespace-nowrap">Rs {item.price.toLocaleString()}</span>
                              <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
                                <Plus className="h-4 w-4 text-slate-400 group-hover:text-white" />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isEditingMode && (
              <Button 
                variant="outline" 
                className="w-full h-14 border-dashed border-2 border-slate-200 text-slate-500 hover:border-emerald-500 hover:text-emerald-500 rounded-2xl font-bold uppercase tracking-widest text-xs"
                onClick={handleAddItem}
              >
                <Plus className="h-5 w-5 mr-2" />
                Add New Broast Item
              </Button>
            )}

            {filteredItems.length === 0 && !isEditingMode && (
              <div className="text-center py-16">
                <div className="bg-slate-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-bold">No items found matching your search</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer Section */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">
            {isEditingMode ? "Changes are saved automatically" : "Tap an item to add to cart"}
          </p>
          <Button 
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-xl px-10 h-11 transition-all hover:scale-105 active:scale-95"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ArabicBroastModal;

export default ArabicBroastModal;