import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Utensils, ChefHat, Edit2, Save, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';

interface RollSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: any) => void;
}

interface RollItem {
  name: string;
  price: number;
  category: 'Special Zinger' | 'Bar BQ';
}

const DEFAULT_ROLL_DATA: RollItem[] = [
  // Special Zinger Rolls
  { name: "Max Roll", price: 300, category: 'Special Zinger' },
  { name: "Special Zinger Cheese Roll", price: 300, category: 'Special Zinger' },
  { name: "Special Zinger Roll", price: 250, category: 'Special Zinger' },
  { name: "Peri Peri Sauce Zinger Roll", price: 250, category: 'Special Zinger' },
  { name: "Special Pizza Roll", price: 450, category: 'Special Zinger' },
  
  // Bar BQ Rolls
  { name: "Chicken Green Boti Roll", price: 250, category: 'Bar BQ' },
  { name: "Chicken Behari Roll", price: 250, category: 'Bar BQ' },
  { name: "Chicken Chatni Roll", price: 250, category: 'Bar BQ' },
  { name: "Chicken Garlic Mayo Roll", price: 250, category: 'Bar BQ' },
  { name: "Chicken Malai Boti Roll", price: 250, category: 'Bar BQ' },
  { name: "Beef Kabab Roll", price: 150, category: 'Bar BQ' },
  { name: "Chicken Kabab Roll", price: 150, category: 'Bar BQ' },
];

export default function RollSelectionModal({ isOpen, onClose, onAdd }: RollSelectionModalProps) {
  const [activeTab, setActiveTab] = useState<'Special Zinger' | 'Bar BQ'>('Special Zinger');
  const [searchQuery, setSearchQuery] = useState('');
  const [quantityPrefix, setQuantityPrefix] = useState<string>('');
  const { isAdmin } = useMultiTenant();
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [menuItems, setMenuItems] = useState<RollItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('pos_menu_roll');
    if (saved) {
      setMenuItems(JSON.parse(saved));
    } else {
      setMenuItems(DEFAULT_ROLL_DATA);
    }
  }, [isOpen]);

  const saveMenu = (updatedItems: RollItem[]) => {
    setMenuItems(updatedItems);
    localStorage.setItem('pos_menu_roll', JSON.stringify(updatedItems));
  };

  const handleUpdateItem = (index: number, field: keyof RollItem, value: string | number) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], [field]: field === 'price' ? Number(value) : value };
    saveMenu(updated);
  };

  const handleAddItem = () => {
    const updated = [...menuItems, { name: "New Roll", price: 0, category: activeTab }];
    saveMenu(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = menuItems.filter((_, i) => i !== index);
    saveMenu(updated);
    toast.success('Item removed');
  };

  const filteredRolls = menuItems.filter(r => 
    r.category === activeTab && 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddRoll = (roll: RollItem) => {
    if (isEditingMode) return;
    const qty = parseInt(quantityPrefix) || 1;
    const rollProduct = {
      id: `roll-${roll.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: roll.name,
      price: roll.price,
      category: 'Rolls',
      image: '🌯',
      sku: `ROLL-${roll.name.substring(0,3).toUpperCase()}`,
      quantity: qty
    };
    
    for (let i = 0; i < qty; i++) {
      onAdd(rollProduct);
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
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border-none rounded-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl [&>button]:hidden" aria-describedby="roll-selection-description">
        {/* Header */}
        <div className="bg-yellow-500 bg-gradient-to-br from-yellow-500 to-amber-600 px-6 py-5 text-white shrink-0 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <ChefHat className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight">Rolls Menu</DialogTitle>
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
                <DialogDescription id="roll-selection-description" className="text-yellow-50/80 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  {isEditingMode ? "ADMIN MODE: EDITING ITEMS" : "Zinger & Bar BQ Special Rolls"}
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-100/50" />
              <Input
                placeholder="Search rolls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white/10 border-none text-white placeholder:text-yellow-100/50 pl-10 h-11 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
              />
            </div>
            <div className="flex bg-black/10 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setActiveTab('Special Zinger')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  activeTab === 'Special Zinger' ? "bg-white text-yellow-600 shadow-sm" : "text-white/60 hover:text-white"
                )}
              >
                Zinger
              </button>
              <button
                onClick={() => setActiveTab('Bar BQ')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  activeTab === 'Bar BQ' ? "bg-white text-yellow-600 shadow-sm" : "text-white/60 hover:text-white"
                )}
              >
                Bar BQ
              </button>
            </div>
          </div>

          {/* Number Pad */}
          {!isEditingMode && (
            <div className="bg-white/10 p-2 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-yellow-100/70">Select Quantity</span>
                {quantityPrefix && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black bg-white text-yellow-600 px-2 py-0.5 rounded-full animate-pulse">
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
                        ? "bg-white text-yellow-600 shadow-lg shadow-black/10" 
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

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 custom-scrollbar">
          <div className="p-6">
            <div className="grid gap-2.5">
              {filteredRolls.map((roll, index) => {
                const originalIndex = menuItems.findIndex(m => m.name === roll.name);
                return (
                  <div
                    key={index}
                    className={cn(
                      "group flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all",
                      !isEditingMode && "hover:bg-yellow-50 hover:border-yellow-200 hover:shadow-md cursor-pointer"
                    )}
                    onClick={() => !isEditingMode && handleAddRoll(roll)}
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
                            value={roll.name} 
                            onChange={(e) => handleUpdateItem(originalIndex, 'name', e.target.value)}
                            className="h-9 text-sm font-bold"
                          />
                          <Input 
                            type="number"
                            value={roll.price} 
                            onChange={(e) => handleUpdateItem(originalIndex, 'price', e.target.value)}
                            className="h-9 w-24 text-sm font-black"
                          />
                        </div>
                      ) : (
                        <p className="font-bold font-heading text-slate-800 text-[15px] group-hover:text-amber-700 transition-colors tracking-tight">{roll.name}</p>
                      )}
                    </div>
                    {!isEditingMode && (
                      <div className="flex items-center gap-5 shrink-0">
                        <span className="font-black font-heading text-slate-900 text-base tracking-tight">Rs {roll.price}</span>
                        <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-amber-500 flex items-center justify-center transition-colors">
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
                  Add New Roll to {activeTab}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">
            {isEditingMode ? "Changes are saved automatically" : "Tap a roll to add to cart"}
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
