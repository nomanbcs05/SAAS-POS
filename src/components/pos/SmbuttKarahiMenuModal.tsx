import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCartStore } from '@/stores/cartStore';
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
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedSize, setSelectedSize] = useState<SizeOption | null>(null);
  const { addItem } = useCartStore();

  const categoryKeys = Object.keys(SMBUTT_MENU_DATA) as MenuCategory[];
  const currentItems = SMBUTT_MENU_DATA[activeCategory]?.items || [];

  const handleItemClick = (item: any) => {
    const hasQtr = item.qtr != null;
    const hasHalf = item.half != null;

    if (hasQtr || hasHalf) {
      // Item has size options
      setSelectedItem(item);
      setSelectedSize(null);
    } else {
      // Single price item — add directly
      addItem({
        id: `smbutt-${activeCategory}-${item.name}`.replace(/\s+/g, '-').toLowerCase(),
        name: item.name,
        price: item.price,
        category: SMBUTT_MENU_DATA[activeCategory].label,
        image: SMBUTT_MENU_DATA[activeCategory].icon,
      });
      toast.success(`${item.name} added to cart`);
    }
  };

  const handleSizeAdd = () => {
    if (!selectedItem || !selectedSize) return;
    addItem({
      id: `smbutt-${activeCategory}-${selectedItem.name}-${selectedSize.label}`.replace(/\s+/g, '-').toLowerCase(),
      name: `${selectedItem.name} (${selectedSize.label})`,
      price: selectedSize.price,
      category: SMBUTT_MENU_DATA[activeCategory].label,
      image: SMBUTT_MENU_DATA[activeCategory].icon,
    });
    toast.success(`${selectedItem.name} (${selectedSize.label}) added to cart`);
    setSelectedItem(null);
    setSelectedSize(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-0 flex-shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">🍲</span> SM Butt Karahi Menu
            </DialogTitle>
          </DialogHeader>

          {/* Category tabs */}
          <div className="flex-shrink-0 border-b overflow-x-auto">
            <div className="flex gap-1 px-4 pb-0 pt-3 min-w-max">
              {categoryKeys.map(key => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`px-3 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activeCategory === key
                      ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{SMBUTT_MENU_DATA[key].icon}</span>
                  {SMBUTT_MENU_DATA[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Items list */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-2">
              {/* Table header */}
              <div className="grid grid-cols-12 text-xs font-bold uppercase text-slate-400 px-3 py-1">
                <div className="col-span-6">Item</div>
                <div className="col-span-2 text-center">Qtr / Price</div>
                <div className="col-span-2 text-center">Half</div>
                <div className="col-span-2 text-right"></div>
              </div>

              {currentItems.map((item: any, idx) => {
                const hasQtr = item.qtr != null;
                const hasHalf = item.half != null;
                const hasSingle = item.price != null;

                return (
                  <div
                    key={idx}
                    className="grid grid-cols-12 items-center gap-2 bg-white border border-slate-100 rounded-xl px-3 py-3 hover:bg-emerald-50/40 hover:border-emerald-200 transition-all group"
                  >
                    <div className="col-span-6 font-semibold text-slate-800 text-sm">
                      {item.name}
                    </div>

                    <div className="col-span-2 text-center">
                      {hasQtr && (
                        <span className="text-emerald-700 font-bold text-sm">
                          Rs. {item.qtr.toLocaleString()}
                        </span>
                      )}
                      {hasSingle && !hasQtr && (
                        <span className="text-emerald-700 font-bold text-sm">
                          Rs. {item.price.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 text-center">
                      {hasHalf ? (
                        <span className="text-blue-600 font-bold text-sm">
                          Rs. {item.half.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </div>

                    <div className="col-span-2 flex justify-end gap-1">
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
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2 py-1.5 font-bold transition-colors"
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
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2 py-1.5 font-bold transition-colors"
                        >
                          Half
                        </button>
                      )}
                      {hasSingle && !hasQtr && (
                        <button
                          onClick={() => handleItemClick(item)}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2 py-1.5 font-bold transition-colors"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <div className="flex-shrink-0 px-6 py-3 border-t bg-slate-50 flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SmbuttKarahiMenuModal;
