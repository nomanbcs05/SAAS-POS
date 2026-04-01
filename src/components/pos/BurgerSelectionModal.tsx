import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Utensils, ChefHat, Edit2, Save, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';

interface BurgerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: any) => void;
}

interface BurgerItem {
  name: string;
  price: number;
}

const DEFAULT_BURGER_DATA: BurgerItem[] = [
  { name: "Premium Spicy Zinger Burger", price: 450 },
  { name: "Peri Peri Sauce Burger", price: 450 },
  { name: "Creamy Mild Burger", price: 430 },
  { name: "Tangy Burger", price: 430 },
  { name: "Zinger Burger", price: 380 },
  { name: "Mighty Zinger Burger with Cheese", price: 700 },
  { name: "Zinger Tower Burger", price: 850 },
  { name: "Pizza Zinger Burger", price: 500 },
  { name: "Chicken Chapli Kabab Burger", price: 300 },
  { name: "Patty Burger", price: 250 },
];

export default function BurgerSelectionModal({ isOpen, onClose, onAdd }: BurgerSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [quantityPrefix, setQuantityPrefix] = useState<string>('');
  const { isAdmin } = useMultiTenant();
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [menuItems, setMenuItems] = useState<BurgerItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('pos_menu_burger');
    if (saved) {
      setMenuItems(JSON.parse(saved));
    } else {
      setMenuItems(DEFAULT_BURGER_DATA);
    }
  }, [isOpen]);

  const saveMenu = (updatedItems: BurgerItem[]) => {
    setMenuItems(updatedItems);
    localStorage.setItem('pos_menu_burger', JSON.stringify(updatedItems));
  };

  const handleUpdateItem = (index: number, field: keyof BurgerItem, value: string | number) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], [field]: field === 'price' ? Number(value) : value };
    saveMenu(updated);
  };

  const handleAddItem = () => {
    const updated = [...menuItems, { name: "New Burger", price: 0 }];
    saveMenu(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = menuItems.filter((_, i) => i !== index);
    saveMenu(updated);
    toast.success('Item removed');
  };

  const filteredBurgers = menuItems.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddBurger = (burger: BurgerItem) => {
    if (isEditingMode) return;
    const qty = parseInt(quantityPrefix) || 1;
    const burgerProduct = {
      id: `burger-${burger.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: burger.name,
      price: burger.price,
      category: 'Burgers',
      image: '🍔',
      sku: `BGR-${burger.name.substring(0,3).toUpperCase()}`,
      quantity: qty
    };
    
    for (let i = 0; i < qty; i++) {
      onAdd(burgerProduct);
    }
    
    setQuantityPrefix('');
  };

  const handleNumberClick = (num: number) => {
    setQuantityPrefix(prev => {
      const newPrefix = prev + num.toString();
      return newPrefix.length > 2 ? newPrefix.slice(-2) : newPrefix;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setIsEditingMode(false);
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border-none rounded-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl [&>button]:hidden" aria-describedby="burger-selection-description">
        {/* Header */}
        <div className="bg-red-600 bg-gradient-to-br from-red-600 to-rose-700 px-6 py-5 text-white shrink-0 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <ChefHat className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight">Burgers Menu</DialogTitle>
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isEditingMode ? "bg-white text-red-600 hover:bg-white/90" : "bg-white/10 text-white hover:bg-white/20"
                      )}
                      onClick={() => setIsEditingMode(!isEditingMode)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <DialogDescription id="burger-selection-description" className="text-red-50/80 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  {isEditingMode ? "ADMIN MODE: EDITING ITEMS" : "Premium & Juicy Burgers"}
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

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-red-100/50" />
            <Input
              placeholder="Search burgers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border-none text-white placeholder:text-red-100/50 pl-10 h-11 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 custom-scrollbar">
          <div className="p-6">
            <div className="grid gap-2.5">
              {filteredBurgers.map((burger, index) => {
                const originalIndex = menuItems.findIndex(m => m.name === burger.name);
                return (
                  <div
                    key={index}
                    className={cn(
                      "group flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all",
                      !isEditingMode && "hover:bg-red-50 hover:border-red-200 hover:shadow-md cursor-pointer"
                    )}
                    onClick={() => !isEditingMode && handleAddBurger(burger)}
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
                            value={burger.name} 
                            onChange={(e) => handleUpdateItem(originalIndex, 'name', e.target.value)}
                            className="h-9 text-sm font-bold"
                          />
                          <Input 
                            type="number"
                            value={burger.price} 
                            onChange={(e) => handleUpdateItem(originalIndex, 'price', e.target.value)}
                            className="h-9 w-24 text-sm font-black"
                          />
                        </div>
                      ) : (
                        <p className="font-bold font-heading text-slate-800 text-[15px] group-hover:text-red-700 transition-colors tracking-tight">{burger.name}</p>
                      )}
                    </div>
                    {!isEditingMode && (
                      <div className="flex items-center gap-5 shrink-0">
                        <span className="font-black font-heading text-slate-900 text-base tracking-tight">Rs {burger.price}</span>
                        <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-red-500 flex items-center justify-center transition-colors">
                          <Plus className="h-4 w-4 text-slate-400 group-hover:text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {isEditingMode && (
                <Button 
                  variant="outline" 
                  className="mt-4 border-dashed border-2 h-14 rounded-2xl text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 font-bold"
                  onClick={handleAddItem}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add New Burger
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Numpad */}
        {!isEditingMode && (
          <div className="bg-white border-t p-6 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Select Quantity</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Qty:</span>
                <div className="bg-slate-100 px-3 py-1 rounded-lg font-black text-slate-900 min-w-[40px] text-center">
                  {quantityPrefix || '1'}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className={cn(
                    "h-12 text-lg font-black rounded-xl border-slate-200 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-95",
                    quantityPrefix === num.toString() && "bg-red-500 text-white border-red-500"
                  )}
                  onClick={() => handleNumberClick(num)}
                >
                  {num}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button 
                variant="outline" 
                className="h-12 font-bold uppercase tracking-wider rounded-xl border-slate-200"
                onClick={() => setQuantityPrefix('')}
              >
                Clear Qty
              </Button>
              <Button 
                className="h-12 bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-slate-200"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
