import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Tag, Edit2, Save, Trash2, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useMultiTenant } from '@/hooks/useMultiTenant';
import { toast } from 'sonner';

interface DealsSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: any) => void;
}

interface DealItem {
  id: string;
  name: string;
  description: string;
  price: number;
  color: string;
}

const DEFAULT_DEALS: DealItem[] = [
  { id: 'deal-01', name: "DEAL # 01", description: "01 Zinger Burger\n01 345 ml Drink\nWith Fries", price: 380, color: 'bg-black' },
  { id: 'deal-02', name: "DEAL # 02", description: "01 Small Pizza\n01 345 ml Drink", price: 430, color: 'bg-red-600' },
  { id: 'deal-03', name: "DEAL # 03", description: "02 Zinger Roll\n01 500 ml Drink", price: 530, color: 'bg-yellow-500' },
  { id: 'deal-04', name: "DEAL # 04", description: "01 Zinger Burger\n01 Zinger Roll\n02 345 ml Drink", price: 699, color: 'bg-black' },
  { id: 'deal-05', name: "DEAL # 05", description: "01 Zinger Burger\n06 Pcs Wing\n05 Pcs Nuggets\n01 500 ml Drink", price: 899, color: 'bg-red-600' },
  { id: 'deal-06', name: "DEAL # 06", description: "01 Chest Broast\n01 300 ml Drink\nWith Fries", price: 480, color: 'bg-yellow-500' },
  { id: 'deal-07', name: "DEAL # 07", description: "03 Zinger Burger\n01 Ltr Drink\nWith Fries", price: 1099, color: 'bg-yellow-500' },
  { id: 'deal-08', name: "DEAL # 08", description: "01 Large Pizza\n02 Zinger Burger\n02 Zinger Roll\n01 1.5 Ltr Drink", price: 720, color: 'bg-black' },
];

export default function DealsSelectionModal({ isOpen, onClose, onAdd }: DealsSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { isAdmin } = useMultiTenant();
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [menuItems, setMenuItems] = useState<DealItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('pos_menu_deals');
    if (saved) {
      setMenuItems(JSON.parse(saved));
    } else {
      setMenuItems(DEFAULT_DEALS);
    }
  }, [isOpen]);

  const saveMenu = (updatedItems: DealItem[]) => {
    setMenuItems(updatedItems);
    localStorage.setItem('pos_menu_deals', JSON.stringify(updatedItems));
  };

  const handleUpdateItem = (index: number, field: keyof DealItem, value: string | number) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], [field]: field === 'price' ? Number(value) : value };
    saveMenu(updated);
  };

  const handleAddItem = () => {
    const nextId = menuItems.length + 1;
    const updated = [...menuItems, { 
      id: `deal-${nextId.toString().padStart(2, '0')}`, 
      name: `DEAL # ${nextId.toString().padStart(2, '0')}`, 
      description: "Deal items list...", 
      price: 0,
      color: 'bg-black' // Kept for type compatibility but not used in list UI
    }];
    saveMenu(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = menuItems.filter((_, i) => i !== index);
    saveMenu(updated);
    toast.success('Deal removed');
  };

  const filteredDeals = menuItems.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddDealToCart = (deal: DealItem) => {
    if (isEditingMode) return;
    const dealProduct = {
      id: deal.id,
      name: deal.name,
      description: deal.description,
      price: deal.price,
      category: 'Deals',
      image: '🎁',
      sku: deal.id.toUpperCase(),
      quantity: 1
    };
    onAdd(dealProduct);
    toast.success(`${deal.name} added to cart`);
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
        <div className="bg-slate-900 bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5 text-white shrink-0 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-lg">
                <Tag className="h-7 w-7 text-yellow-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-2xl font-black font-heading uppercase tracking-tight">Virtual Deals Menu</DialogTitle>
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={cn(
                        "h-8 w-8 rounded-full",
                        isEditingMode ? "bg-yellow-500 text-white hover:bg-yellow-600" : "bg-white/10 text-white hover:bg-white/20"
                      )}
                      onClick={() => setIsEditingMode(!isEditingMode)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <DialogDescription className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                  {isEditingMode ? "ADMIN MODE: EDITING DEALS" : "Special Combos & Family Festivals"}
                </DialogDescription>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-90"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/10 border-none text-white placeholder:text-slate-500 pl-10 h-11 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 custom-scrollbar">
          <div className="p-6">
            <div className="grid grid-cols-1 gap-3">
              {filteredDeals.map((deal, index) => {
                const originalIndex = menuItems.findIndex(d => d.id === deal.id);
                return (
                  <div
                    key={deal.id}
                    className={cn(
                      "group flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all",
                      !isEditingMode && "hover:bg-slate-50 hover:border-slate-300 hover:shadow-md cursor-pointer"
                    )}
                    onClick={() => !isEditingMode && handleAddDealToCart(deal)}
                  >
                    <div className="flex-1 pr-4">
                      {isEditingMode ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                              onClick={(e) => { e.stopPropagation(); handleRemoveItem(originalIndex); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Input 
                              value={deal.name} 
                              onChange={(e) => handleUpdateItem(originalIndex, 'name', e.target.value)}
                              className="h-9 text-sm font-bold uppercase"
                            />
                            <Input 
                              type="number"
                              value={deal.price} 
                              onChange={(e) => handleUpdateItem(originalIndex, 'price', e.target.value)}
                              className="h-9 w-24 text-sm font-black"
                            />
                          </div>
                          <Textarea 
                            value={deal.description}
                            onChange={(e) => handleUpdateItem(originalIndex, 'description', e.target.value)}
                            className="text-xs font-medium min-h-[60px] bg-slate-50/50"
                            placeholder="List deal items here..."
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-black font-heading text-slate-900 text-sm uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                            {deal.name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium leading-relaxed whitespace-pre-line">
                            {deal.description}
                          </p>
                        </div>
                      )}
                    </div>
                    {!isEditingMode && (
                      <div className="flex items-center gap-5 shrink-0">
                        <span className="font-black font-heading text-slate-900 text-base tracking-tight">Rs {deal.price}</span>
                        <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-blue-600 flex items-center justify-center transition-colors">
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
                  className="mt-4 border-dashed border-2 h-14 rounded-2xl text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 font-bold"
                  onClick={handleAddItem}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add New Deal
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">
            {isEditingMode ? "Changes are saved automatically" : "Tap a deal card to add to cart"}
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