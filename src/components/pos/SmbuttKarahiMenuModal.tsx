import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCartStore } from '@/stores/cartStore';
import { Edit2, Plus, Trash2, Check, X, Search, UtensilsCrossed, ChefHat, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── SM Butt Karahi Full Updated Menu Data ─────────────────────────────────────
export const SMBUTT_MENU_DATA = {
  HANDI: {
    label: 'Handi',
    icon: '🫕',
    items: [
      { name: 'CHICKEN HANDI', price: 2200 },
      { name: 'CHICKEN GHUTTI HANDI', price: 3000 },
      { name: 'CHICKEN GREEN HANDI', price: 2400 },
      { name: 'K&S VEGETABLE', price: 900 },
      { name: 'SHAHI DAAL GHUTTI', price: 900 },
    ]
  },
  SOUPS: {
    label: 'Soups',
    icon: '🥣',
    items: [
      { name: 'HOT & SOUR SOUP', family: 1500, single: 500 },
      { name: 'CHICKEN CORN SOUP', family: 1200, single: 500 },
      { name: 'BUTT SPECIAL SOUP', family: 1600, single: 600 },
      { name: 'CHICKEN THAI SOUP', family: 1500, single: 500 },
    ]
  },
  KARAHI: {
    label: 'Karahi Specials',
    icon: '🍲',
    items: [
      { name: 'Butt Mutton Karahi Makhni (Raan)', full: 5600, half: 2900 },
      { name: 'Butt Mutton Karahi White (Raan)', full: 5200, half: 2700 },
      { name: 'Butt Mutton Karahi White Makhni', full: 5800, half: 3000 },
      { name: 'Butt Mutton Karahi (Raan)', full: 4800, half: 2500 },
      { name: 'Butt Chicken Karahi', full: 2400, half: 1300 },
      { name: 'Butt Chicken Karahi Makhni', full: 3000, half: 1600 },
      { name: 'Butt Chicken Karahi White', full: 2600, half: 1400 },
      { name: 'Butt Chicken Karahi White Makhni', full: 3200, half: 1700 },
      { name: 'Butt Desi Murgha Karahi', full: 4000, half: 2200 },
      { name: 'Butt Desi Murgha Karahi Makhni', full: 4700, half: 2500 },
    ]
  },
  BARBECUE: {
    label: 'BBQ Classics',
    icon: '🔥',
    items: [
      { name: 'CHICKEN LEG TIKKA', price: 600 },
      { name: 'CHICKEN CHEST TIKKA', price: 650 },
      { name: 'CHICKEN MALAI BOTI (8PCS)', price: 1200 },
      { name: 'CHICKEN TIKKA BOTI (8PCS)', price: 1000 },
      { name: 'CHICKEN ISTANBUL BOTI (8PCS)', price: 1250 },
      { name: 'KAMLI TIKKA (6PCS)', price: 1400 },
      { name: 'FISH TIKKA (4PCS)', price: 1600 },
      { name: 'BBQ GRILLED FISH', price: 2200 },
      { name: 'BUTT SPECIAL CHICKEN PIZZA KABAB', full: 1500, half: 800 },
      { name: 'CHICKEN TURKISH KABAB', full: 1600, half: 850 },
      { name: 'CHICKEN RESHMI KABAB', full: 1400, half: 750 },
    ]
  },
  PLATTERS: {
    label: 'Platter Special',
    icon: '🍱',
    items: [
      { name: 'BBQ DOSTI PLATTER', price: 2500, details: 'Kalmi Tikka 2, Fish Tikka 2, Turkish Kabab 1, Pizza Kabab 1, Istanbul Boti 2, Egg Rice, BBQ Sauce' },
      { name: 'BBQ FAMILY PLATTER', price: 5000, details: 'Kalmi Tikka 4, Fish Tikka 4, Turkish Kabab 2, Pizza Kabab 2, Istanbul Boti 4, Egg Rice, BBQ Sauce' },
    ]
  },
  CHINESE: {
    label: 'Chinese',
    icon: '🍜',
    items: [
      { name: 'EGG FRIED RICE', price: 900 },
      { name: 'CHICKEN FRIED RICE', price: 1050 },
      { name: 'VEGETABLES FRIED RICE', price: 900 },
      { name: 'CHICKEN MASALA RICE', price: 1100 },
      { name: 'CHICKEN MANCHURIAN WITH RICE', price: 1250 },
      { name: 'CHICKEN SHASHLIK WITH RICE', price: 1200 },
      { name: 'KONG PAUO WITH RICE', price: 1200 },
      { name: 'CHICKEN CHILI DRY WITH RICE', price: 1300 },
      { name: 'CHICKEN CHOWMEIN', price: 1500 },
      { name: 'VEGETABLES CHOWMEIN', price: 1400 },
      { name: 'CHICKEN SHEZWAN CHOWMEIN', price: 1600 },
      { name: 'ALFREDO PASTA', price: 900 },
    ]
  },
  TANDOOR: {
    label: 'Naan',
    icon: '🫓',
    items: [
      { name: 'Chapati', price: 50 },
      { name: 'Plain naan', price: 70 },
      { name: 'Garlic naan', price: 150 },
      { name: 'Roghni naan', price: 150 },
      { name: 'Kalonji naan', price: 160 },
    ]
  },
  SALAD_RAITA: {
    label: 'Salads & Sides',
    icon: '🥗',
    items: [
      { name: 'Raita', price: 200 },
      { name: 'Fresh green salad', price: 250 },
      { name: 'Kachomar salad', price: 300 },
      { name: 'Russian salad', price: 700 },
      { name: 'Green salad', price: 250 },
    ]
  },
  BEVERAGES: {
    label: 'Beverages & Shakes',
    icon: '🍹',
    items: [
      { name: 'Mineral Water (L)', price: 160 },
      { name: 'Mineral Water (S)', price: 110 },
      { name: 'Softdrink can', price: 140 },
      { name: 'Milk Tea', price: 200 },
      { name: 'Green Tea', price: 150 },
      { name: 'Mint margarita', price: 600 },
      { name: 'Blueberry margarita', price: 500 },
      { name: 'Peach margarita', price: 550 },
      { name: 'Fresh lime', price: 400 },
      { name: 'Oreo shake', price: 700 },
      { name: 'Chocolate shake', price: 650 },
      { name: 'Pina colada', price: 500 },
      { name: 'Saltish Lassi', price: 400 },
      { name: 'Sweet lassi', price: 450 },
    ]
  },
};

type MenuCategory = keyof typeof SMBUTT_MENU_DATA;

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
  defaultCategory?: MenuCategory | string;
}

const SmbuttKarahiMenuModal: React.FC<SmbuttKarahiMenuModalProps> = ({
  open,
  onOpenChange,
  defaultCategory,
}) => {
  const [activeCategory, setActiveCategory] = useState<MenuCategory>('HANDI');
  const [searchQuery, setSearchQuery] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [categoryItems, setCategoryItems] = useState<any[]>([]);

  // Category labels (editing header)
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(getSavedLabels);
  const [editingHeading, setEditingHeading] = useState(false);
  const [headingDraft, setHeadingDraft] = useState('');

  const { addItem } = useCartStore();

  const getLabel = (key: string) =>
    categoryLabels[key] || SMBUTT_MENU_DATA[key as MenuCategory]?.label || key;

  useEffect(() => {
    if (defaultCategory) {
      const matchKey = (Object.keys(SMBUTT_MENU_DATA) as MenuCategory[]).find(
        k => k.toLowerCase() === defaultCategory.toLowerCase() ||
             SMBUTT_MENU_DATA[k].label.toLowerCase() === defaultCategory.toLowerCase()
      );
      if (matchKey) setActiveCategory(matchKey);
    }
  }, [defaultCategory, open]);

  // Load items from localStorage
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
    if (field === 'price' || field === 'full' || field === 'half' || field === 'family' || field === 'single' || field === 'qtr') {
      const numVal = Number(value);
      updated[index] = { ...updated[index], [field]: isNaN(numVal) ? undefined : numVal };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    saveCategoryItems(updated);
  };

  const handleAddItem = () => {
    saveCategoryItems([...categoryItems, { name: 'NEW MENU ITEM', price: 1000 }]);
    toast.success('New product added to category');
  };

  const handleRemoveItem = (index: number) => {
    saveCategoryItems(categoryItems.filter((_, i) => i !== index));
    toast.success('Product deleted');
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

  const handleAddToCart = (item: any, optionName?: string, priceVal?: number) => {
    const finalPrice = priceVal ?? item.price ?? 0;
    const catLabel = getLabel(activeCategory);
    const catIcon = SMBUTT_MENU_DATA[activeCategory]?.icon || '🍲';
    const itemName = optionName ? `${item.name} (${optionName})` : item.name;

    for (let i = 0; i < multiplier; i++) {
      addItem({
        id: `smbutt-${activeCategory}-${item.name}-${optionName || 'std'}`.replace(/\s+/g, '-').toLowerCase(),
        name: itemName,
        price: finalPrice,
        category: catLabel,
        image: catIcon,
      });
    }
    toast.success(`${multiplier > 1 ? `${multiplier}x ` : ''}${itemName} added to cart`);
  };

  const categoryKeys = Object.keys(SMBUTT_MENU_DATA) as MenuCategory[];
  const filteredItems = categoryItems.filter(item =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) { setIsEditingMode(false); setEditingHeading(false); setSearchQuery(''); setMultiplier(1); }
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-none rounded-3xl shadow-2xl">
        
        {/* ── Top Chocolate Bar Header (matching screenshot) ────────────────── */}
        <div className="bg-[#78350f] text-white p-5 flex-shrink-0 flex flex-col gap-4 shadow-md">
          {/* Header Top Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#582509] p-3 rounded-2xl flex items-center justify-center text-amber-300 shadow-inner">
                <ChefHat className="h-7 w-7" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  {editingHeading ? (
                    <div className="flex items-center gap-2">
                      <Input
                        autoFocus
                        value={headingDraft}
                        onChange={(e) => setHeadingDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveHeading(); if (e.key === 'Escape') setEditingHeading(false); }}
                        className="h-9 text-lg font-black bg-[#582509] text-white border-amber-500/60 rounded-xl uppercase"
                      />
                      <button onClick={saveHeading} className="p-1.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditingHeading(false)} className="p-1.5 rounded-xl bg-[#582509] text-white/70 hover:text-white">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <h2
                      onClick={() => {
                        setHeadingDraft(getLabel(activeCategory));
                        setEditingHeading(true);
                      }}
                      className="text-2xl font-black uppercase tracking-wider text-white flex items-center gap-2 cursor-pointer group"
                      title="Click pencil to rename category heading"
                    >
                      {getLabel(activeCategory)}
                      <button className="opacity-70 group-hover:opacity-100 hover:scale-110 transition-all p-1 bg-[#582509] rounded-lg text-amber-300">
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </h2>
                  )}
                </div>
                <p className="text-xs font-semibold text-amber-200/80 tracking-wide uppercase mt-0.5">
                  TAP AN ITEM TO ADD TO CART
                </p>
              </div>
            </div>

            {/* Top Right Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingMode(!isEditingMode)}
                className={cn(
                  "px-4 py-2 rounded-2xl text-xs font-black transition-all border flex items-center gap-1.5",
                  isEditingMode
                    ? "bg-amber-400 text-slate-950 border-amber-400 shadow-md"
                    : "bg-[#582509] text-amber-200 border-amber-800/60 hover:bg-[#451c06] hover:text-white"
                )}
              >
                <Edit2 className="h-3.5 w-3.5" />
                {isEditingMode ? 'DONE EDITING' : 'EDIT PRODUCTS'}
              </button>

              <button
                onClick={() => onOpenChange(false)}
                className="bg-[#582509]/80 hover:bg-[#582509] text-white/90 hover:text-white rounded-full p-2.5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Search bar & Step count row (matching screenshot) */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-200/60" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-[#582509]/90 border-none text-white placeholder:text-amber-200/50 rounded-2xl text-xs font-medium focus-visible:ring-1 focus-visible:ring-amber-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200/60 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Counter pill (- 1 +) */}
            <div className="bg-[#582509] text-white h-10 px-3 rounded-2xl flex items-center gap-3 border border-amber-900/40 shadow-inner">
              <button
                onClick={() => setMultiplier(Math.max(1, multiplier - 1))}
                className="hover:text-amber-300 font-bold p-1 transition-colors"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="font-extrabold text-sm w-4 text-center text-amber-200">{multiplier}</span>
              <button
                onClick={() => setMultiplier(multiplier + 1)}
                className="hover:text-amber-300 font-bold p-1 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Add Product Button (in edit mode) */}
            {isEditingMode && (
              <Button
                onClick={handleAddItem}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black h-10 rounded-2xl gap-1.5 px-4 shadow-md"
              >
                <Plus className="h-4 w-4" /> ADD ITEM
              </Button>
            )}
          </div>
        </div>

        {/* ── Category Switcher Tabs ───────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-slate-200/80 bg-white overflow-x-auto px-4 py-2">
          <div className="flex gap-1.5 min-w-max">
            {categoryKeys.map((key) => (
              <button
                key={key}
                onClick={() => {
                  setActiveCategory(key);
                  setEditingHeading(false);
                }}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 uppercase",
                  activeCategory === key
                    ? "bg-[#78350f] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <span>{SMBUTT_MENU_DATA[key].icon}</span>
                {getLabel(key)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Category Cards Grid (Matching screenshot layout) ─────────────── */}
        <ScrollArea className="flex-1 min-h-0 bg-slate-50/70">
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map((item: any, idx: number) => {
                const hasFull = item.full != null;
                const hasHalf = item.half != null;
                const hasFamily = item.family != null;
                const hasSingle = item.single != null;
                const hasQtr = item.qtr != null;
                const hasPrice = item.price != null;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "bg-white rounded-[2rem] p-4 shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md hover:border-amber-300/60 transition-all group relative",
                      isEditingMode && "border-amber-300 bg-amber-50/20"
                    )}
                  >
                    {/* Trash / Delete button in Edit Mode */}
                    {isEditingMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(idx);
                        }}
                        className="absolute top-3 right-3 z-10 p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-all shadow-xs"
                        title="Delete Product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Top Placeholder Container (Soft purple icon as shown in screenshot) */}
                    <div className="bg-slate-50/90 rounded-2xl h-28 flex flex-col items-center justify-center mb-3 relative overflow-hidden group-hover:bg-amber-50/50 transition-colors border border-slate-100/60">
                      <UtensilsCrossed className="h-9 w-9 text-indigo-300 group-hover:scale-110 transition-transform duration-300" />
                    </div>

                    {/* Item Title */}
                    <div className="mb-3 text-center">
                      {isEditingMode ? (
                        <Input
                          value={item.name || ''}
                          onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                          className="h-8 text-xs font-black text-center border-amber-300 uppercase bg-white"
                          placeholder="ITEM NAME"
                        />
                      ) : (
                        <h3 className="font-black text-slate-800 text-xs tracking-wider uppercase min-h-[2.2rem] flex items-center justify-center line-clamp-2 px-1">
                          {item.name}
                        </h3>
                      )}
                      {item.details && !isEditingMode && (
                        <p className="text-[10px] text-slate-400 font-medium line-clamp-2 mt-1 px-1">
                          {item.details}
                        </p>
                      )}
                    </div>

                    {/* Rates & Add Buttons */}
                    <div className="mt-auto space-y-1.5">
                      {isEditingMode ? (
                        <div className="space-y-1">
                          {hasPrice && (
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="font-bold text-slate-400 w-10">Price:</span>
                              <Input
                                type="number"
                                value={item.price ?? ''}
                                onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                                className="h-7 text-xs border-amber-300"
                              />
                            </div>
                          )}
                          {(hasFull || hasHalf) && (
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <div>
                                <span className="font-bold text-slate-400">Full:</span>
                                <Input
                                  type="number"
                                  value={item.full ?? ''}
                                  onChange={(e) => handleUpdateItem(idx, 'full', e.target.value)}
                                  className="h-7 text-xs border-amber-300"
                                />
                              </div>
                              <div>
                                <span className="font-bold text-slate-400">Half:</span>
                                <Input
                                  type="number"
                                  value={item.half ?? ''}
                                  onChange={(e) => handleUpdateItem(idx, 'half', e.target.value)}
                                  className="h-7 text-xs border-amber-300"
                                />
                              </div>
                            </div>
                          )}
                          {(hasFamily || hasSingle) && (
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                              <div>
                                <span className="font-bold text-slate-400">Family:</span>
                                <Input
                                  type="number"
                                  value={item.family ?? ''}
                                  onChange={(e) => handleUpdateItem(idx, 'family', e.target.value)}
                                  className="h-7 text-xs border-amber-300"
                                />
                              </div>
                              <div>
                                <span className="font-bold text-slate-400">Single:</span>
                                <Input
                                  type="number"
                                  value={item.single ?? ''}
                                  onChange={(e) => handleUpdateItem(idx, 'single', e.target.value)}
                                  className="h-7 text-xs border-amber-300"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {/* Single Price Card */}
                          {hasPrice && !hasFull && !hasFamily && !hasQtr && (
                            <button
                              onClick={() => handleAddToCart(item)}
                              className="w-full py-2 px-3 rounded-2xl border border-amber-200/90 bg-white group-hover:bg-amber-50 text-center font-extrabold text-xs text-amber-900 shadow-2xs transition-all active:scale-95"
                            >
                              Rs. {Number(item.price).toLocaleString()}
                            </button>
                          )}

                          {/* Full / Half Variant Options */}
                          {(hasFull || hasHalf) && (
                            <div className="grid grid-cols-2 gap-1.5">
                              {hasFull && (
                                <button
                                  onClick={() => handleAddToCart(item, 'Full', item.full)}
                                  className="py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-900 text-center font-extrabold text-[11px] transition-all active:scale-95"
                                >
                                  Full: Rs. {Number(item.full).toLocaleString()}
                                </button>
                              )}
                              {hasHalf && (
                                <button
                                  onClick={() => handleAddToCart(item, 'Half', item.half)}
                                  className="py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-center font-extrabold text-[11px] transition-all active:scale-95"
                                >
                                  Half: Rs. {Number(item.half).toLocaleString()}
                                </button>
                              )}
                            </div>
                          )}

                          {/* Family / Single Variant Options */}
                          {(hasFamily || hasSingle) && (
                            <div className="grid grid-cols-2 gap-1.5">
                              {hasFamily && (
                                <button
                                  onClick={() => handleAddToCart(item, 'Family', item.family)}
                                  className="py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-900 text-center font-extrabold text-[11px] transition-all active:scale-95"
                                >
                                  Family: Rs. {Number(item.family).toLocaleString()}
                                </button>
                              )}
                              {hasSingle && (
                                <button
                                  onClick={() => handleAddToCart(item, 'Single', item.single)}
                                  className="py-1.5 px-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-center font-extrabold text-[11px] transition-all active:scale-95"
                                >
                                  Single: Rs. {Number(item.single).toLocaleString()}
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-16 text-slate-400 font-medium text-sm">
                No items found in this category. Click <strong>Edit Products</strong> to add new items.
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
            {filteredItems.length} {filteredItems.length === 1 ? 'ITEM' : 'ITEMS'}
          </span>

          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-6 py-2"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SmbuttKarahiMenuModal;
