import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, X, Grid3x3, Package, Coffee, UtensilsCrossed, Gift, IceCream, Utensils, ShoppingBag, Truck, ChevronLeft, ChevronRight, ImagePlus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCartStore, Product } from '@/stores/cartStore';
import { api } from '@/services/api';
import Fuse from 'fuse.js';
import { motion, AnimatePresence } from 'framer-motion';
import TableSelectionModal from './TableSelectionModal';
import CustomerSelectionModal from './CustomerSelectionModal';
import RiderSelectionModal from './RiderSelectionModal';
import ArabicBroastModal from './ArabicBroastModal';
import PizzaSelectionModal from './PizzaSelectionModal';
import RollSelectionModal from './RollSelectionModal';
import BroastSelectionModal from './BroastSelectionModal';
import BurgerSelectionModal from './BurgerSelectionModal';
import BarBQSelectionModal from './BarBQSelectionModal';
import SauceToppingSelectionModal from './SauceToppingSelectionModal';
import DealsSelectionModal from './DealsSelectionModal';
import FriesSelectionModal from './FriesSelectionModal';
import BeveragesSelectionModal from './BeveragesSelectionModal';
import AlaCartSelectionModal from './AlaCartSelectionModal';
import IndusMenuModal, { DEFAULT_INDUS_DATA } from './IndusMenuModal';
import KhanshinwariMenuModal, { DEFAULT_KHANSHINWARI_DATA } from './KhanshinwariMenuModal';
import FreshBasketMenuModal, { DEFAULT_FRESHBASKET_DATA } from './FreshBasketMenuModal';
import GenXRestaurantMenuModal from './GenXRestaurantMenuModal';
import { useMultiTenant } from '@/hooks/useMultiTenant';
import ProductAmountCalculatorModal from './ProductAmountCalculatorModal';
import { RESTR_CATEGORIES, initializeRestaurantMenuDefaults } from '@/data/restaurantMenuData';
import SmbuttKarahiMenuModal, { SMBUTT_MENU_DATA } from './SmbuttKarahiMenuModal';

const ProductGrid = () => {
  const navigate = useNavigate();
  const { tenant } = useMultiTenant();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showTableModal, setShowTableModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showRiderModal, setShowRiderModal] = useState(false);
  const [showBroastModal, setShowBroastModal] = useState(false);
  const [showPizzaModal, setShowPizzaModal] = useState(false);
  const [showRollModal, setShowRollModal] = useState(false);
  const [showSimpleBroastModal, setShowSimpleBroastModal] = useState(false);
  const [showBurgerModal, setShowBurgerModal] = useState(false);
  const [showBarBQModal, setShowBarBQModal] = useState(false);
  const [showSauceToppingModal, setShowSauceToppingModal] = useState(false);
  const [showDealsModal, setShowDealsModal] = useState(false);
  const [showFriesModal, setShowFriesModal] = useState(false);
  const [showBeveragesModal, setShowBeveragesModal] = useState(false);
  const [showAlaCartModal, setShowAlaCartModal] = useState(false);
  const [showIndusModal, setShowIndusModal] = useState(false);
  const [showKhanshinwariModal, setShowKhanshinwariModal] = useState(false);
  const [showFreshBasketModal, setShowFreshBasketModal] = useState(false);
  const [showGenxRestaurantModal, setShowGenxRestaurantModal] = useState(false);
  const [showSmbuttModal, setShowSmbuttModal] = useState(false);
  const [selectedSmbuttCategory, setSelectedSmbuttCategory] = useState<string | undefined>(undefined);
  const [selectedIndusCategory, setSelectedIndusCategory] = useState<string | undefined>(undefined);
  const [selectedKhanshinwariCategory, setSelectedKhanshinwariCategory] = useState<string | undefined>(undefined);
  const [selectedFreshBasketCategory, setSelectedFreshBasketCategory] = useState<string | undefined>(undefined);
  const [selectedGenxCategory, setSelectedGenxCategory] = useState<{ name: string; key: string; iconName: string } | undefined>(undefined);
  const [localUpdateTrigger, setLocalUpdateTrigger] = useState(0);
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);

  // Seed restaurant menu defaults on mount (runs before POS renders cards)
  useEffect(() => {
    initializeRestaurantMenuDefaults();
  }, []);

  // Re-render product grid whenever Fresh Basket or custom cards update
  useEffect(() => {
    const handleUpdate = () => setLocalUpdateTrigger(prev => prev + 1);
    window.addEventListener('freshbasket-menu-updated', handleUpdate);
    window.addEventListener('pos-custom-cards-updated', handleUpdate);
    return () => {
      window.removeEventListener('freshbasket-menu-updated', handleUpdate);
      window.removeEventListener('pos-custom-cards-updated', handleUpdate);
    };
  }, []);
  const [selectedCalculatorProduct, setSelectedCalculatorProduct] = useState<Product | null>(null);
  
  const { data: openRegister } = useQuery({
    queryKey: ['open-register'],
    queryFn: api.registers.getOpen,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const { 
    addItem,
    orderType,
    setOrderType,
    tableId
  } = useCartStore();

  // Fetch Products
  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: api.products.getAll,
  });

  // Automatically seed menu items if none exist
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const seedMenu = useCallback(async () => {
    try {
      setSeeding(true);
      toast.loading('Seeding menu items...', { id: 'seed-toast' });
      const success = await api.products.seedArabicBroast();
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        toast.success('Menu items seeded successfully!', { id: 'seed-toast' });
      }
    } catch (error: any) {
      console.error('Seed error:', error);
      toast.error(`Failed to seed menu: ${error.message}`, { id: 'seed-toast' });
    } finally {
      setSeeding(false);
    }
  }, [queryClient]);

  useEffect(() => {
    // Only seed if we are sure products are loaded and the array is empty
    if (!productsLoading && allProducts.length === 0) {
      // In SaaS mode, we don't auto-seed anymore to show it's a clean slate
      console.log("ProductGrid: No products found for this tenant. Showing empty state.");
    }
  }, [allProducts, productsLoading]);

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories.getAll,
  });

  // Combine default "All" category with fetched categories
  const allCategories = useMemo(() => {
    let baseCategories = [
      { id: 'all', name: 'All Category', icon: 'Grid3x3' },
      ...categories.map(c => ({ id: c.name, name: c.name, icon: c.icon }))
    ];
    
    if (tenant?.restaurant_name?.toLowerCase().includes('indus')) {
      const indusCategories = [
        'RICE', 'CHICKEN (Karahi)', 'HANDI (Chicken)', 
        'MUTTON (Karahi)', 'MUTTON HANDI', 'VEGETARIAN',
        'FRIED', 'JOINTS', 'BBQ', 'NAAN_ROTI', 'SALADS', 'TEA'
      ];
      
      indusCategories.forEach(cat => {
        if (!baseCategories.some(c => c.id === cat)) {
          baseCategories.push({ id: cat, name: cat, icon: 'Utensils' });
        }
      });
    }
    
    if (tenant?.restaurant_name?.toLowerCase().includes('khanshinwari') || tenant?.restaurant_name?.toLowerCase().includes('khan shinwari')) {
      const khanCategories = Array.from(new Set(DEFAULT_KHANSHINWARI_DATA.map(item => item.category)));
      
      khanCategories.forEach(cat => {
        if (!baseCategories.some(c => c.id === cat)) {
          baseCategories.push({ id: cat, name: cat, icon: 'ChefHat' });
        }
      });
    }
    
    if (tenant?.restaurant_name?.toLowerCase().includes('fresh basket')) {
      baseCategories = baseCategories.filter(c => 
        c.id === 'all' || 
        c.name.toLowerCase() === 'fruits' || 
        c.name.toLowerCase() === 'vegetables' || 
        c.name.toLowerCase() === 'daily essentials' ||
        c.name.toUpperCase() === 'FRUITS' || 
        c.name.toUpperCase() === 'VEGETABLES' || 
        c.name.toUpperCase() === 'DAILY ESSENTIALS'
      );

      const freshBasketCategories = Array.from(new Set(DEFAULT_FRESHBASKET_DATA.map(item => item.category)));
      
      freshBasketCategories.forEach(cat => {
        if (!baseCategories.some(c => c.id === cat || c.name === cat)) {
          baseCategories.push({ id: cat, name: cat, icon: 'Apple' });
        }
      });
    }
    
    return baseCategories;
  }, [categories, tenant]);

  const fuse = useMemo(() => new Fuse(allProducts, {
    keys: ['name', 'sku', 'barcode'],
    threshold: 0.3,
  }), [allProducts]);

  const filteredProducts = useMemo(() => {
    let products = allProducts;
    
    // Load visibility settings
    const savedVisibility = localStorage.getItem('pos_card_visibility');
    const cardVisibility = savedVisibility ? JSON.parse(savedVisibility) : {};
    
    const isIndus = tenant?.restaurant_name?.toLowerCase().includes('indus');
    const isKhanshinwari = tenant?.restaurant_name?.toLowerCase().includes('khanshinwari') || tenant?.restaurant_name?.toLowerCase().includes('khan shinwari');
    const isFreshBasket = tenant?.restaurant_name?.toLowerCase().includes('fresh basket');
    const isSmbutt = tenant?.restaurant_name?.toLowerCase().includes('smbutt') || tenant?.restaurant_name?.toLowerCase().includes('sm butt');
    
    if (isFreshBasket) {
      products = products.filter(p => {
        const cat = p.category?.toLowerCase()?.trim();
        return cat === 'fruits' || cat === 'vegetables' || cat === 'daily essentials' ||
               cat === 'fruits menu' || cat === 'vegetables menu' || cat === 'daily essentials menu';
      });
    }
    
    const isCardVisible = (id: string) => {
      // For Smbutt Karahi — hide generic fast-food virtual cards, show only smbutt cards
      if (isSmbutt && ['pizza', 'burger', 'alacart', 'sauce', 'roll', 'broast', 'barbq', 'deals', 'fries', 'beverages'].includes(id)) {
        return false;
      }
      // Hide smbutt cards for non-smbutt tenants
      if (!isSmbutt && id.startsWith('smbutt_')) return false;
      // Specifically hide these for Cafe Indus, Khanshinwari & Fresh Basket
      if ((isIndus || isKhanshinwari) && ['pizza', 'burger', 'alacart', 'sauce', 'roll', 'broast'].includes(id)) {
        return false;
      }
      if (isFreshBasket && ['pizza', 'burger', 'alacart', 'sauce', 'roll', 'broast', 'barbq', 'deals', 'fries', 'beverages'].includes(id)) {
        return false;
      }
      return cardVisibility[id] !== false;
    };

    // Filter by selected category
    if (selectedCategory !== 'all') {
      products = products.filter(p => p.category?.toLowerCase() === selectedCategory?.toLowerCase());
    }

    // Special logic for Arabic Broast: 
    // If NOT in the "Arabic Broast" category, hide individual items and only show the main "Injected Broast" card
    if (selectedCategory?.toLowerCase() !== 'arabic broast') {
      const isBroastItem = (p: any) => p.category?.toLowerCase() === 'arabic broast';
      const broastProducts = allProducts.filter(isBroastItem);
      
      if (broastProducts.length > 0 && isCardVisible('broast')) {
        // Remove individual broast items from the current filtered list
        products = products.filter(p => !isBroastItem(p));
        
        // Add a single virtual product for "Injected Broast"
        const virtualBroast = {
          id: 'virtual-arabic-broast',
          name: 'Arabic Injected Broast',
          price: 0,
          category: 'Arabic Broast',
          image: '🍗',
          isVirtual: true,
          modalType: 'broast'
        };
        
        // Only show it if it matches search or search is empty
        if (!searchQuery.trim() || virtualBroast.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          products = [...products, virtualBroast as any];
        }
      }
    }

    // Special logic for Pizzas:
    // We want the Pizza Menu card to ALWAYS show up in 'all' category or 'Pizzas' category
    const isPizzasVisible = (selectedCategory === 'all' || selectedCategory?.toLowerCase() === 'pizzas') && isCardVisible('pizza');
    
    if (isPizzasVisible) {
      const virtualPizza = {
        id: 'virtual-pizza-menu',
        name: 'Pizzas Menu',
        price: 0,
        category: 'Pizzas',
        image: localStorage.getItem('pos_category_image_pizza') || '/Pizzas.png',
        imageFallbacks: ['/Pizzas.jpg', '/Pizza.png', '/pizza.png', '/pizza.jpg', '/Pizzas.jpeg'],
        isVirtual: true,
        modalType: 'pizza'
      };
      
      // Add the virtual pizza card at the beginning if it matches search
      if (!searchQuery.trim() || virtualPizza.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        products = [virtualPizza as any, ...products];
      }
    }

     // Special logic for Rolls:
     const isRollsVisible = (selectedCategory === 'all' || selectedCategory?.toLowerCase() === 'rolls') && isCardVisible('roll');
     
     if (isRollsVisible) {
       const virtualRoll = {
         id: 'virtual-roll-menu',
         name: 'Rolls Menu',
         price: 0,
         category: 'Rolls',
          image: localStorage.getItem('pos_category_image_roll') || '/Rolls.png',
          imageFallbacks: ['/Rolls.jpg', '/Roll.png', '/roll.png', '/roll.jpg', '/Rolls.jpeg'],
         isVirtual: true,
         modalType: 'roll'
       };
       
       if (!searchQuery.trim() || virtualRoll.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualRoll as any, ...products];
       }
     }

     // Special logic for Simple Broast:
     const isSimpleBroastVisible = (selectedCategory === 'all' || selectedCategory?.toLowerCase() === 'broast') && isCardVisible('broast');
     
     if (isSimpleBroastVisible) {
       const virtualBroast = {
         id: 'virtual-broast-menu',
         name: 'Broast Menu',
         price: 0,
         category: 'Broast',
         image: localStorage.getItem('pos_category_image_broast') || '/Broast.png',
         imageFallbacks: ['/Broast.jpg', '/broast.png', '/broast.jpg', '/Broast.jpeg'],
         isVirtual: true,
         modalType: 'simple-broast'
       };
       
       if (!searchQuery.trim() || virtualBroast.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualBroast as any, ...products];
       }
     }

     // Special logic for Burgers:
     const isBurgersVisible = (selectedCategory === 'all' || selectedCategory?.toLowerCase() === 'burgers') && isCardVisible('burger');
     
     if (isBurgersVisible) {
      const virtualBurger = {
         id: 'virtual-burger-menu',
         name: 'Burgers Menu',
         price: 0,
         category: 'Burgers',
        image: localStorage.getItem('pos_category_image_burger') || '/Burgers.png',
        imageFallbacks: ['/Burgers.jpg', '/Burger.png', '/burger.png', '/burger.jpg', '/Burgers.jpeg'],
         isVirtual: true,
         modalType: 'burger'
       };
       
       if (!searchQuery.trim() || virtualBurger.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualBurger as any, ...products];
       }
     }

     // Special logic for BAR BQ:
     const isBarBQVisible = (selectedCategory === 'all' || selectedCategory?.toLowerCase() === 'bar bq') && isCardVisible('barbq');
     
     if (isBarBQVisible) {
      const virtualBarBQ = {
         id: 'virtual-barbq-menu',
         name: 'BAR BQ Menu',
         price: 0,
         category: 'BAR BQ',
        image: localStorage.getItem('pos_category_image_barbq') || '/Barbq.png',
        imageFallbacks: ['/Barbq.jpg', '/Barbq.jpeg', '/barbq.png', '/barbq.jpg'],
         isVirtual: true,
         modalType: 'barbq'
       };
       
       if (!searchQuery.trim() || virtualBarBQ.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualBarBQ as any, ...products];
       }
     }

     // Special logic for Sauces & Toppings:
     const isSauceToppingVisible = (selectedCategory === 'all' || selectedCategory?.toLowerCase() === 'sauces' || selectedCategory?.toLowerCase() === 'toppings' || selectedCategory?.toLowerCase() === 'ala cart') && isCardVisible('sauce');
     
     if (isSauceToppingVisible) {
       const virtualSauceTopping = {
         id: 'virtual-sauce-topping-menu',
         name: 'Sauces & Toppings',
         price: 0,
         category: 'ALA CART',
        image: localStorage.getItem('pos_category_image_sauce') || '/sauces.png',
         isVirtual: true,
         modalType: 'sauce-topping'
       };
       
       if (!searchQuery.trim() || virtualSauceTopping.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualSauceTopping as any, ...products];
       }
     }

     // Special logic for Deals:
     const isDealsVisible = (selectedCategory === 'all' || selectedCategory?.toLowerCase() === 'deals') && isCardVisible('deals');
     
     if (isDealsVisible) {
       const virtualDeals = {
         id: 'virtual-deals-menu',
         name: 'Deals Menu',
         price: 0,
         category: 'Deals',
         image: localStorage.getItem('pos_category_image_deals') || '/gx.png', // Fallback icon
         isVirtual: true,
         modalType: 'deals'
       };
       
       if (!searchQuery.trim() || virtualDeals.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualDeals as any, ...products];
       }
     }

     // Special logic for Fries:
     const isFriesVisible = (selectedCategory === 'all' || selectedCategory?.toLowerCase() === 'ala cart') && isCardVisible('fries');
     
     if (isFriesVisible) {
       const virtualFries = {
         id: 'virtual-fries-menu',
         name: 'Fries Menu',
         price: 0,
         category: 'ALA CART',
         image: localStorage.getItem('pos_category_image_fries') || '🍟',
         isVirtual: true,
         modalType: 'fries'
       };
       
       if (!searchQuery.trim() || virtualFries.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualFries as any, ...products];
       }
     }

     // Special logic for Beverages:
     const isBeveragesVisible = (selectedCategory === 'all' || selectedCategory?.toLowerCase() === 'beverages') && isCardVisible('beverages');
     
     if (isBeveragesVisible) {
       const virtualBeverages = {
         id: 'virtual-beverages-menu',
         name: 'Beverages Menu',
         price: 0,
         category: 'Beverages',
         image: localStorage.getItem('pos_category_image_beverages') || '🥤',
         isVirtual: true,
         modalType: 'beverages'
       };
       
       if (!searchQuery.trim() || virtualBeverages.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualBeverages as any, ...products];
       }
     }

     // Special logic for ALA CART:
     const isAlaCartVisible = (selectedCategory === 'all' || selectedCategory?.toLowerCase() === 'ala cart') && isCardVisible('alacart');
     
     if (isAlaCartVisible) {
       const virtualAlaCart = {
         id: 'virtual-alacart-menu',
         name: 'ALA CART Menu',
         price: 0,
         category: 'ALA CART',
         image: localStorage.getItem('pos_category_image_alacart') || '🍱',
         isVirtual: true,
         modalType: 'alacart'
       };
       
       if (!searchQuery.trim() || virtualAlaCart.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualAlaCart as any, ...products];
       }
     }

     // Special logic for Cafe Indus Categories:
      if (isIndus && !isSmbutt) {
       const indusCategories = [
         { name: 'RICE', id: 'indus_rice', key: 'pos_menu_indus_rice' },
         { name: 'CHICKEN (Karahi)', id: 'indus_chicken_karahi', key: 'pos_menu_indus_chicken_karahi' },
         { name: 'HANDI (Chicken)', id: 'indus_handi', key: 'pos_menu_indus_handi_chicken' },
         { name: 'MUTTON (Karahi)', id: 'indus_mutton_karahi', key: 'pos_menu_indus_mutton_karahi' },
         { name: 'MUTTON HANDI', id: 'indus_mutton_handi', key: 'pos_menu_indus_mutton_handi' },
         { name: 'VEGETARIAN', id: 'indus_veg', key: 'pos_menu_indus_veg' },
         { name: 'FRIED', id: 'indus_fried', key: 'pos_menu_indus_fried' },
         { name: 'JOINTS', id: 'indus_joints', key: 'pos_menu_indus_joints' },
         { name: 'BBQ', id: 'indus_bbq', key: 'pos_menu_indus_bbq' },
         { name: 'NAAN_ROTI', id: 'indus_roti', key: 'pos_menu_indus_roti' },
         { name: 'SALADS', id: 'indus_salads', key: 'pos_menu_indus_salads' },
         { name: 'TEA', id: 'indus_tea', key: 'pos_menu_indus_tea' }
       ];

       indusCategories.forEach(cat => {
         const isCatSelected = selectedCategory === cat.name;
         const isAllSelected = selectedCategory === 'all';
         
         if ((isAllSelected || isCatSelected) && isCardVisible(cat.id)) {
           // 1. Add the Virtual Menu Card (only if it matches search or no search)
           const virtualCard = {
             id: `virtual-indus-card-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
             name: `${cat.name} Menu`,
             price: 0,
             category: cat.name,
             image: localStorage.getItem('pos_category_image_' + cat.id) || (cat.id === 'indus_tea' ? '/tea_menu.png' : cat.id === 'indus_bbq' ? '/Barbq.png' : cat.id === 'indus_salads' ? '/Salad.png' : cat.id === 'indus_roti' ? '/Naan.png' : cat.id === 'indus_fried' ? '/Fried.png' : cat.id === 'indus_mutton_handi' ? '/mutton_handi.png' : cat.id === 'indus_chicken_karahi' ? '/chicken_karahi.jpg' : '🍲'),
             isVirtual: true,
             modalType: 'indus',
             indusCategory: cat.name
           };
           
          if (!searchQuery.trim() || virtualCard.name.toLowerCase().includes(searchQuery.toLowerCase())) {
             products = [virtualCard as any, ...products];
           }

           // 2. Add individual items from this category if it's explicitly selected
          if (isCatSelected && !(cat.name === 'TEA' || cat.name === 'NAAN_ROTI')) {
             const saved = localStorage.getItem(cat.key);
             let items = [];
             if (saved) {
               items = JSON.parse(saved);
             } else {
               items = DEFAULT_INDUS_DATA.filter(item => item.category === cat.name);
             }

             items.forEach((item: any, idx: number) => {
               const productItem = {
                 id: `indus-item-${cat.name.toLowerCase()}-${idx}`,
                 name: item.name,
                 price: item.price || 0,
                 category: cat.name,
                 image: '🍲',
                 isVirtual: true,
                 modalType: item.sizes ? 'indus' : 'simple',
                 indusCategory: cat.name,
                 indusItem: item // Store the full item for size selection
               };

               if (!searchQuery.trim() || productItem.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                 products.push(productItem as any);
               }
             });
           }
         }
       });
      }

      // Special logic for Khanshinwari Categories:
       if (isKhanshinwari && !isSmbutt) {
        const khanCategories = [
          { name: 'CHICKEN KARHAI', id: 'khan_chicken_karahi' },
          { name: 'BBQ PLATTERS', id: 'khan_bbq_platters' },
          { name: 'EID ITEM', id: 'khan_eid_item' },
          { name: 'MUTTON ROSH', id: 'khan_mutton_rosh' },
          { name: 'MUTTON KARHAI', id: 'khan_mutton_karahi' },
          { name: 'NAMKEEN BOTI', id: 'khan_namkeen_boti' },
          { name: 'DRINKS', id: 'khan_drinks' },
          { name: 'TANDOOR', id: 'khan_tandoor' },
          { name: 'SALAD & RAITA', id: 'khan_salad_raita' },
          { name: 'BBQ ITEMS', id: 'khan_bbq_items' },
          { name: 'KEBABS', id: 'khan_kebabs' },
          { name: 'CHICKEN HANDI', id: 'khan_chicken_handi' },
          { name: 'MUTTON HANDI', id: 'khan_mutton_handi' },
          { name: 'KHEER', id: 'khan_kheer' }
        ];

        khanCategories.forEach(cat => {
          const isCatSelected = selectedCategory === cat.name;
          const isAllSelected = selectedCategory === 'all';
          
          if ((isAllSelected || isCatSelected) && isCardVisible(cat.id)) {
            // 1. Add the Virtual Menu Card
            const virtualCard = {
              id: `virtual-khan-card-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
              name: `${cat.name} Menu`,
              price: 0,
              category: cat.name,
              image: localStorage.getItem('pos_category_image_' + cat.id) || (
                cat.id.includes('chicken_karahi') ? '/chicken_karahi.jpg' : 
                cat.id.includes('karahi') ? '/Karahi.png' : 
                cat.id.includes('bbq') ? '/Barbq.png' : 
                cat.id.includes('mutton_handi') ? '/mutton_handi.png' :
                cat.id.includes('chicken_handi') ? '/chicken_handi.jpg' :
                cat.id.includes('handi') ? '/Handi.png' : 
                cat.id.includes('drinks') ? '🥤' : 
                cat.id.includes('tandoor') ? '/Naan.png' : 
                cat.id.includes('salad') ? '/Salad.png' : 
                cat.id.includes('kebab') ? '/kebabs.jpg' : 
                cat.id.includes('kheer') ? '/kheer.png' : '🍲'
              ),
              isVirtual: true,
              modalType: 'khanshinwari',
              khanCategory: cat.name
            };
            
            if (!searchQuery.trim() || virtualCard.name.toLowerCase().includes(searchQuery.toLowerCase())) {
              products = [virtualCard as any, ...products];
            }

            // 2. Add individual items if category selected
            if (isCatSelected) {
              const key = `pos_menu_khanshinwari_${cat.name.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '')}`;
              const saved = localStorage.getItem(key);
              let items = [];
              if (saved) {
                items = JSON.parse(saved);
              } else {
                items = DEFAULT_KHANSHINWARI_DATA.filter(item => item.category === cat.name);
              }

              items.forEach((item: any, idx: number) => {
                const productItem = {
                  id: `khan-item-${cat.name.toLowerCase()}-${idx}`,
                  name: item.name,
                  price: item.price || 0,
                  category: cat.name,
                  image: '🍲',
                  isVirtual: true,
                  modalType: item.sizes ? 'khanshinwari' : 'simple',
                  khanCategory: cat.name,
                  khanItem: item
                };

                if (!searchQuery.trim() || productItem.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                  products.push(productItem as any);
                }
              });
            }
          }
        });
      }

      // GenX Restaurant Categories (9 menu categories):
      if (!isSmbutt) RESTR_CATEGORIES.forEach(cat => {
        const isCatSelected = selectedCategory === cat.name;
        const isAllSelected = selectedCategory === 'all';

        if ((isAllSelected || isCatSelected) && isCardVisible(cat.id)) {
          const virtualCard = {
            id: `virtual-genx-card-${cat.id}`,
            name: cat.name,
            price: 0,
            category: cat.name,
            image: localStorage.getItem('pos_category_image_' + cat.key) || '🍽️',
            isVirtual: true,
            modalType: 'genx_restaurant',
            genxCategory: cat,
          };

          if (!searchQuery.trim() || virtualCard.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            products = [virtualCard as any, ...products];
          }
        }
      });

      // Custom Virtual Categories created via Manage Cards:
      const savedCustomCats = localStorage.getItem('custom_virtual_categories');
      if (savedCustomCats) {
        try {
          const customCats: any[] = JSON.parse(savedCustomCats);
          customCats.forEach(cat => {
            const isCatSelected = selectedCategory === cat.name;
            const isAllSelected = selectedCategory === 'all';

            if ((isAllSelected || isCatSelected) && isCardVisible(cat.id)) {
              const virtualCard = {
                id: `virtual-genx-card-${cat.id}`,
                name: cat.name,
                price: 0,
                category: cat.name,
                image: localStorage.getItem('pos_category_image_' + cat.key) || localStorage.getItem('pos_category_image_' + cat.id) || '🍽️',
                isVirtual: true,
                modalType: 'genx_restaurant',
                genxCategory: cat,
              };

              if (!searchQuery.trim() || virtualCard.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                products = [virtualCard as any, ...products];
              }
            }
          });
        } catch (_) {}
      }

      // SM Butt Karahi virtual menu cards (only for smbutt tenant):
      if (isSmbutt) {
        const smbuttCategories = Object.entries(SMBUTT_MENU_DATA).map(([key, val]) => ({
          id: `smbutt_${key.toLowerCase()}`,
          name: val.label,
          categoryKey: key,
          icon: val.icon,
        }));

        smbuttCategories.forEach(cat => {
          const isCatSelected = selectedCategory === cat.name;
          const isAllSelected = selectedCategory === 'all';

          if (isAllSelected || isCatSelected) {
            const virtualCard = {
              id: `virtual-smbutt-card-${cat.categoryKey}`,
              name: `${cat.name} Menu`,
              price: 0,
              category: cat.name,
              image: cat.icon,
              isVirtual: true,
              modalType: 'smbutt',
              smbuttCategory: cat.categoryKey,
            };
            if (!searchQuery.trim() || virtualCard.name.toLowerCase().includes(searchQuery.toLowerCase())) {
              products = [virtualCard as any, ...products];
            }
          }
        });
      }

      // Special logic for Fresh Basket Categories:
      if (isFreshBasket) {
        const freshBasketCategories = [
          { name: 'FRUITS', id: 'freshbasket_fruits', key: 'pos_menu_freshbasket_fruits' },
          { name: 'VEGETABLES', id: 'freshbasket_vegetables', key: 'pos_menu_freshbasket_vegetables' },
          { name: 'DAILY ESSENTIALS', id: 'freshbasket_essentials', key: 'pos_menu_freshbasket_daily_essentials' },
        ];

        freshBasketCategories.forEach(cat => {
          const isCatSelected = selectedCategory === cat.name;
          const isAllSelected = selectedCategory === 'all';
          
          if ((isAllSelected || isCatSelected) && isCardVisible(cat.id)) {
            // 1. Add the Virtual Menu Card
            const virtualCard = {
              id: `virtual-freshbasket-card-${cat.name.toLowerCase().replace(/\s+/g, '-')}`,
              name: `${cat.name} Menu`,
              price: 0,
              category: cat.name,
              image: localStorage.getItem('pos_category_image_' + cat.id) || (cat.name === 'VEGETABLES' ? '🥦' : cat.name === 'DAILY ESSENTIALS' ? '🍞' : '🍎'),
              isVirtual: true,
              modalType: 'freshbasket',
              freshBasketCategory: cat.name
            };
            
            if (!searchQuery.trim() || virtualCard.name.toLowerCase().includes(searchQuery.toLowerCase())) {
              products = [virtualCard as any, ...products];
            }

            // 2. Add individual items if category selected
            if (isCatSelected) {
              const saved = localStorage.getItem(cat.key);
              let items: any[] = [];
              if (saved) {
                items = JSON.parse(saved);
              } else {
                items = DEFAULT_FRESHBASKET_DATA.filter(item => item.category === cat.name);
              }

              // Merge DB products for this category into the grid items
              const dbCatProducts = allProducts.filter((p: any) => {
                const pCat = p.category?.toLowerCase()?.trim();
                return pCat === cat.name.toLowerCase();
              });
              const existingNames = new Set(items.map((i: any) => i.name?.toLowerCase()));
              dbCatProducts.forEach((p: any) => {
                if (!existingNames.has(p.name?.toLowerCase())) {
                  items.push({ name: p.name, price: p.price || 0, image: p.image || undefined, category: cat.name, unit: 'kg', _dbId: p.id });
                }
              });

              items.forEach((item: any, idx: number) => {
                const productItem = {
                  id: `freshbasket-item-${cat.name.toLowerCase()}-${idx}`,
                  name: item.name,
                  price: item.price || 0,
                  category: cat.name,
                  image: item.image || (cat.name === 'VEGETABLES' ? '🥦' : cat.name === 'DAILY ESSENTIALS' ? '🍞' : '🍎'),
                  isVirtual: true,
                  modalType: 'simple',
                  freshBasketCategory: cat.name,
                  freshBasketItem: item
                };

                if (!searchQuery.trim() || productItem.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                  products.push(productItem as any);
                }
              });
            }
          }
        });
      }

      // Then filter by search
    if (searchQuery.trim()) {
      const searchResults = fuse.search(searchQuery);
      const searchIds = new Set(searchResults.map(r => r.item.id));
      products = products.filter(p => searchIds.has(p.id) || (p as any).isVirtual);
    }

    return products;
  }, [searchQuery, selectedCategory, fuse, allProducts, tenant, localUpdateTrigger]);

  // Stable reference for DB products matching the selected fresh basket category
  const freshBasketDbProducts = useMemo(() => {
    const isFreshBasket = tenant?.restaurant_name?.toLowerCase().includes('fresh basket');
    if (!isFreshBasket) return [];
    return allProducts.filter((p: any) => {
      const cat = p.category?.toLowerCase()?.trim();
      if (!selectedFreshBasketCategory)
        return cat === 'fruits' || cat === 'vegetables' || cat === 'daily essentials';
      return cat === selectedFreshBasketCategory.toLowerCase();
    });
  }, [allProducts, selectedFreshBasketCategory, tenant]);

  // DB products per virtual category — passed to each modal so new products appear immediately
  const pizzaDbProducts = useMemo(() => allProducts.filter((p: any) => p.category?.toLowerCase() === 'pizzas'), [allProducts]);
  const burgerDbProducts = useMemo(() => allProducts.filter((p: any) => p.category?.toLowerCase() === 'burgers'), [allProducts]);
  const rollDbProducts = useMemo(() => allProducts.filter((p: any) => p.category?.toLowerCase() === 'rolls'), [allProducts]);
  const broastDbProducts = useMemo(() => allProducts.filter((p: any) => p.category?.toLowerCase() === 'broast'), [allProducts]);
  const barbqDbProducts = useMemo(() => allProducts.filter((p: any) => p.category?.toLowerCase() === 'bar bq'), [allProducts]);
  const beveragesDbProducts = useMemo(() => allProducts.filter((p: any) => p.category?.toLowerCase() === 'beverages'), [allProducts]);
  const friesDbProducts = useMemo(() => allProducts.filter((p: any) => p.category?.toLowerCase() === 'ala cart' || p.category?.toLowerCase() === 'fries'), [allProducts]);
  const alacartDbProducts = useMemo(() => allProducts.filter((p: any) => p.category?.toLowerCase() === 'ala cart'), [allProducts]);
  const dealsDbProducts = useMemo(() => allProducts.filter((p: any) => p.category?.toLowerCase() === 'deals'), [allProducts]);
  const indusDbProducts = useMemo(() => allProducts.filter((p: any) => {
    const cat = p.category?.toUpperCase()?.trim();
    return ['RICE','CHICKEN (KARAHI)','HANDI (CHICKEN)','MUTTON (KARAHI)','MUTTON HANDI','VEGETARIAN','FRIED','JOINTS','BBQ','NAAN_ROTI','SALADS','TEA'].includes(cat);
  }), [allProducts]);
  const khanshinwariDbProducts = useMemo(() => allProducts.filter((p: any) => {
    const cat = p.category?.toUpperCase()?.trim();
    return ['CHICKEN KARHAI','BBQ PLATTERS','EID ITEM','MUTTON ROSH','MUTTON KARHAI','NAMKEEN BOTI','DRINKS','TANDOOR','SALAD & RAITA','BBQ ITEMS','KEBABS','CHICKEN HANDI','MUTTON HANDI','KHEER'].includes(cat);
  }), [allProducts]);

  const handleUpdateProductImage = useCallback(async (productId: string, imageUrl: string) => {
    try {
      // 1. Virtual GenX restaurant category cards (e.g. virtual-genx-card-tandoor_bread, karahi, chinese, etc.)
      if (productId.startsWith('virtual-genx-card-')) {
        const genxId = productId.replace('virtual-genx-card-', '');
        const catObj = RESTR_CATEGORIES.find(c => c.id === genxId);
        if (catObj) {
          localStorage.setItem('pos_category_image_' + catObj.key, imageUrl);
          localStorage.setItem('pos_category_image_' + catObj.id, imageUrl);
        } else {
          localStorage.setItem('pos_category_image_' + genxId, imageUrl);
        }
        setLocalUpdateTrigger(prev => prev + 1);
        toast.success("Category card image updated!");
        return;
      }

      // 2. Specific virtual menu category cards
      if (productId.startsWith('virtual-')) {
        let keyToSave = '';
        if (productId === 'virtual-pizza-menu') keyToSave = 'pos_category_image_pizza';
        else if (productId === 'virtual-roll-menu') keyToSave = 'pos_category_image_roll';
        else if (productId === 'virtual-broast-menu') keyToSave = 'pos_category_image_broast';
        else if (productId === 'virtual-arabic-broast') keyToSave = 'pos_category_image_arabic_broast';
        else if (productId === 'virtual-burger-menu') keyToSave = 'pos_category_image_burger';
        else if (productId === 'virtual-barbq-menu') keyToSave = 'pos_category_image_barbq';
        else if (productId === 'virtual-sauce-topping-menu') keyToSave = 'pos_category_image_sauce';
        else if (productId === 'virtual-deals-menu') keyToSave = 'pos_category_image_deals';
        else if (productId === 'virtual-fries-menu') keyToSave = 'pos_category_image_fries';
        else if (productId === 'virtual-beverages-menu') keyToSave = 'pos_category_image_beverages';
        else if (productId === 'virtual-alacart-menu') keyToSave = 'pos_category_image_alacart';
        else if (productId.startsWith('virtual-indus-card-')) {
          const indusId = productId.replace('virtual-indus-card-', '');
          keyToSave = 'pos_category_image_' + indusId;
        } else if (productId.startsWith('virtual-khan-card-')) {
          const khanId = productId.replace('virtual-khan-card-', '');
          keyToSave = 'pos_category_image_' + khanId;
        } else if (productId.startsWith('virtual-freshbasket-card-')) {
          const fbId = productId.replace('virtual-freshbasket-card-', '');
          keyToSave = 'pos_category_image_' + fbId;
        } else {
          keyToSave = 'pos_category_image_' + productId.replace(/[^a-zA-Z0-9_]/g, '_');
        }

        if (keyToSave) {
          localStorage.setItem(keyToSave, imageUrl);
          setLocalUpdateTrigger(prev => prev + 1);
          toast.success("Category card image updated!");
        }
        return;
      }

      // 3. Fresh basket items
      if (productId.startsWith('freshbasket-item-')) {
        const prefix = 'freshbasket-item-';
        const withoutPrefix = productId.substring(prefix.length);
        const lastDashIndex = withoutPrefix.lastIndexOf('-');
        const catName = withoutPrefix.substring(0, lastDashIndex).toUpperCase();
        const idx = parseInt(withoutPrefix.substring(lastDashIndex + 1), 10);
        
        if (catName && !isNaN(idx)) {
          const freshBasketCategories = [
            { name: 'FRUITS', id: 'freshbasket_fruits', key: 'pos_menu_freshbasket_fruits' },
            { name: 'VEGETABLES', id: 'freshbasket_vegetables', key: 'pos_menu_freshbasket_vegetables' },
            { name: 'DAILY ESSENTIALS', id: 'freshbasket_essentials', key: 'pos_menu_freshbasket_essentials' },
          ];
          const matchedCat = freshBasketCategories.find(c => c.name === catName);
          if (matchedCat) {
            const saved = localStorage.getItem(matchedCat.key);
            let items = [];
            if (saved) {
              items = JSON.parse(saved);
            } else {
              items = DEFAULT_FRESHBASKET_DATA.filter(item => item.category === catName);
            }
            
            if (items[idx]) {
              items[idx].image = imageUrl;
              localStorage.setItem(matchedCat.key, JSON.stringify(items));
              setLocalUpdateTrigger(prev => prev + 1);
              toast.success("Item image updated!");
            }
          }
        }
        return;
      }

      // 4. Regular DB products
      await api.products.update(productId, { image: imageUrl });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success("Product image updated!");
    } catch (error: any) {
      console.error("Failed to update product image:", error);
      toast.error(error.message || "Failed to update product image");
    }
  }, [queryClient]);

  const handleAddToCart = useCallback((
    product: Product, 
    quantity?: number, 
    calcDetails?: {
      desiredAmount?: number;
      receivedCash?: number;
      remainingCash?: number;
      qtyMeasureLabel?: string;
    }
  ) => {
    if (calcDetails) {
      addItem(product, quantity, calcDetails);
      return;
    }

    if ((product as any).isVirtual) {
      if ((product as any).modalType === 'broast') {
        setShowBroastModal(true);
      } else if ((product as any).modalType === 'pizza') {
        setShowPizzaModal(true);
      } else if ((product as any).modalType === 'roll') {
        setShowRollModal(true);
      } else if ((product as any).modalType === 'simple-broast') {
        setShowSimpleBroastModal(true);
      } else if ((product as any).modalType === 'burger') {
        setShowBurgerModal(true);
      } else if ((product as any).modalType === 'barbq') {
        setShowBarBQModal(true);
      } else if ((product as any).modalType === 'sauce-topping') {
        setShowSauceToppingModal(true);
      } else if ((product as any).modalType === 'deals') {
        setShowDealsModal(true);
      } else if ((product as any).modalType === 'fries') {
        setShowFriesModal(true);
      } else if ((product as any).modalType === 'beverages') {
        setShowBeveragesModal(true);
      } else if ((product as any).modalType === 'alacart') {
        setShowAlaCartModal(true);
      } else if ((product as any).modalType === 'indus') {
        setSelectedIndusCategory((product as any).indusCategory);
        setShowIndusModal(true);
      } else if ((product as any).modalType === 'khanshinwari') {
        setSelectedKhanshinwariCategory((product as any).khanCategory);
        setShowKhanshinwariModal(true);
      } else if ((product as any).modalType === 'freshbasket') {
        setSelectedFreshBasketCategory((product as any).freshBasketCategory);
        setShowFreshBasketModal(true);
      } else if ((product as any).modalType === 'genx_restaurant') {
        setSelectedGenxCategory((product as any).genxCategory);
        setShowGenxRestaurantModal(true);
      } else if ((product as any).modalType === 'smbutt') {
        setSelectedSmbuttCategory((product as any).smbuttCategory);
        setShowSmbuttModal(true);
      } else if ((product as any).modalType === 'simple') {
        // Direct add for simple virtual items
        addItem(product, quantity || 1);
      }
      return;
    }
    // Directly add to cart with quantity — no calculator modal
    addItem(product, quantity || 1);
  }, [addItem]);

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and Order Type Selection */}
      <div className="p-4 border-b bg-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
            />
          </div>
          <Button 
            variant={orderType === 'dine_in' ? "default" : "outline"}
            className={cn(
              "h-11 flex items-center justify-center gap-2 text-base font-medium transition-all",
              orderType === 'dine_in' ? "bg-white text-blue-600 hover:bg-slate-50 border-2 border-blue-600 shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            )}
            onClick={() => {
              setOrderType('dine_in');
              if (!tableId) setShowTableModal(true);
            }}
          >
            <Utensils className="h-5 w-5" />
            Dine In
          </Button>
          <Button 
            variant={orderType === 'take_away' ? "default" : "outline"}
            className={cn(
              "h-11 flex items-center justify-center gap-2 text-base font-medium transition-all",
              orderType === 'take_away' ? "bg-white text-blue-600 hover:bg-slate-50 border-2 border-blue-600 shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            )}
            onClick={() => {
              setOrderType('take_away');
              setShowCustomerModal(true);
            }}
          >
            <ShoppingBag className="h-5 w-5" />
            Take Away
          </Button>
          <Button 
            variant={orderType === 'delivery' ? "default" : "outline"}
            className={cn(
              "h-11 flex items-center justify-center gap-2 text-base font-medium transition-all",
              orderType === 'delivery' ? "bg-white text-blue-600 hover:bg-slate-50 border-2 border-blue-600 shadow-sm" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
            )}
            onClick={() => {
              setOrderType('delivery');
              setShowCustomerModal(true);
            }}
          >
            <Truck className="h-5 w-5" />
            Delivery
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-4 py-3 border-b bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full hover:bg-slate-100"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </Button>

          <div 
            ref={scrollContainerRef}
            className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth py-1"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          >
            {allCategories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                className={cn(
                  "whitespace-nowrap px-6 h-9 rounded-full transition-all text-sm font-bold font-heading uppercase tracking-wide",
                  selectedCategory === category.id 
                    ? "bg-white text-blue-600 border-2 border-blue-600 shadow-md" 
                    : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100 hover:text-blue-600"
                )}
                onClick={() => setSelectedCategory(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full hover:bg-slate-100"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </Button>
          
          <div className="w-px h-6 bg-slate-200 mx-1 shrink-0" />
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => seedMenu()}
            className="whitespace-nowrap text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors shrink-0"
          >
            Refresh Menu
          </Button>
        </div>
      </div>

      {/* Products Grid */}
      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {productsLoading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square bg-slate-100 animate-pulse rounded-xl" />
            ))
          ) : (
            filteredProducts.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                onAdd={handleAddToCart} 
                onUpdateImage={handleUpdateProductImage}
              />
            ))
          )}
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No products found</p>
            <p className="text-sm">Try adjusting your search or category filter</p>
          </div>
        )}
      </ScrollArea>
      
      <TableSelectionModal 
        isOpen={showTableModal} 
        onClose={() => setShowTableModal(false)} 
      />
      
      <CustomerSelectionModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSaved={() => {
          if (orderType === 'delivery') {
            setShowRiderModal(true);
          }
        }}
      />

      <RiderSelectionModal
        isOpen={showRiderModal}
        onClose={() => setShowRiderModal(false)}
      />

      <ArabicBroastModal
        isOpen={showBroastModal}
        onClose={() => setShowBroastModal(false)}
        products={allProducts.filter(p => p.category === 'Arabic Broast')}
        onAdd={handleAddToCart}
      />

      <PizzaSelectionModal
        isOpen={showPizzaModal}
        onClose={() => setShowPizzaModal(false)}
        onAdd={handleAddToCart}
        dbProducts={pizzaDbProducts}
      />

      <RollSelectionModal
         isOpen={showRollModal}
         onClose={() => setShowRollModal(false)}
         onAdd={handleAddToCart}
         dbProducts={rollDbProducts}
       />

       <BroastSelectionModal
          isOpen={showSimpleBroastModal}
          onClose={() => setShowSimpleBroastModal(false)}
          onAdd={handleAddToCart}
          dbProducts={broastDbProducts}
        />

        <BurgerSelectionModal
           isOpen={showBurgerModal}
           onClose={() => setShowBurgerModal(false)}
           onAdd={handleAddToCart}
           dbProducts={burgerDbProducts}
         />

         <BarBQSelectionModal
           isOpen={showBarBQModal}
          onClose={() => setShowBarBQModal(false)}
          onAdd={handleAddToCart}
          dbProducts={barbqDbProducts}
        />

        <SauceToppingSelectionModal
          isOpen={showSauceToppingModal}
          onClose={() => setShowSauceToppingModal(false)}
          onAdd={handleAddToCart}
          dbProducts={alacartDbProducts}
        />

        <DealsSelectionModal
          isOpen={showDealsModal}
          onClose={() => setShowDealsModal(false)}
          onAdd={handleAddToCart}
          dbProducts={dealsDbProducts}
        />

        <FriesSelectionModal
          isOpen={showFriesModal}
          onClose={() => setShowFriesModal(false)}
          onAdd={handleAddToCart}
          dbProducts={friesDbProducts}
        />

        <BeveragesSelectionModal
           isOpen={showBeveragesModal}
           onClose={() => setShowBeveragesModal(false)}
           onAdd={handleAddToCart}
           dbProducts={beveragesDbProducts}
         />
 
         <AlaCartSelectionModal
           isOpen={showAlaCartModal}
           onClose={() => setShowAlaCartModal(false)}
           onAdd={handleAddToCart}
           dbProducts={alacartDbProducts}
         />

         <IndusMenuModal
            isOpen={showIndusModal}
            onClose={() => {
              setShowIndusModal(false);
              setSelectedIndusCategory(undefined);
            }}
            onAdd={handleAddToCart}
            category={selectedIndusCategory}
            dbProducts={indusDbProducts}
          />

          <KhanshinwariMenuModal
            isOpen={showKhanshinwariModal}
            onClose={() => {
              setShowKhanshinwariModal(false);
              setSelectedKhanshinwariCategory(undefined);
            }}
            onAdd={handleAddToCart}
            category={selectedKhanshinwariCategory}
            dbProducts={khanshinwariDbProducts}
          />

          <FreshBasketMenuModal
            isOpen={showFreshBasketModal}
            onClose={() => {
              setShowFreshBasketModal(false);
              setSelectedFreshBasketCategory(undefined);
            }}
            onAdd={handleAddToCart}
            category={selectedFreshBasketCategory}
            dbProducts={freshBasketDbProducts}
          />

          <GenXRestaurantMenuModal
            isOpen={showGenxRestaurantModal}
            onClose={() => {
              setShowGenxRestaurantModal(false);
              setSelectedGenxCategory(undefined);
            }}
            onAdd={handleAddToCart}
            categoryName={selectedGenxCategory?.name}
            menuKey={selectedGenxCategory?.key}
            iconName={selectedGenxCategory?.iconName}
          />

          <SmbuttKarahiMenuModal
            open={showSmbuttModal}
            onOpenChange={(open) => {
              setShowSmbuttModal(open);
              if (!open) setSelectedSmbuttCategory(undefined);
            }}
            defaultCategory={selectedSmbuttCategory as any}
          />

          <ProductAmountCalculatorModal
            isOpen={isCalculatorModalOpen}
            onClose={() => {
              setIsCalculatorModalOpen(false);
              setSelectedCalculatorProduct(null);
            }}
            product={selectedCalculatorProduct}
            onAdd={handleAddToCart}
          />
        </div>
    );
};

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  onUpdateImage: (productId: string, imageUrl: string) => void;
}

const ProductCard = ({ product, onAdd, onUpdateImage }: ProductCardProps) => {
  const isNoImageCategory = product.category === 'Arabic Broast' || product.category === 'ALA CART' || product.category === 'Snacks' || product.category === 'Beverages' || product.category === 'Pizzas' || product.category === 'Rolls' || product.category === 'Broast' || product.category === 'Burgers' || product.category === 'BAR BQ' || product.category === 'Sauces' || product.category === 'Toppings' || product.category === 'DRY' || product.category === 'CHINESE GRAVY' || product.category === 'RICE' || product.category === 'CHICKEN (Karahi)' || product.category === 'HANDI (Chicken)' || product.category === 'MUTTON (Karahi)' || product.category === 'MUTTON HANDI' || product.category === 'CHAI' || product.category === 'ROTI';
  const isVirtualSauce = (product as any).id === 'virtual-sauce-topping-menu';
  const isVirtualBarbq = (product as any).id === 'virtual-barbq-menu';
  const isVirtualBurger = (product as any).id === 'virtual-burger-menu';
  const isVirtualPizza = (product as any).id === 'virtual-pizza-menu';
  const isVirtualRoll = (product as any).id === 'virtual-roll-menu';
  const isVirtualIndus = (product as any).id?.startsWith?.('virtual-indus-');
  const isVirtualKhan = (product as any).id?.startsWith?.('virtual-khan-');
  const isVirtualSimpleBroast = (product as any).id === 'virtual-broast-menu';
  const isLoadedFries = (product as any).name?.toLowerCase?.().includes('loaded fries');
  const isVirtualDeals = (product as any).id === 'virtual-deals-menu';
  // Declare all state BEFORE using state variables in derived values
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>((product.image as any) || (isLoadedFries ? '/LoadedFries.png' : undefined));
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fallbacks: string[] = (product as any).imageFallbacks || (isLoadedFries ? ['/LoadedFries.jpg', '/loadedfries.png', '/loadedfries.jpg'] : []);
  const forceShowImage = isVirtualSauce || isVirtualBarbq || isVirtualBurger || isVirtualPizza || isVirtualRoll || isVirtualSimpleBroast || isVirtualIndus || isVirtualKhan || isLoadedFries || isVirtualDeals || (product as any).isVirtual || (currentSrc && (currentSrc.startsWith('http') || currentSrc.startsWith('/') || currentSrc.startsWith('data:')));
  const imageHeightClass = forceShowImage ? "h-24 md:h-28" : "h-14";

  useEffect(() => {
    setCurrentSrc(product.image);
    setImageLoaded(false);
    setImageError(false);
  }, [product.image]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setUploading(true);
      toast.loading("Uploading image...", { id: `upload-${product.id}` });
      const url = await api.products.uploadImage(file);
      onUpdateImage(product.id, url);
      toast.success("Image uploaded successfully!", { id: `upload-${product.id}` });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to upload image", { id: `upload-${product.id}` });
    } finally {
      setUploading(false);
    }
  };

  const isVirtual = (product as any).isVirtual;
  const showPrice = !isVirtual || ((product as any).modalType === 'simple' && product.price > 0);
  const stockQty = (product as any).stock_quantity ?? (product as any).stock ?? null;
  const isLowStock = stockQty !== null && stockQty <= 5 && stockQty > 0;
  const isOutOfStock = stockQty !== null && stockQty === 0;

  return (
    <motion.div
      whileHover={{ scale: 1.03, translateY: -3 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => onAdd(product)}
      className={cn(
        "relative w-full rounded-2xl overflow-hidden cursor-pointer group",
        "bg-white border border-slate-100/80",
        "shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(59,130,246,0.18)]",
        "transition-all duration-200",
        "flex flex-col",
        isOutOfStock && "opacity-60"
      )}
      style={{ minHeight: '140px' }}
    >
      {/* Top image / emoji area */}
      <div className={cn(
        "relative flex items-center justify-center w-full overflow-hidden",
        (product.image && (!isNoImageCategory || forceShowImage)) ? "h-[80px] md:h-[90px]" : "h-[56px]",
        "bg-gradient-to-br from-slate-50 to-blue-50/40"
      )}>
        {/* Shimmer bg on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-indigo-500/0 group-hover:from-blue-400/5 group-hover:to-indigo-500/10 transition-all duration-300" />

        {product.image && (!isNoImageCategory || forceShowImage) ? (
          currentSrc && (currentSrc.startsWith('http') || currentSrc.startsWith('/') || currentSrc.startsWith('data:')) ? (
            <>
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 animate-pulse bg-slate-200/60 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
                </div>
              )}
              {imageError ? (
                <span className="text-3xl opacity-40">📦</span>
              ) : (
                <img
                  src={currentSrc}
                  alt={product.name}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    if (fallbackIndex < fallbacks.length) {
                      setCurrentSrc(fallbacks[fallbackIndex]);
                      setFallbackIndex(fallbackIndex + 1);
                    } else {
                      setImageError(true);
                    }
                  }}
                  className={cn(
                    "h-full w-full transition-all duration-500",
                    (isVirtualBarbq || isVirtualBurger || isVirtualPizza || isVirtualRoll || isVirtualSimpleBroast || isVirtualIndus || isVirtualDeals || (product as any).isVirtual) ? "object-cover" : "object-contain p-1",
                    imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  )}
                />
              )}
            </>
          ) : (
            <span className="text-3xl group-hover:scale-110 transition-transform duration-300 select-none">
              {product.image}
            </span>
          )
        ) : (
          <span className="text-3xl select-none opacity-70">
            {isNoImageCategory ? '🍽️' : '📦'}
          </span>
        )}

        {/* Upload Image Button on EVERY card */}
        <div
          className="absolute top-1.5 right-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <label 
            className="flex items-center justify-center h-7 w-7 rounded-full bg-white/95 border border-slate-300 hover:bg-blue-50 hover:border-blue-500 shadow-md cursor-pointer transition-all active:scale-95 text-slate-700 hover:text-blue-600"
            title="Upload Card Image"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5 text-slate-600 hover:text-blue-600" />
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        {/* Low / Out of stock badge */}
        {isOutOfStock && (
          <div className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow z-10 uppercase tracking-wide">
            Out
          </div>
        )}
        {isLowStock && (
          <div className="absolute top-1.5 left-1.5 bg-amber-400 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow z-10 uppercase tracking-wide">
            Low
          </div>
        )}
      </div>

      {/* Bottom info area */}
      <div className="flex flex-col items-center justify-center flex-1 px-2 pt-1.5 pb-2 gap-1 text-center">
        <h3 className={cn(
          "font-extrabold text-slate-800 leading-tight line-clamp-2 tracking-tight uppercase w-full",
          "text-[9px] md:text-[10px]"
        )}>
          {product.name}
        </h3>

        {/* Price badge */}
        {showPrice && product.price > 0 ? (
          <div className="mt-0.5 px-2.5 py-0.5 rounded-full text-white font-black text-[10px] md:text-[11px] tracking-wide shadow-sm"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}
          >
            Rs. {product.price.toLocaleString()}
          </div>
        ) : isVirtual && !showPrice ? (
          <div className="mt-0.5 px-2.5 py-0.5 rounded-full font-bold text-[9px] tracking-wide border"
            style={{ color: '#6366f1', borderColor: '#c7d2fe', background: '#eef2ff' }}
          >
            TAP TO ORDER
          </div>
        ) : null}
      </div>

      {/* Bottom accent line on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-b-2xl" />
    </motion.div>
  );
};

export default ProductGrid;
