import { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Product } from '@/stores/cartStore';

interface ArabicBroastModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onAdd: (product: Product) => void;
}

const ArabicBroastModal = ({ isOpen, onClose, products, onAdd }: ArabicBroastModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const broastItems = filteredItems.filter(p => !p.name.toUpperCase().includes('COMBO'));
  const combos = filteredItems.filter(p => p.name.toUpperCase().includes('COMBO'));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-white border-none rounded-3xl max-h-[90vh] h-[90vh] flex flex-col shadow-2xl [&>button]:hidden">
        {/* Header Section */}
        <div className="bg-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-5 text-white shrink-0 relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">Arabic Broast</DialogTitle>
              <DialogDescription className="text-emerald-50/80 text-xs font-bold uppercase tracking-widest mt-0.5">
                Authentic Spicy Injected Broast
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

        {/* Content Section - Using standard overflow for better scroll visibility */}
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
                  {broastItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onAdd(item)}
                      className="group flex items-center justify-between p-4 bg-white hover:bg-emerald-50 rounded-2xl border border-slate-100 hover:border-emerald-200 shadow-sm hover:shadow-md transition-all text-left"
                    >
                      <div className="flex-1 pr-4">
                        <p className="font-bold text-slate-800 text-[15px] group-hover:text-emerald-700 transition-colors">{item.name}</p>
                      </div>
                      <div className="flex items-center gap-5 shrink-0">
                        <span className="font-black text-slate-900 text-base">Rs {item.price.toLocaleString()}</span>
                        <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
                          <Plus className="h-4 w-4 text-slate-400 group-hover:text-white" />
                        </div>
                      </div>
                    </button>
                  ))}
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
                  {combos.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onAdd(item)}
                      className="group flex items-center justify-between p-4 bg-white hover:bg-emerald-50 rounded-2xl border border-slate-100 hover:border-emerald-200 shadow-sm hover:shadow-md transition-all text-left"
                    >
                      <div className="flex-1 pr-4">
                        <p className="font-black text-emerald-600 text-[15px] group-hover:text-emerald-700 transition-colors mb-1">{item.name}</p>
                        {(item as any).description && (
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">{(item as any).description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-5 shrink-0">
                        <span className="font-black text-slate-900 text-base whitespace-nowrap">Rs {item.price.toLocaleString()}</span>
                        <div className="h-8 w-8 rounded-full bg-slate-100 group-hover:bg-emerald-500 flex items-center justify-center transition-colors">
                          <Plus className="h-4 w-4 text-slate-400 group-hover:text-white" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredItems.length === 0 && (
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
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
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