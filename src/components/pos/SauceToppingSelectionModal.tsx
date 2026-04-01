import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Droplets, Layers, Edit2, Save, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';

interface SauceToppingSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: any) => void;
}

interface Item {
  name: string;
  price: number;
  type: 'sauce' | 'topping';
}

const DEFAULT_SAUCES: Item[] = [
  { name: "Special Sauce", price: 100, type: 'sauce' },
  { name: "Peri Peri Sauce", price: 70, type: 'sauce' },
  { name: "Garlic Mayo Sauce", price: 50, type: 'sauce' },
  { name: "Dip Mayo Sauce", price: 50, type: 'sauce' },
  { name: "Ketchup Dip", price: 50, type: 'sauce' },
  { name: "Mayo Dip", price: 50, type: 'sauce' },
  { name: "Green Chatni", price: 30, type: 'sauce' },
  { name: "Raita", price: 30, type: 'sauce' },
];

const DEFAULT_TOPPINGS: Item[] = [
  { name: "Cheese 30 Grams", price: 100, type: 'topping' },
  { name: "Meat 50 Grams", price: 100, type: 'topping' },
  { name: "Cheese Slice", price: 50, type: 'topping' },
  { name: "Plain Paratha", price: 50, type: 'topping' },
  { name: "Bun", price: 30, type: 'topping' },
];

export default function SauceToppingSelectionModal({ isOpen, onClose, onAdd }: SauceToppingSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'sauces' | 'toppings'>('sauces');
  const { isAdmin } = useMultiTenant();
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [sauceItems, setSauceItems] = useState<Item[]>([]);
  const [toppingItems, setToppingItems] = useState<Item[]>([]);

  useEffect(() => {
    const savedSauces = localStorage.getItem('pos_menu_sauce');
    const savedToppings = localStorage.getItem('pos_menu_topping');
    
    if (savedSauces) setSauceItems(JSON.parse(savedSauces));
    else setSauceItems(DEFAULT_SAUCES);
    
    if (savedToppings) setToppingItems(JSON.parse(savedToppings));
    else setToppingItems(DEFAULT_TOPPINGS);
  }, [isOpen]);

  const saveSauces = (updated: Item[]) => {
    setSauceItems(updated);
    localStorage.setItem('pos_menu_sauce', JSON.stringify(updated));
  };

  const saveToppings = (updated: Item[]) => {
    setToppingItems(updated);
    localStorage.setItem('pos_menu_topping', JSON.stringify(updated));
  };

  const handleUpdateItem = (index: number, field: keyof Item, value: any) => {
    if (activeTab === 'sauces') {
      const updated = [...sauceItems];
      updated[index] = { ...updated[index], [field]: field === 'price' ? Number(value) : value };
      saveSauces(updated);
    } else {
      const updated = [...toppingItems];
      updated[index] = { ...updated[index], [field]: field === 'price' ? Number(value) : value };
      saveToppings(updated);
    }
  };

  const handleAddItem = () => {
    if (activeTab === 'sauces') {
      const updated = [...sauceItems, { name: "New Sauce", price: 0, type: 'sauce' as const }];
      saveSauces(updated);
    } else {
      const updated = [...toppingItems, { name: "New Topping", price: 0, type: 'topping' as const }];
      saveToppings(updated);
    }
  };

  const handleRemoveItem = (index: number) => {
    if (activeTab === 'sauces') {
      const updated = sauceItems.filter((_, i) => i !== index);
      saveSauces(updated);
    } else {
      const updated = toppingItems.filter((_, i) => i !== index);
      saveToppings(updated);
    }
    toast.success('Item removed');
  };

  const filteredSauces = sauceItems.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredToppings = toppingItems.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddToCart = (item: Item) => {
    if (isEditingMode) return;
    const product = {
      id: `${item.type}-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: item.name,
      price: item.price,
      category: item.type === 'sauce' ? 'Sauces' : 'Toppings',
      image: item.type === 'sauce' ? '🥣' : '🧀',
      sku: `${item.type === 'sauce' ? 'SAU' : 'TOP'}-${item.name.substring(0,3).toUpperCase()}`
    };
    onAdd(product);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setIsEditingMode(false);
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border-none rounded-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl [&>button]:hidden">
        {/* Header */}
        <div className="bg-yellow-500 bg-gradient-to-br from-yellow-500 to-amber-600 px-6 py-5 text-white shrink-0 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Droplets className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight">Sauces & Toppings</DialogTitle>
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isEditingMode ? "bg-white text-yellow-600 hover:bg-white/90" : "bg-white/10 text-white hover:bg-white/20"
                      )}
                      onClick={() => setIsEditingMode(!isEditingMode)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <DialogDescription className="text-yellow-100 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  {isEditingMode ? "ADMIN MODE: EDITING ITEMS" : "Extra Flavours & Add-ons"}
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-800/50" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/20 border-none text-white placeholder:text-yellow-800/50 pl-10 h-11 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="sauces" className="flex-1 flex flex-col overflow-hidden" onValueChange={(v) => setActiveTab(v as any)}>
          <div className="px-6 pt-4 bg-white shrink-0">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-2xl h-12">
              <TabsTrigger 
                value="sauces" 
                className="rounded-xl font-black font-heading text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-yellow-600 data-[state=active]:shadow-sm transition-all"
              >
                <Droplets className="h-4 w-4 mr-2" />
                Sauces
              </TabsTrigger>
              <TabsTrigger 
                value="toppings" 
                className="rounded-xl font-black font-heading text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-yellow-600 data-[state=active]:shadow-sm transition-all"
              >
                <Layers className="h-4 w-4 mr-2" />
                Toppings
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
            <TabsContent value="sauces" className="m-0 p-6 pt-4">
              <div className="grid grid-cols-1 gap-2.5">
                {filteredSauces.map((item, index) => {
                  const originalIndex = sauceItems.findIndex(s => s.name === item.name);
                  return (
                    <div
                      key={index}
                      className={cn(
                        "group flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all",
                        !isEditingMode && "hover:bg-yellow-50 hover:border-yellow-200 hover:shadow-md cursor-pointer"
                      )}
                      onClick={() => !isEditingMode && handleAddToCart(item)}
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
                            <Input 
                              type="number"
                              value={item.price} 
                              onChange={(e) => handleUpdateItem(originalIndex, 'price', e.target.value)}
                              className="h-9 w-24 text-sm font-black"
                            />
                          </div>
                        ) : (
                          <p className="font-bold font-heading text-slate-800 text-[15px] group-hover:text-yellow-700 transition-colors tracking-tight">{item.name}</p>
                        )}
                      </div>
                      {!isEditingMode && (
                        <div className="flex items-center gap-5 shrink-0">
                          <span className="font-black font-heading text-slate-900 text-base tracking-tight">Rs {item.price}</span>
                          <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-yellow-500 flex items-center justify-center transition-colors">
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
                    className="mt-4 border-dashed border-2 h-14 rounded-2xl text-slate-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 font-bold"
                    onClick={handleAddItem}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add New Sauce
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="toppings" className="m-0 p-6 pt-4">
              <div className="grid grid-cols-1 gap-2.5">
                {filteredToppings.map((item, index) => {
                  const originalIndex = toppingItems.findIndex(t => t.name === item.name);
                  return (
                    <div
                      key={index}
                      className={cn(
                        "group flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all",
                        !isEditingMode && "hover:bg-yellow-50 hover:border-yellow-200 hover:shadow-md cursor-pointer"
                      )}
                      onClick={() => !isEditingMode && handleAddToCart(item)}
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
                            <Input 
                              type="number"
                              value={item.price} 
                              onChange={(e) => handleUpdateItem(originalIndex, 'price', e.target.value)}
                              className="h-9 w-24 text-sm font-black"
                            />
                          </div>
                        ) : (
                          <p className="font-bold text-slate-800 text-[15px] group-hover:text-yellow-700 transition-colors">{item.name}</p>
                        )}
                      </div>
                      {!isEditingMode && (
                        <div className="flex items-center gap-5 shrink-0">
                          <span className="font-black text-slate-900 text-base">Rs {item.price}</span>
                          <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-yellow-500 flex items-center justify-center transition-colors">
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
                    className="mt-4 border-dashed border-2 h-14 rounded-2xl text-slate-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 font-bold"
                    onClick={handleAddItem}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add New Topping
                  </Button>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">
            {isEditingMode ? "Changes are saved automatically" : "Tap an item to add to cart"}
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
