import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCartStore } from '@/stores/cartStore';
import { Edit2, Plus, Trash2, Check, X } from 'lucide-react';
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

// Per-category custom labels stored in localStorage
const LABEL_STORAGE_KEY = 'pos_smbutt_category_labels';

function getSavedLabels(): Record<string, string> {
  try {
    const saved = localStorage.getItem(LABEL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
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
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [categoryItems, setCategoryItems] = useState<any[]>([]);

  // Editable heading
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(getSavedLabels);
  const [editingHeading, setEditingHeading] = useState(false);
  const [headingDraft, setHeadingDraft] = useState('');

  const { addItem } = useCartStore();

  const getLabel = (key: string) => categoryLabels[key] || SMBUTT_MENU_DATA[key as MenuCategory]?.label || key;

  // Sync defaultCategory when opening with a specific category card
  useEffect(() => {
    if (defaultCategory) setActiveCategory(defaultCategory);
  }, [defaultCategory, open]);

  // Load items from localStorage for the active category
  useEffect(() => {
    if (!open) return;
    const key = `pos_menu_smbutt_${activeCategory.toLowerCase()}`;
    const saved = localStorage.getItem(key);
    try {
      setCategoryItems(saved ? JSON.parse(saved) : SMBUTT_MENU_DATA[activeCategory]?.items || []);
    } catch {
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
    saveCategoryItems([...categoryItems, { name: 'New Item', price: 0 }]);
    toast.success('New item added');
  };

  const handleRemoveItem = (index: number) => {
    saveCategoryItems(categoryItems.filter((_, i) => i !== index));
    toast.success('Item removed');
  };

  // Heading edit handlers
  const startHeadingEdit = () => {
    setHeadingDraft(getLabel(activeCategory));
    setEditingHeading(true);
  };

  const saveHeading = () => {
    const draft = headingDraft.trim();
    if (!draft) { setEditingHeading(false); return; }
    const updated = { ...categoryLabels, [activeCategory]: draft };
    setCategoryLabels(updated);
    localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('smbutt-menu-updated'));
    setEditingHeading(false);
    toast.success('Category heading updated');
  };

  const categoryKeys = Object.keys(SMBUTT_MENU_DATA) as MenuCategory[];

  const handleAddToCart = (item: any, size: 'qtr' | 'half' | 'single') => {
    const catLabel = getLabel(activeCategory);
    const catIcon = SMBUTT_MENU_DATA[activeCategory].icon;
    if (size === 'qtr') {
      addItem({
        id: `smbutt-${activeCategory}-${item.name}-qtr`.replace(/\s+/g, '-').toLowerCase(),
        name: `${item.name} (Qtr)`,
        price: item.qtr,
        category: catLabel,
        image: catIcon,
      });
      toast.success(`${item.name} (Qtr) added`);
    } else if (size === 'half') {
      addItem({
        id: `smbutt-${activeCategory}-${item.name}-half`.replace(/\s+/g, '-').toLowerCase(),
        name: `${item.name} (Half)`,
        price: item.half,
        category: catLabel,
        image: catIcon,
      });
      toast.success(`${item.name} (Half) added`);
    } else {
      addItem({
        id: `smbutt-${activeCategory}-${item.name}`.replace(/\s+/g, '-').toLowerCase(),
        name: item.name,
        price: item.price || 0,
        category: catLabel,
        image: catIcon,
      });
      toast.success(`${item.name} added to cart`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) { setIsEditingMode(false); setEditingHeading(false); }
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">

        {/* ── Original-style header ─────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            {/* Editable heading */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">{SMBUTT_MENU_DATA[activeCategory]?.icon || '🍲'}</span>
              {editingHeading ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={headingDraft}
                    onChange={(e) => setHeadingDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveHeading(); if (e.key === 'Escape') setEditingHeading(false); }}
                    className="h-8 text-base font-bold border-emerald-400 w-48"
                  />
                  <button onClick={saveHeading} className="p-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingHeading(false)} className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <DialogTitle
                  className="text-xl font-bold flex items-center gap-1.5 cursor-pointer group"
                  onClick={isEditingMode ? startHeadingEdit : undefined}
                  title={isEditingMode ? "Click to rename category heading" : undefined}
                >
                  {getLabel(activeCategory)} Menu
                  {isEditingMode && (
                    <Edit2 className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </DialogTitle>
              )}
            </div>

            {/* Edit toggle button */}
            <button
              onClick={() => { setIsEditingMode(!isEditingMode); setEditingHeading(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                isEditingMode
                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400 hover:text-emerald-600'
              }`}
            >
              <Edit2 className="h-3.5 w-3.5" />
              {isEditingMode ? 'Done' : 'Edit'}
            </button>
          </div>
        </DialogHeader>

        {/* ── Category tabs (original style: underline tabs) ─────────────── */}
        <div className="flex-shrink-0 border-b overflow-x-auto">
          <div className="flex gap-1 px-4 pb-0 pt-3 min-w-max">
            {categoryKeys.map(key => (
              <button
                key={key}
                onClick={() => { setActiveCategory(key); setEditingHeading(false); }}
                className={`px-3 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeCategory === key
                    ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{SMBUTT_MENU_DATA[key].icon}</span>
                {getLabel(key)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Add Product button (only in edit mode) ─────────────────────── */}
        {isEditingMode && (
          <div className="px-6 py-2 border-b bg-emerald-50/60 flex items-center justify-between gap-3">
            <span className="text-xs text-emerald-700 font-semibold">
              ✎ Edit Mode — Click headings to rename. Edit names, rates, or delete rows.
            </span>
            <Button
              size="sm"
              onClick={handleAddItem}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 gap-1 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Add Product
            </Button>
          </div>
        )}

        {/* ── Items list (original table style) ─────────────────────────── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-12 text-xs font-bold uppercase text-slate-400 px-3 py-1">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-center">Qtr / Price</div>
              <div className="col-span-2 text-center">Half</div>
              <div className="col-span-2 text-right">{isEditingMode ? 'Delete' : ''}</div>
            </div>

            {categoryItems.map((item: any, idx: number) => {
              const hasQtr = item.qtr != null;
              const hasHalf = item.half != null;
              const hasSingle = !hasQtr && item.price != null;

              return (
                <div
                  key={idx}
                  className="grid grid-cols-12 items-center gap-2 bg-white border border-slate-100 rounded-xl px-3 py-3 hover:bg-emerald-50/40 hover:border-emerald-200 transition-all group"
                >
                  {/* Item name */}
                  <div className="col-span-6">
                    {isEditingMode ? (
                      <Input
                        value={item.name || ''}
                        onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                        className="h-8 text-xs font-semibold border-slate-200"
                        placeholder="Item name"
                      />
                    ) : (
                      <span className="font-semibold text-slate-800 text-sm">{item.name}</span>
                    )}
                  </div>

                  {/* Qtr / Price */}
                  <div className="col-span-2 text-center">
                    {isEditingMode ? (
                      <Input
                        type="number"
                        placeholder={hasQtr ? 'Qtr' : 'Price'}
                        value={hasQtr ? (item.qtr ?? '') : (item.price ?? '')}
                        onChange={(e) => handleUpdateItem(idx, hasQtr ? 'qtr' : 'price', e.target.value)}
                        className="h-8 text-xs text-center border-slate-200"
                      />
                    ) : (
                      <>
                        {hasQtr && (
                          <span className="text-emerald-700 font-bold text-sm">
                            Rs. {item.qtr.toLocaleString()}
                          </span>
                        )}
                        {hasSingle && (
                          <span className="text-emerald-700 font-bold text-sm">
                            Rs. {item.price.toLocaleString()}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Half */}
                  <div className="col-span-2 text-center">
                    {isEditingMode ? (
                      <Input
                        type="number"
                        placeholder="Half"
                        value={item.half ?? ''}
                        onChange={(e) => handleUpdateItem(idx, 'half', e.target.value)}
                        className="h-8 text-xs text-center border-slate-200"
                      />
                    ) : (
                      hasHalf ? (
                        <span className="text-blue-600 font-bold text-sm">
                          Rs. {item.half.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="col-span-2 flex justify-end gap-1">
                    {isEditingMode ? (
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="h-8 w-8 flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <>
                        {hasQtr && (
                          <button
                            onClick={() => handleAddToCart(item, 'qtr')}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2 py-1.5 font-bold transition-colors"
                          >
                            Qtr
                          </button>
                        )}
                        {hasHalf && (
                          <button
                            onClick={() => handleAddToCart(item, 'half')}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2 py-1.5 font-bold transition-colors"
                          >
                            Half
                          </button>
                        )}
                        {hasSingle && (
                          <button
                            onClick={() => handleAddToCart(item, 'single')}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2 py-1.5 font-bold transition-colors"
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

            {categoryItems.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">
                No items. Click <strong>Edit</strong> then <strong>+ Add Product</strong> to get started.
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 py-3 border-t bg-slate-50 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmbuttKarahiMenuModal;
