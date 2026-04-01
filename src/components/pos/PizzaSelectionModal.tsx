import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Pizza, ChevronRight, Edit2, Save, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Product } from '@/stores/cartStore';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';

interface PizzaSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: any) => void;
}

const PIZZA_SIZES = ['Small', 'Medium', 'Large', 'Jumbo'] as const;
type PizzaSize = typeof PIZZA_SIZES[number];

interface PizzaFlavor {
  name: string;
  category: 'Classic' | 'Premium';
  prices: Partial<Record<PizzaSize, number>>;
}

const DEFAULT_PIZZA_DATA: PizzaFlavor[] = [
  // Classic Flavors
  { name: "Chicken Fajita", category: 'Classic', prices: { Small: 450, Medium: 800, Large: 1050, Jumbo: 1250 } },
  { name: "Chicken Tikka", category: 'Classic', prices: { Small: 450, Medium: 800, Large: 1050, Jumbo: 1250 } },
  { name: "Bonefire Pizza", category: 'Classic', prices: { Small: 450, Medium: 800, Large: 1050, Jumbo: 1250 } },
  { name: "Creamy Pizza", category: 'Classic', prices: { Small: 450, Medium: 800, Large: 1050, Jumbo: 1250 } },
  { name: "Cheese Lover Pizza", category: 'Classic', prices: { Small: 450, Medium: 800, Large: 1050, Jumbo: 1250 } },
  { name: "Vegetable Lover Pizza", category: 'Classic', prices: { Small: 450, Medium: 800, Large: 1050, Jumbo: 1250 } },
  
  // Premium Flavors
  { name: "Special Crown Crust Pizza", category: 'Premium', prices: { Medium: 1000, Large: 1300, Jumbo: 1500 } },
  { name: "Special Kabab Crown Crust", category: 'Premium', prices: { Medium: 1000, Large: 1300, Jumbo: 1500 } },
  { name: "Special Sauce Crust Pizza", category: 'Premium', prices: { Small: 500, Medium: 1000, Large: 1200, Jumbo: 1400 } },
  { name: "Chicken Supreme Pizza", category: 'Premium', prices: { Small: 500, Medium: 1000, Large: 1200, Jumbo: 1400 } },
  { name: "Zinger Crunchy Pizza", category: 'Premium', prices: { Small: 500, Medium: 1000, Large: 1200, Jumbo: 1400 } },
  { name: "Peri Peri Sauce Pizza", category: 'Premium', prices: { Small: 500, Medium: 1000, Large: 1200, Jumbo: 1400 } },
  { name: "Behari Kabab Pizza", category: 'Premium', prices: { Small: 500, Medium: 1000, Large: 1200, Jumbo: 1400 } },
  { name: "Italian Star Pizza", category: 'Premium', prices: { Small: 500, Medium: 1000, Large: 1200, Jumbo: 1400 } },
  { name: "Special Lava Pizza", category: 'Premium', prices: { Small: 600, Medium: 1000, Large: 1300, Jumbo: 1500 } },
];

export default function PizzaSelectionModal({ isOpen, onClose, onAdd }: PizzaSelectionModalProps) {
  const [activeTab, setActiveTab] = useState<'Classic' | 'Premium'>('Classic');
  const [searchQuery, setSearchQuery] = useState('');
  const [quantityPrefix, setQuantityPrefix] = useState<string>('');
  const { isAdmin } = useMultiTenant();
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [menuItems, setMenuItems] = useState<PizzaFlavor[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('pos_menu_pizza');
    if (saved) {
      setMenuItems(JSON.parse(saved));
    } else {
      setMenuItems(DEFAULT_PIZZA_DATA);
    }
  }, [isOpen]);

  const saveMenu = (updatedItems: PizzaFlavor[]) => {
    setMenuItems(updatedItems);
    localStorage.setItem('pos_menu_pizza', JSON.stringify(updatedItems));
  };

  const handleUpdateItem = (index: number, field: keyof PizzaFlavor | 'prices', value: any, size?: PizzaSize) => {
    const updated = [...menuItems];
    if (field === 'prices' && size) {
      updated[index] = { 
        ...updated[index], 
        prices: { ...updated[index].prices, [size]: Number(value) } 
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    saveMenu(updated);
  };

  const handleAddItem = () => {
    const newItem: PizzaFlavor = { 
      name: "New Pizza", 
      category: activeTab, 
      prices: { Small: 0, Medium: 0, Large: 0, Jumbo: 0 } 
    };
    saveMenu([...menuItems, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = menuItems.filter((_, i) => i !== index);
    saveMenu(updated);
    toast.success('Item removed');
  };

  const filteredFlavors = menuItems.filter(f => 
    f.category === activeTab && 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddPizza = (flavor: string, size: PizzaSize, price: number) => {
    if (isEditingMode) return;
    const qty = parseInt(quantityPrefix) || 1;
    const pizzaProduct = {
      id: `pizza-${flavor.toLowerCase().replace(/\s+/g, '-')}-${size.toLowerCase()}`,
      name: `${flavor} (${size})`,
      price: price,
      category: 'Pizzas',
      image: '🍕',
      sku: `PIZZA-${flavor.substring(0,3).toUpperCase()}-${size.charAt(0)}`,
      quantity: qty
    };
    
    for (let i = 0; i < qty; i++) {
      onAdd(pizzaProduct);
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
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border-none rounded-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl [&>button]:hidden" aria-describedby="pizza-selection-description">
        {/* Header */}
        <DialogHeader className="p-0">
          <div className="bg-orange-500 bg-gradient-to-br from-orange-500 to-red-600 px-6 py-5 text-white shrink-0 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Pizza className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">Pizza Menu</DialogTitle>
                    {isAdmin && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className={cn(
                          "h-8 w-8 rounded-full",
                          isEditingMode ? "bg-white text-orange-600 hover:bg-white/90" : "bg-white/10 text-white hover:bg-white/20"
                        )}
                        onClick={() => setIsEditingMode(!isEditingMode)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <DialogDescription id="pizza-selection-description" className="text-orange-50/80 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                    {isEditingMode ? "ADMIN MODE: EDITING ITEMS" : "Select flavor & size"}
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

          <div className="flex gap-4 items-center mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-100/50" />
              <Input
                placeholder="Search flavors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/10 border-none text-white placeholder:text-orange-100/50 pl-10 h-11 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
              />
            </div>
            <div className="flex bg-black/10 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setActiveTab('Classic')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  activeTab === 'Classic' ? "bg-white text-orange-600 shadow-sm" : "text-white/60 hover:text-white"
                )}
              >
                Classic
              </button>
              <button
                onClick={() => setActiveTab('Premium')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  activeTab === 'Premium' ? "bg-white text-orange-600 shadow-sm" : "text-white/60 hover:text-white"
                )}
              >
                Premium
              </button>
            </div>
          </div>

          {/* Number Pad */}
          {!isEditingMode && (
            <div className="bg-white/10 p-2 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-orange-100/70">Select Quantity</span>
                {quantityPrefix && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black bg-white text-orange-600 px-2 py-0.5 rounded-full animate-pulse">
                      Adding {quantityPrefix} items
                    </span>
                    <button 
                      onClick={() => setQuantityPrefix('')}
                      className="text-[10px] font-bold text-white/50 hover:text-white underline uppercase tracking-tighter"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-10 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                  <button
                    key={num}
                    onClick={() => handleNumberClick(num)}
                    className={cn(
                      "h-9 rounded-lg font-black text-sm transition-all active:scale-90 flex items-center justify-center",
                      quantityPrefix.includes(num.toString()) 
                        ? "bg-white text-orange-600 shadow-lg shadow-black/10" 
                        : "bg-white/10 text-white hover:bg-white/20"
                    )}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogHeader>

        {/* Matrix Header */}
        <div className="grid grid-cols-[1fr,repeat(4,100px)] gap-4 px-8 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Flavour</span>
          {PIZZA_SIZES.map(size => (
            <span key={size} className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
              {size}
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          <div className="divide-y divide-slate-50">
            {filteredFlavors.map((flavor, flavorIndex) => {
              // Find the original index in the menuItems array for saving
              const originalIndex = menuItems.findIndex(m => m.name === flavor.name);
              
              return (
                <div 
                  key={flavorIndex} 
                  className={cn(
                    "grid grid-cols-[1fr,repeat(4,100px)] gap-4 px-8 py-4 items-center transition-colors group",
                    !isEditingMode && "hover:bg-orange-50/30 cursor-pointer"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isEditingMode ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={() => handleRemoveItem(originalIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Input 
                          value={flavor.name}
                          onChange={(e) => handleUpdateItem(originalIndex, 'name', e.target.value)}
                          className="h-9 text-sm font-bold"
                        />
                      </div>
                    ) : (
                      <span className="font-bold font-heading text-slate-800 text-sm group-hover:text-orange-600 transition-colors tracking-tight">
                        {flavor.name}
                      </span>
                    )}
                  </div>

                  {PIZZA_SIZES.map(size => {
                    const price = flavor.prices[size];
                    return (
                      <div key={size} className="flex justify-center">
                        {isEditingMode ? (
                          <Input 
                            type="number"
                            value={price || 0}
                            onChange={(e) => handleUpdateItem(originalIndex, 'prices', e.target.value, size)}
                            className="h-9 text-center font-black text-xs"
                          />
                        ) : price ? (
                          <button
                            onClick={() => handleAddPizza(flavor.name, size, price)}
                            className="w-full h-10 rounded-xl bg-slate-50 hover:bg-orange-600 border border-slate-100 hover:border-orange-500 text-slate-600 hover:text-white transition-all flex flex-col items-center justify-center group/btn active:scale-95 shadow-sm hover:shadow-orange-200"
                          >
                            <span className="text-[11px] font-black font-heading tracking-tight">Rs {price}</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-opacity">Add</span>
                          </button>
                        ) : (
                          <div className="w-full h-10 rounded-xl bg-slate-50/50 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">N/A</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            
            {isEditingMode && (
              <div className="p-8">
                <Button 
                  variant="outline" 
                  className="w-full h-14 border-dashed border-2 rounded-2xl text-slate-400 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50 font-bold"
                  onClick={handleAddItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Flavor to {activeTab}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">
            {isEditingMode ? "Changes are saved automatically" : "Tap a price button to add to cart"}
          </p>
          <Button 
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 rounded-xl h-11"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
