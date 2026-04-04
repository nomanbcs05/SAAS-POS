import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, X, Grid3x3, Package, Coffee, UtensilsCrossed, Gift, IceCream, Utensils, ShoppingBag, Truck, ChevronLeft, ChevronRight } from 'lucide-react';
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
import IndusMenuModal from './IndusMenuModal';
import { useMultiTenant } from '@/hooks/useMultiTenant';

const ProductGrid = () => {
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
    const baseCategories = [
      { id: 'all', name: 'All Category', icon: 'Grid3x3' },
      ...categories.map(c => ({ id: c.name, name: c.name, icon: c.icon }))
    ];
    
    if (tenant?.restaurant_name?.toLowerCase().includes('indus')) {
      // Check if it already exists to avoid duplicates
      if (!baseCategories.some(c => c.id === 'Indus Menu')) {
        baseCategories.push({ id: 'Indus Menu', name: 'Indus Menu', icon: 'Utensils' });
      }
    }
    
    return baseCategories;
  }, [categories, tenant]);

  const fuse = useMemo(() => new Fuse(allProducts, {
    keys: ['name', 'sku', 'barcode'],
    threshold: 0.3,
  }), [allProducts]);

  const filteredProducts = useMemo(() => {
    let products = allProducts;

    // Filter by selected category
    if (selectedCategory !== 'all') {
      products = products.filter(p => p.category === selectedCategory);
    }

    // Special logic for Arabic Broast: 
    // If NOT in the "Arabic Broast" category, hide individual items and only show the main "Injected Broast" card
    if (selectedCategory !== 'Arabic Broast') {
      const isBroastItem = (p: any) => p.category === 'Arabic Broast';
      const broastProducts = allProducts.filter(isBroastItem);
      
      if (broastProducts.length > 0) {
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
    } else {
      // If we ARE in the "Arabic Broast" category, don't show the virtual card
      products = products.filter(p => !(p as any).isVirtual);
    }

    // Special logic for Pizzas:
    // We want the Pizza Menu card to ALWAYS show up in 'all' category or 'Pizzas' category
    const isPizzasVisible = selectedCategory === 'all' || selectedCategory === 'Pizzas';
    
    if (isPizzasVisible) {
      const isPizzaItem = (p: any) => p.category === 'Pizzas';
      
      // Remove any individual pizza items that might be in the database
      products = products.filter(p => !isPizzaItem(p));
      
      const virtualPizza = {
        id: 'virtual-pizza-menu',
        name: 'Pizzas Menu',
        price: 0,
        category: 'Pizzas',
        image: '/Pizzas.png',
        imageFallbacks: ['/Pizzas.jpg', '/Pizza.png', '/pizza.png', '/pizza.jpg', '/Pizzas.jpeg'],
        isVirtual: true,
        modalType: 'pizza'
      };
      
      // Add the virtual pizza card at the beginning if it matches search
      if (!searchQuery.trim() || virtualPizza.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        products = [virtualPizza as any, ...products];
      }
    } else {
       // If we are in another category, hide any pizza items
       products = products.filter(p => p.category !== 'Pizzas' && !(p as any).isVirtual);
     }

     // Special logic for Rolls:
     const isRollsVisible = selectedCategory === 'all' || selectedCategory === 'Rolls';
     
     if (isRollsVisible) {
       const isRollItem = (p: any) => p.category === 'Rolls';
       products = products.filter(p => !isRollItem(p));
       
       const virtualRoll = {
         id: 'virtual-roll-menu',
         name: 'Rolls Menu',
         price: 0,
         category: 'Rolls',
          image: '/Rolls.png',
          imageFallbacks: ['/Rolls.jpg', '/Roll.png', '/roll.png', '/roll.jpg', '/Rolls.jpeg'],
         isVirtual: true,
         modalType: 'roll'
       };
       
       if (!searchQuery.trim() || virtualRoll.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualRoll as any, ...products];
       }
     } else {
       products = products.filter(p => p.category !== 'Rolls' && !(p as any).isVirtual);
     }

     // Special logic for Simple Broast:
     const isSimpleBroastVisible = selectedCategory === 'all' || selectedCategory === 'Broast';
     
     if (isSimpleBroastVisible) {
       const isSimpleBroastItem = (p: any) => p.category === 'Broast';
       products = products.filter(p => !isSimpleBroastItem(p));
       
       const virtualBroast = {
         id: 'virtual-broast-menu',
         name: 'Broast Menu',
         price: 0,
         category: 'Broast',
         image: '/Broast.png',
         imageFallbacks: ['/Broast.jpg', '/broast.png', '/broast.jpg', '/Broast.jpeg'],
         isVirtual: true,
         modalType: 'simple-broast'
       };
       
       if (!searchQuery.trim() || virtualBroast.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualBroast as any, ...products];
       }
     } else {
       products = products.filter(p => p.category !== 'Broast' && !(p as any).isVirtual);
     }

     // Special logic for Burgers:
     const isBurgersVisible = selectedCategory === 'all' || selectedCategory === 'Burgers';
     
     if (isBurgersVisible) {
       const isBurgerItem = (p: any) => p.category === 'Burgers';
       products = products.filter(p => !isBurgerItem(p));
       
      const virtualBurger = {
         id: 'virtual-burger-menu',
         name: 'Burgers Menu',
         price: 0,
         category: 'Burgers',
        image: '/Burgers.png',
        imageFallbacks: ['/Burgers.jpg', '/Burger.png', '/burger.png', '/burger.jpg', '/Burgers.jpeg'],
         isVirtual: true,
         modalType: 'burger'
       };
       
       if (!searchQuery.trim() || virtualBurger.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualBurger as any, ...products];
       }
     } else {
       products = products.filter(p => p.category !== 'Burgers' && !(p as any).isVirtual);
     }

     // Special logic for BAR BQ:
     const isBarBQVisible = selectedCategory === 'all' || selectedCategory === 'BAR BQ';
     
     if (isBarBQVisible) {
       const isBarBQItem = (p: any) => p.category === 'BAR BQ';
       products = products.filter(p => !isBarBQItem(p));
       
      const virtualBarBQ = {
         id: 'virtual-barbq-menu',
         name: 'BAR BQ Menu',
         price: 0,
         category: 'BAR BQ',
        image: '/Barbq.png',
        imageFallbacks: ['/Barbq.jpg', '/Barbq.jpeg', '/barbq.png', '/barbq.jpg'],
         isVirtual: true,
         modalType: 'barbq'
       };
       
       if (!searchQuery.trim() || virtualBarBQ.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualBarBQ as any, ...products];
       }
     } else {
       products = products.filter(p => p.category !== 'BAR BQ' && !(p as any).isVirtual);
     }

     // Special logic for Sauces & Toppings:
     const isSauceToppingVisible = selectedCategory === 'all' || selectedCategory === 'Sauces' || selectedCategory === 'Toppings' || selectedCategory === 'ALA CART';
     
     if (isSauceToppingVisible) {
       const isSauceToppingItem = (p: any) => p.category === 'Sauces' || p.category === 'Toppings';
       products = products.filter(p => !isSauceToppingItem(p));
       
      const virtualSauceTopping = {
         id: 'virtual-sauce-topping-menu',
         name: 'Sauces & Toppings',
         price: 0,
         category: 'ALA CART',
        image: '/sauces.png',
         isVirtual: true,
         modalType: 'sauce-topping'
       };
       
       if (!searchQuery.trim() || virtualSauceTopping.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualSauceTopping as any, ...products];
       }
     } else {
       products = products.filter(p => p.category !== 'Sauces' && p.category !== 'Toppings' && !(p as any).isVirtual);
     }

     // Special logic for Deals:
     const isDealsVisible = selectedCategory === 'all' || selectedCategory === 'Deals';
     
     if (isDealsVisible) {
       const isDealItem = (p: any) => p.category === 'Deals';
       products = products.filter(p => !isDealItem(p));
       
       const virtualDeals = {
         id: 'virtual-deals-menu',
         name: 'Virtual Deals Menu',
         price: 0,
         category: 'Deals',
         image: '/gx.png', // Fallback icon
         isVirtual: true,
         modalType: 'deals'
       };
       
       if (!searchQuery.trim() || virtualDeals.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualDeals as any, ...products];
       }
     } else {
       products = products.filter(p => p.category !== 'Deals' && !(p as any).isVirtual);
     }

     // Special logic for Fries:
     const isFriesVisible = selectedCategory === 'all' || selectedCategory === 'ALA CART';
     
     if (isFriesVisible) {
       const isFriesItem = (p: any) => p.name?.toLowerCase?.().includes('fries') && p.category === 'ALA CART';
       products = products.filter(p => !isFriesItem(p));
       
       const virtualFries = {
         id: 'virtual-fries-menu',
         name: 'Fries Menu',
         price: 0,
         category: 'ALA CART',
         image: '🍟',
         isVirtual: true,
         modalType: 'fries'
       };
       
       if (!searchQuery.trim() || virtualFries.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualFries as any, ...products];
       }
     }

     // Special logic for Beverages:
     const isBeveragesVisible = selectedCategory === 'all' || selectedCategory === 'Beverages';
     
     if (isBeveragesVisible) {
       products = products.filter(p => p.category !== 'Beverages');
       
       const virtualBeverages = {
         id: 'virtual-beverages-menu',
         name: 'Beverages Menu',
         price: 0,
         category: 'Beverages',
         image: '🥤',
         isVirtual: true,
         modalType: 'beverages'
       };
       
       if (!searchQuery.trim() || virtualBeverages.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualBeverages as any, ...products];
       }
     }

     // Special logic for ALA CART:
     const isAlaCartVisible = selectedCategory === 'all' || selectedCategory === 'ALA CART';
     
     if (isAlaCartVisible) {
       // Filter out items that are part of the virtual ALA CART menu
       const isAlaCartItem = (p: any) => p.category === 'ALA CART' && !p.isVirtual && !p.name.toLowerCase().includes('fries');
       products = products.filter(p => !isAlaCartItem(p));
       
       const virtualAlaCart = {
         id: 'virtual-alacart-menu',
         name: 'ALA CART Menu',
         price: 0,
         category: 'ALA CART',
         image: '🍱',
         isVirtual: true,
         modalType: 'alacart'
       };
       
       if (!searchQuery.trim() || virtualAlaCart.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualAlaCart as any, ...products];
       }
     }

     // Special logic for Cafe Indus:
     const isIndusVisible = (selectedCategory === 'all' || selectedCategory === 'Indus Menu') && 
                            tenant?.restaurant_name?.toLowerCase().includes('indus');
     
     if (isIndusVisible) {
       const virtualIndus = {
         id: 'virtual-indus-menu',
         name: 'Cafe Indus Menu',
         price: 0,
         category: 'Indus Menu',
         image: '🍲',
         isVirtual: true,
         modalType: 'indus'
       };
       
       if (!searchQuery.trim() || virtualIndus.name.toLowerCase().includes(searchQuery.toLowerCase())) {
         products = [virtualIndus as any, ...products];
       }
     }

     // Then filter by search
    if (searchQuery.trim()) {
      const searchResults = fuse.search(searchQuery);
      const searchIds = new Set(searchResults.map(r => r.item.id));
      products = products.filter(p => searchIds.has(p.id) || (p as any).isVirtual);
    }

    return products;
  }, [searchQuery, selectedCategory, fuse, allProducts]);

  const handleAddToCart = useCallback((product: Product) => {
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
        setShowIndusModal(true);
      }
      return;
    }
    addItem(product);
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
      />

      <RollSelectionModal
         isOpen={showRollModal}
         onClose={() => setShowRollModal(false)}
         onAdd={handleAddToCart}
       />

       <BroastSelectionModal
          isOpen={showSimpleBroastModal}
          onClose={() => setShowSimpleBroastModal(false)}
          onAdd={handleAddToCart}
        />

        <BurgerSelectionModal
           isOpen={showBurgerModal}
           onClose={() => setShowBurgerModal(false)}
           onAdd={handleAddToCart}
         />

         <BarBQSelectionModal
           isOpen={showBarBQModal}
          onClose={() => setShowBarBQModal(false)}
          onAdd={handleAddToCart}
        />

        <SauceToppingSelectionModal
          isOpen={showSauceToppingModal}
          onClose={() => setShowSauceToppingModal(false)}
          onAdd={handleAddToCart}
        />

        <DealsSelectionModal
          isOpen={showDealsModal}
          onClose={() => setShowDealsModal(false)}
          onAdd={handleAddToCart}
        />

        <FriesSelectionModal
          isOpen={showFriesModal}
          onClose={() => setShowFriesModal(false)}
          onAdd={handleAddToCart}
        />

        <BeveragesSelectionModal
           isOpen={showBeveragesModal}
           onClose={() => setShowBeveragesModal(false)}
           onAdd={handleAddToCart}
         />
 
         <AlaCartSelectionModal
           isOpen={showAlaCartModal}
           onClose={() => setShowAlaCartModal(false)}
           onAdd={handleAddToCart}
         />

         <IndusMenuModal
           isOpen={showIndusModal}
           onClose={() => setShowIndusModal(false)}
           onAdd={handleAddToCart}
         />
        </div>
    );
};

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

const ProductCard = ({ product, onAdd }: ProductCardProps) => {
  const isNoImageCategory = product.category === 'Arabic Broast' || product.category === 'ALA CART' || product.category === 'Snacks' || product.category === 'Beverages' || product.category === 'Pizzas' || product.category === 'Rolls' || product.category === 'Broast' || product.category === 'Burgers' || product.category === 'BAR BQ' || product.category === 'Sauces' || product.category === 'Toppings';
  const isVirtualSauce = (product as any).id === 'virtual-sauce-topping-menu';
  const isVirtualBarbq = (product as any).id === 'virtual-barbq-menu';
  const isVirtualBurger = (product as any).id === 'virtual-burger-menu';
  const isVirtualPizza = (product as any).id === 'virtual-pizza-menu';
  const isVirtualRoll = (product as any).id === 'virtual-roll-menu';
  const isVirtualIndus = (product as any).id === 'virtual-indus-menu';
  const isVirtualSimpleBroast = (product as any).id === 'virtual-broast-menu';
  const isLoadedFries = (product as any).name?.toLowerCase?.().includes('loaded fries');
  const forceShowImage = isVirtualSauce || isVirtualBarbq || isVirtualBurger || isVirtualPizza || isVirtualRoll || isVirtualSimpleBroast || isVirtualIndus || isLoadedFries;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>((product.image as any) || (isLoadedFries ? '/LoadedFries.png' : undefined));
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const fallbacks: string[] = (product as any).imageFallbacks || (isLoadedFries ? ['/LoadedFries.jpg', '/loadedfries.png', '/loadedfries.jpg'] : []);
  const imageHeightClass = forceShowImage ? "h-24 md:h-28" : "h-14";

  return (
    <motion.button
      whileHover={{ scale: 1.02, translateY: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onAdd(product)}
      className={cn(
        "relative w-full aspect-square p-3 bg-white rounded-xl border border-slate-100 shadow-sm transition-all",
        "hover:shadow-md hover:border-blue-200 hover:bg-blue-50/30",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/20",
        "flex flex-col items-center justify-center text-center gap-1.5 group"
      )}
    >
      {(product.image && (!isNoImageCategory || forceShowImage)) && (
        <div className={cn(
          "relative mb-2 w-full flex items-center justify-center overflow-hidden rounded-lg bg-slate-50/50",
          imageHeightClass
        )}>
          {currentSrc && (currentSrc.startsWith('http') || currentSrc.startsWith('/')) ? (
            <>
              {!imageLoaded && !imageError && (
                <div className="absolute inset-0 animate-pulse bg-slate-200/50 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
                </div>
              )}
              {imageError ? (
                <span className="text-xl opacity-50">📦</span>
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
                    "h-full w-full p-0.5 transition-all duration-500",
                    (isVirtualBarbq || isVirtualBurger || isVirtualPizza || isVirtualRoll || isVirtualSimpleBroast || isVirtualIndus) ? "object-cover" : "object-contain",
                    imageLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  )}
                />
              )}
            </>
          ) : (
            <span className="text-2xl group-hover:scale-110 transition-transform duration-300">
              {product.image}
            </span>
          )}
        </div>
      )}
      
      <h3 className={cn(
        "font-black font-heading text-slate-900 leading-tight line-clamp-2 px-1 text-[10px] md:text-[11px] tracking-tight uppercase",
        isNoImageCategory && "text-[11px] md:text-xs"
      )}>
        {product.name}
      </h3>
    </motion.button>
  );
};

export default ProductGrid;
