import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCartStore } from '@/stores/cartStore';
import { Edit2, Plus, Trash2, Save, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Full SM Butt Karahi Menu Data ────────────────────────────────────────────
export const SMBUTT_MENU_DATA = {
  KARAHI: {
    label: 'Karahi',
    icon: '🍲',
    items: [
      { name: 'Mutton Karahi (Raan)',               qtr: 5000, half: 2600 },
      { name: 'Mutton Achari Karahi (Raan)',         qtr: 5600, half: 2900 },
      { name: 'Mutton Karahi White (Raan)',          qtr: 5200, half: 2700 },
      { name: 'Mutton Karahi Special White (Raan)',  qtr: 5800, half: 3000 },
      { name: 'Chicken Karahi',                      qtr: 2400, half: 1300 },
      { name: 'Chicken Achari Karahi',               qtr: 3000, half: 1600 },
      { name: 'Chicken Karahi White',                qtr: 2600, half: 1400 },
      { name: 'Chicken Karahi Special White',        qtr: 3200, half: 1700 },
      { name: 'Desi Chicken Karahi',                 qtr: 4400, half: 2300 },
      { name: 'Desi Chicken Achari Karahi',          qtr: 5000, half: 2600 },
    ]
  },
  BARBECUE: {
    label: 'Barbecue',
    icon: '🔥',
    items: [
      { name: 'Chicken Tikka Leg',             price: 600 },
      { name: 'Chicken Tikka Chest',           price: 650 },
      { name: 'Chicken Malai Boti (8 pcs)',    price: 1200 },
      { name: 'Chicken Bihari Boti (8 pcs)',   price: 1000 },
      { name: 'Chicken Achari Boti (8 pcs)',   price: 1250 },
      { name: 'Chicken Reshmi Kebab (4 pcs)',  qtr: 1500, half: 800 },
      { name: 'Chicken Tikka Kebab (4 pcs)',   qtr: 1600, half: 850 },
      { name: 'Chicken Reshmi Kebab Alt (4 pcs)', qtr: 1400, half: 750 },
      { name: 'Fish Tikka (4 pcs)',            qtr: 1600, half: 850 },
      { name: 'Barbecue Special Fish',         price: 2200 },
      { name: 'Tali Fish (6 pcs)',             price: 1400 },
      { name: 'Barbecue Doodhi Kebab',         price: 2500 },
      { name: 'Barbecue Family Kebab',         price: 5000 },
    ]
  },
  HANDI: {
    label: 'Handi',
    icon: '🫕',
    items: [
      { name: 'Chicken Handi',        price: 2200 },
      { name: 'Chicken Achari Handi', price: 3000 },
      { name: 'Chicken Green Handi',  price: 2400 },
      { name: 'Kadhai & Veg',         price: 900  },
      { name: 'Daal Shahi',           price: 900  },
    ]
  },
  SALAD_RAITA: {
    label: 'Salad & Raita',
    icon: '🥗',
    items: [
      { name: 'Fresh Green Salad', price: 250 },
      { name: 'Cucumber Salad',    price: 300 },
      { name: 'Russian Salad',     price: 700 },
      { name: 'Green Raita',       price: 250 },
    ]
  },
  SIDE_ITEMS: {
    label: 'Side Items',
    icon: '🍟',
    items: [
      { name: 'French Fries', price: 500 },
    ]
  },
  CHINESE: {
    label: 'Chinese',
    icon: '🍜',
    items: [
      { name: 'Hot & Sour Soup',                  qtr: 1500, half: 500 },
      { name: 'Chicken Corn Soup',                qtr: 1200, half: 500 },
      { name: 'Vegetable Soup',                   qtr: 1600, half: 600 },
      { name: 'Chicken Thai Soup',                qtr: 1500, half: 500 },
      { name: 'Egg Fried Rice',                   price: 900  },
      { name: 'Chicken Fried Rice',               price: 1050 },
      { name: 'Vegetable Rice',                   price: 900  },
      { name: 'Chicken Chow Mein Rice',           price: 1100 },
      { name: 'Chicken Manchurian + Rice',        price: 1250 },
      { name: 'Chicken Shashlik + Rice',          price: 1200 },
      { name: 'Kung Pao + Rice',                  price: 1200 },
      { name: 'Chicken Chilli Dry + Rice',        price: 1300 },
      { name: 'Chicken Manchurian',               price: 1500 },
      { name: 'Vegetable Manchurian',             price: 1400 },
      { name: 'Chicken Shashlik Manchurian',      price: 1600 },
      { name: 'Dragon Chicken',                   price: 1200 },
      { name: '8 pcs Chicken Wings',              price: 900  },
      { name: '6 pcs Drumstick',                  price: 1100 },
      { name: 'Chow Mein',                        price: 900  },
    ]
  },
  MILKSHAKES: {
    label: 'Milkshakes & Drinks',
    icon: '🥛',
    items: [
      { name: 'Mazola Dahi (Large)',   price: 160 },
      { name: 'Mazola Dahi (Small)',   price: 110 },
      { name: 'Cold Coffee (Thick)',   price: 140 },
      { name: 'Doodh Patti Chai',      price: 200 },
      { name: 'Green Tea',             price: 150 },
    ]
  },
  BEVERAGES: {
    label: 'Beverages',
    icon: '🍹',
    items: [
      { name: 'Mint Margarita',       price: 600 },
      { name: 'Lemon Soda',           price: 400 },
      { name: 'Blueberry Margarita',  price: 500 },
      { name: 'Peach Margarita',      price: 550 },
      { name: 'Oreo Shake',           price: 700 },
      { name: 'Chocolate Shake',      price: 700 },
      { name: 'Chikoo Shake',         price: 500 },
      { name: 'Lassi Sweet',          price: 400 },
      { name: 'Lassi Salty',          price: 400 },
    ]
  },
  TANDOOR: {
    label: 'Tandoor',
    icon: '🫓',
    items: [
      { name: 'Chapati',      price: 50  },
      { name: 'Plain Naan',   price: 70  },
      { name: 'Garlic Naan',  price: 150 },
      { name: 'Roghni Naan',  price: 150 },
      { name: 'Kulcha Naan',  price: 160 },
    ]
  },
};

type MenuCategory = keyof typeof SMBUTT_MENU_DATA;

interface SizeOption {
  label: string;
  price: number;
}

interface SmbuttKarahiMenuModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: MenuCategory;
}

const SmbuttKarahiMenuModal: React.FC<SmbuttKarahiMenuModalProps> = ({
  open,
  onOpenChange,
  defaultCategory,
}) => {
  const [activeCategory, setActiveCategory] = useState<MenuCategory>(
    defaultCategory || 'KARAHI'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [categoryItems, setCategoryItems] = useState<any[]>([]);
  const { addItem } = useCartStore();

  useEffect(() => {
    if (defaultCategory) {
      setActiveCategory(defaultCategory);
    }
  }, [defaultCategory, open]);

  // Load items from localStorage for current category
  useEffect(() => {
    if (!open) return;
    const key = `pos_menu_smbutt_${activeCategory.toLowerCase()}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setCategoryItems(JSON.parse(saved));
      } catch {
        setCategoryItems(SMBUTT_MENU_DATA[activeCategory]?.items || []);
      }
    } else {
      setCategoryItems(SMBUTT_MENU_DATA[activeCategory]?.items || []);
    }
  }, [activeCategory, open]);

  const saveCategoryItems = (updated: any[]) => {
    setCategoryItems(updated);
    const key = `pos_menu_smbutt_${activeCategory.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(updated));
    window.dispatchEvent(new Event('smbutt-menu-updated'));
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updated = [...categoryItems];
    if (field === 'qtr' || field === 'half' || field === 'price') {
      const numVal = Number(value);
      updated[index] = { ...updated[index], [field]: isNaN(numVal) ? undefined : numVal };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    saveCategoryItems(updated);
  };

  const handleAddItem = () => {
    const newItem = { name: 'New Menu Item', price: 500 };
    saveCategoryItems([...categoryItems, newItem]);
    toast.success('New item added');
  };

  const handleRemoveItem = (index: number) => {
    const updated = categoryItems.filter((_, i) => i !== index);
    saveCategoryItems(updated);
    toast.success('Item deleted');
  };

  const categoryKeys = Object.keys(SMBUTT_MENU_DATA) as MenuCategory[];

  const filteredItems = categoryItems.filter(item =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleItemClick = (item: any) => {
    const hasQtr = item.qtr != null;
    const hasHalf = item.half != null;

    if (!hasQtr && !hasHalf) {
      addItem({
        id: `smbutt-${activeCategory}-${item.name}`.replace(/\s+/g, '-').toLowerCase(),
        name: item.name,
        price: item.price || 0,
        category: SMBUTT_MENU_DATA[activeCategory].label,
        image: SMBUTT_MENU_DATA[activeCategory].icon,
      });
      toast.success(`${item.name} added to cart`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) setIsEditingMode(false);
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white rounded-3xl border-none shadow-2xl">
        <DialogHeader className="px-6 py-4 bg-emerald-700 text-white flex-shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-extrabold flex items-center gap-2">
            <span className="text-2xl">{SMBUTT_MENU_DATA[activeCategory]?.icon || '🍲'}</span> 
            {SMBUTT_MENU_DATA[activeCategory]?.label || 'Karahi'} Menu
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 rounded-full text-xs font-bold transition-all",
                isEditingMode ? "bg-white text-emerald-800 hover:bg-white/90" : "bg-emerald-600 text-white hover:bg-emerald-500"
              )}
              onClick={() => setIsEditingMode(!isEditingMode)}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1" />
              {isEditingMode ? 'Done Editing' : 'Edit Products'}
            </Button>
          </div>
        </DialogHeader>

        {/* Category tabs */}
        <div className="flex-shrink-0 border-b bg-slate-50 overflow-x-auto">
          <div className="flex gap-1 px-4 py-2 min-w-max">
            {categoryKeys.map(key => (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                  activeCategory === key
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <span>{SMBUTT_MENU_DATA[key].icon}</span>
                {SMBUTT_MENU_DATA[key].label}
              </button>
            ))}
          </div>
        </div>

        {/* Search bar & Add button */}
        <div className="px-6 py-3 border-b flex items-center gap-3 bg-white">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search items in this category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl border-slate-200"
            />
          </div>
          {isEditingMode && (
            <Button
              size="sm"
              onClick={handleAddItem}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-9 gap-1"
            >
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          )}
        </div>

        {/* Items list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-12 text-[10px] font-black uppercase text-slate-400 px-3 py-1 tracking-wider">
              <div className="col-span-5">Item Name</div>
              <div className="col-span-3 text-center">Qtr / Single Rate (Rs)</div>
              <div className="col-span-2 text-center">Half Rate (Rs)</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {filteredItems.map((item: any, idx: number) => {
              const hasQtr = item.qtr != null;
              const hasHalf = item.half != null;
              const hasSingle = item.price != null;

              return (
                <div
                  key={idx}
                  className="grid grid-cols-12 items-center gap-2 bg-white border border-slate-100 rounded-2xl px-3 py-2.5 hover:bg-emerald-50/30 transition-all group"
                >
                  <div className="col-span-5">
                    {isEditingMode ? (
                      <Input
                        value={item.name || ''}
                        onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                        className="h-8 text-xs font-bold border-slate-200"
                      />
                    ) : (
                      <span className="font-bold text-slate-800 text-xs">
                        {item.name}
                      </span>
                    )}
                  </div>

                  <div className="col-span-3 text-center">
                    {isEditingMode ? (
                      <Input
                        type="number"
                        placeholder="Qtr/Price"
                        value={item.qtr ?? item.price ?? ''}
                        onChange={(e) => {
                          if (hasQtr || (!hasSingle && !hasHalf)) {
                            handleUpdateItem(idx, 'qtr', e.target.value);
                          } else {
                            handleUpdateItem(idx, 'price', e.target.value);
                          }
                        }}
                        className="h-8 text-xs text-center border-slate-200"
                      />
                    ) : (
                      <>
                        {hasQtr && (
                          <span className="text-emerald-700 font-extrabold text-xs">
                            Rs. {item.qtr.toLocaleString()} (Qtr)
                          </span>
                        )}
                        {hasSingle && !hasQtr && (
                          <span className="text-emerald-700 font-extrabold text-xs">
                            Rs. {item.price.toLocaleString()}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div className="col-span-2 text-center">
                    {isEditingMode ? (
                      <Input
                        type="number"
                        placeholder="Half Rate"
                        value={item.half ?? ''}
                        onChange={(e) => handleUpdateItem(idx, 'half', e.target.value)}
                        className="h-8 text-xs text-center border-slate-200"
                      />
                    ) : (
                      hasHalf ? (
                        <span className="text-blue-600 font-extrabold text-xs">
                          Rs. {item.half.toLocaleString()} (Half)
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )
                    )}
                  </div>

                  <div className="col-span-2 flex justify-end gap-1 items-center">
                    {isEditingMode ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(idx)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : (
                      <>
                        {hasQtr && (
                          <button
                            onClick={() => {
                              addItem({
                                id: `smbutt-${activeCategory}-${item.name}-qtr`.replace(/\s+/g, '-').toLowerCase(),
                                name: `${item.name} (Qtr)`,
                                price: item.qtr,
                                category: SMBUTT_MENU_DATA[activeCategory].label,
                                image: SMBUTT_MENU_DATA[activeCategory].icon,
                              });
                              toast.success(`${item.name} (Qtr) added`);
                            }}
                            className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2 py-1 font-bold transition-colors"
                          >
                            Qtr
                          </button>
                        )}
                        {hasHalf && (
                          <button
                            onClick={() => {
                              addItem({
                                id: `smbutt-${activeCategory}-${item.name}-half`.replace(/\s+/g, '-').toLowerCase(),
                                name: `${item.name} (Half)`,
                                price: item.half,
                                category: SMBUTT_MENU_DATA[activeCategory].label,
                                image: SMBUTT_MENU_DATA[activeCategory].icon,
                              });
                              toast.success(`${item.name} (Half) added`);
                            }}
                            className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2 py-1 font-bold transition-colors"
                          >
                            Half
                          </button>
                        )}
                        {hasSingle && !hasQtr && (
                          <button
                            onClick={() => handleItemClick(item)}
                            className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 py-1 font-bold transition-colors"
                          >
                            + Add
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-xs">
                No items in this category. Click <strong>Edit Products</strong> to add new items.
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 px-6 py-3 border-t bg-slate-50 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmbuttKarahiMenuModal;

