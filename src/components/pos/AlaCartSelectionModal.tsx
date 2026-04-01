import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Utensils, Edit2, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';

interface AlaCartSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: any) => void;
}

interface AlaCartItem {
  name: string;
  price: number;
}

const DEFAULT_ALACART_DATA: AlaCartItem[] = [
  { name: "Extra Patty", price: 150 },
  { name: "Extra Cheese Slice", price: 50 },
  { name: "Extra Dip Sauce", price: 40 },
  { name: "Coleslaw", price: 80 },
  { name: "Bun", price: 60 },
];

export default function AlaCartSelectionModal({ isOpen, onClose, onAdd }: AlaCartSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [quantityPrefix, setQuantityPrefix] = useState<string>('');
  const { isAdmin } = useMultiTenant();
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [menuItems, setMenuItems] = useState<AlaCartItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('pos_menu_alacart');
    if (saved) {
      setMenuItems(JSON.parse(saved));
    } else {
      setMenuItems(DEFAULT_ALACART_DATA);
    }
  }, [isOpen]);

  const saveMenu = (updatedItems: AlaCartItem[]) => {
    setMenuItems(updatedItems);
    localStorage.setItem('pos_menu_alacart', JSON.stringify(updatedItems));
  };

  const handleUpdateItem = (index: number, field: keyof AlaCartItem, value: string | number) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], [field]: field === 'price' ? Number(value) : value };
    saveMenu(updated);
  };

  const handleAddItem = () => {
    const updated = [...menuItems, { name: "New Ala Cart Item", price: 0 }];
    saveMenu(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = menuItems.filter((_, i) => i !== index);
    saveMenu(updated);
    toast.success('Item removed');
  };

  const filteredItems = menuItems.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddProduct = (item: AlaCartItem) => {
    if (isEditingMode) return;
    const qty = parseInt(quantityPrefix) || 1;
    const product = {
      id: `alacart-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
      name: item.name,
      price: item.price,
      category: 'Ala Cart',
      image: '🍽️',
      sku: `ALA-${item.name.substring(0,3).toUpperCase()}`,
      quantity: qty
    };
    
    for (let i = 0; i < qty; i++) {
      onAdd(product);
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
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border-none rounded-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl [&>button]:hidden" aria-describedby="alacart-selection-description">
        {/* Header */}
        <div className="bg-emerald-900 bg-gradient-to-br from-emerald-900 to-emerald-800 px-6 py-5 text-white shrink-0 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Utensils className="h-7 w-7 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight">Ala Cart Menu</DialogTitle>
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isEditingMode ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-white/10 text-white hover:bg-white/20"
                      )}
                      onClick={() => setIsEditingMode(!isEditingMode)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <DialogDescription id="alacart-selection-description" className="text-emerald-300 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  {isEditingMode ? "ADMIN MODE: EDITING ITEMS" : "Individual Side Items & Add-ons"}
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-400" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border-none text-white placeholder:text-emerald-400 pl-10 h-11 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
            />
          </div>

          {/* Number Pad */}
          {!isEditingMode && (
            <div className="mt-4 bg-white/10 p-2 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Select Quantity</span>
                {quantityPrefix && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black bg-white text-emerald-900 px-2 py-0.5 rounded-full animate-pulse">
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
                        ? "bg-white text-emerald-900 shadow-lg shadow-black/10" 
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 custom-scrollbar">
          <div className="p-6 grid grid-cols-1 gap-3">
            {filteredItems.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "group flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all",
                  !isEditingMode && "hover:bg-slate-50 hover:border-slate-300 hover:shadow-md cursor-pointer"
                )}
                onClick={() => !isEditingMode && handleAddProduct(item)}
              >
                <div className="flex-1 pr-4">
                  {isEditingMode ? (
                    <div className="flex gap-2">
                      <Input 
                        value={item.name} 
                        onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                        className="h-9 text-sm font-bold"
                      />
                      <Input 
                        type="number"
                        value={item.price} 
                        onChange={(e) => handleUpdateItem(index, 'price', e.target.value)}
                        className="h-9 w-24 text-sm font-black"
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(index);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="font-bold font-heading text-slate-800 text-[15px] group-hover:text-slate-900 transition-colors tracking-tight">{item.name}</p>
                  )}
                </div>
                {!isEditingMode && (
                  <div className="flex items-center gap-5 shrink-0">
                    <span className="font-black font-heading text-slate-900 text-base tracking-tight">Rs {item.price}</span>
                    <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
                      <Plus className="h-4 w-4 text-slate-400 group-hover:text-white" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isEditingMode && (
              <Button 
                variant="outline" 
                className="w-full h-12 border-dashed border-2 border-slate-200 text-slate-500 hover:border-emerald-500 hover:text-emerald-500 rounded-2xl font-bold uppercase tracking-widest text-xs"
                onClick={handleAddItem}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Item
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
