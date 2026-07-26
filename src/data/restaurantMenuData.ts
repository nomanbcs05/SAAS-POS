export interface MenuItemData {
  name: string;
  price: number;
  sizes?: Record<string, number>;
  image?: string;
  category?: string;
}

export const RESTR_CATEGORIES = [
  { id: 'karahi', name: 'Karahi', key: 'pos_menu_karahi', iconName: 'Flame' },
  { id: 'barbq', name: 'Bar.B.Q', key: 'pos_menu_barbq_menu', iconName: 'Flame' },
  { id: 'handi', name: 'Handi', key: 'pos_menu_handi', iconName: 'ChefHat' },
  { id: 'side_items', name: 'Side Items', key: 'pos_menu_side_items', iconName: 'Package' },
  { id: 'salad_raita', name: 'Salad & Raita', key: 'pos_menu_salad_raita', iconName: 'Utensils' },
  { id: 'chinese', name: 'Chinese', key: 'pos_menu_chinese', iconName: 'Utensils' },
  { id: 'beverages_menu', name: 'Beverages', key: 'pos_menu_beverages_menu', iconName: 'Coffee' },
  { id: 'ice_cream_drinks', name: 'Ice Cream & Drinks', key: 'pos_menu_ice_cream_drinks', iconName: 'Coffee' },
  { id: 'tandoor_bread', name: 'Tandoor / Bread', key: 'pos_menu_tandoor_bread', iconName: 'Layers' },
];

export const RESTR_MENU_ITEMS: Record<string, MenuItemData[]> = {
  pos_menu_karahi: [
    { name: "Mutton Karahi (Raan)", price: 5000, sizes: { Full: 5000, Half: 2600 }, image: "" },
    { name: "Mutton Karahi Ghutti (Raan)", price: 5600, sizes: { Full: 5600, Half: 2900 }, image: "" },
    { name: "Mutton Karahi White (Raan)", price: 5200, sizes: { Full: 5200, Half: 2700 }, image: "" },
    { name: "Mutton Karahi Ghutti White (Raan)", price: 5800, sizes: { Full: 5800, Half: 3000 }, image: "" },
    { name: "Chicken Karahi", price: 2400, sizes: { Full: 2400, Half: 1300 }, image: "" },
    { name: "Chicken Karahi Ghutti", price: 3000, sizes: { Full: 3000, Half: 1600 }, image: "" },
    { name: "Chicken Karahi White", price: 2600, sizes: { Full: 2600, Half: 1400 }, image: "" },
    { name: "Chicken Karahi Ghutti White", price: 3200, sizes: { Full: 3200, Half: 1700 }, image: "" },
    { name: "Desi Murgh Karahi", price: 4400, sizes: { Full: 4400, Half: 2300 }, image: "" },
    { name: "Desi Murgh Karahi Ghutti", price: 5000, sizes: { Full: 5000, Half: 2600 }, image: "" },
  ],
  pos_menu_barbq_menu: [
    { name: "Chicken Tikka", price: 600, image: "" },
    { name: "Chicken Chest Piece", price: 650, image: "" },
    { name: "Chicken Malai Boti (8 pcs)", price: 1200, image: "" },
    { name: "Chicken Boti (8 pcs)", price: 1000, image: "" },
    { name: "Chicken Astor Boti (8 pcs)", price: 1250, image: "" },
    { name: "Chicken Behari Kabab (Skewers) (4 pcs)", price: 1500, sizes: { Full: 1500, Half: 800 }, image: "" },
    { name: "Chicken Tarkash Kabab (4 pcs)", price: 1600, sizes: { Full: 1600, Half: 850 }, image: "" },
    { name: "Chicken Reshmi Kabab (4 pcs)", price: 1400, sizes: { Full: 1400, Half: 750 }, image: "" },
    { name: "Fish Tikka (4 pcs)", price: 1600, sizes: { Full: 1600, Half: 850 }, image: "" },
    { name: "Bar.B.Q Gol Fish", price: 2200, image: "" },
    { name: "Tali Fish (6 pcs)", price: 1400, image: "" },
    { name: "Bar.B.Q Double Platter", price: 2500, image: "" },
    { name: "Bar.B.Q Family Platter", price: 5000, image: "" },
  ],
  pos_menu_handi: [
    { name: "Chicken Handi", price: 2200, image: "" },
    { name: "Chicken Ghutti Handi", price: 3000, image: "" },
    { name: "Chicken Green Handi", price: 2400, image: "" },
    { name: "K&S Vegetable", price: 900, image: "" },
    { name: "Shahi Daal Ghutti", price: 900, image: "" },
  ],
  pos_menu_side_items: [
    { name: "French Fries", price: 500, image: "" },
  ],
  pos_menu_salad_raita: [
    { name: "Fresh Green Salad", price: 250, image: "" },
    { name: "Kachumber Salad", price: 300, image: "" },
    { name: "Raita", price: 700, image: "" },
    { name: "Green Raita", price: 250, image: "" },
  ],
  pos_menu_chinese: [
    { name: "Hot & Sour Soup", price: 1500, sizes: { Family: 1500, Single: 500 }, image: "" },
    { name: "Chicken Corn Soup", price: 1200, sizes: { Family: 1200, Single: 500 }, image: "" },
    { name: "Vegetable Soup", price: 1600, sizes: { Family: 1600, Single: 600 }, image: "" },
    { name: "Chicken Thai Soup", price: 1500, sizes: { Family: 1500, Single: 500 }, image: "" },
    { name: "Egg Fried Rice", price: 900, image: "" },
    { name: "Chicken Fried Rice", price: 1050, image: "" },
    { name: "Vegetable Rice", price: 900, image: "" },
    { name: "Chicken Schezwan Rice", price: 1100, image: "" },
    { name: "Chicken Manchurian + Rice", price: 1250, image: "" },
    { name: "Chicken Shashlik + Rice", price: 1200, image: "" },
    { name: "Kung Pao + Rice", price: 1200, image: "" },
    { name: "Chicken Chili Dry + Rice", price: 1300, image: "" },
    { name: "Chicken Chow Mein", price: 1500, image: "" },
    { name: "Vegetable Chow Mein", price: 1400, image: "" },
    { name: "Chicken Shashlik & Chow Mein", price: 1600, image: "" },
    { name: "Dragon Chicken", price: 1200, image: "" },
    { name: "Chicken Wings (8 pcs)", price: 900, image: "" },
    { name: "Chicken Drumsticks (6 pcs)", price: 1100, image: "" },
    { name: "Alfredo Pasta", price: 900, image: "" },
  ],
  pos_menu_beverages_menu: [
    { name: "Mint Margarita", price: 600, image: "" },
    { name: "Lemon Soda", price: 400, image: "" },
    { name: "Blueberry Margarita", price: 500, image: "" },
    { name: "Peach Margarita", price: 550, image: "" },
    { name: "Oreo Shake", price: 700, image: "" },
    { name: "Chocolate Shake", price: 700, image: "" },
    { name: "Pina Colada", price: 500, image: "" },
    { name: "Lassi Plain", price: 400, image: "" },
    { name: "Lassi Sweet", price: 400, image: "" },
  ],
  pos_menu_ice_cream_drinks: [
    { name: "Mineral Water", price: 160, sizes: { Large: 160, Small: 110 }, image: "" },
    { name: "Cold Drink Can", price: 140, image: "" },
    { name: "Doodh Pati Tea", price: 200, image: "" },
    { name: "Green Tea", price: 150, image: "" },
  ],
  pos_menu_tandoor_bread: [
    { name: "Chapati", price: 50, image: "" },
    { name: "Plain Naan", price: 70, image: "" },
    { name: "Garlic Naan", price: 150, image: "" },
    { name: "Roghni Naan", price: 150, image: "" },
    { name: "Kulcha Naan", price: 160, image: "" },
  ]
};

export const initializeRestaurantMenuDefaults = () => {
  // Populate menu items if not set
  Object.entries(RESTR_MENU_ITEMS).forEach(([key, items]) => {
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(items));
    }
  });

  // Setup card visibility
  const existingVisRaw = localStorage.getItem('pos_card_visibility');
  const existingVis: Record<string, boolean> = existingVisRaw ? JSON.parse(existingVisRaw) : {};

  // Always hide legacy cards
  const legacyHide: Record<string, boolean> = {
    freshbasket_fruits: false,
    freshbasket_vegetables: false,
    freshbasket_essentials: false,
    pizza: false,
    burger: false,
    broast: false,
    alacart: false,
    fries: false,
    beverages: false,  // legacy "beverages" card
    deals: false,
    roll: false,
    sauce: false,
  };

  // Restaurant category IDs that must be visible (only set if not explicitly managed by user)
  const restaurantShow: Record<string, boolean> = {
    karahi: true,
    barbq: true,
    handi: true,
    side_items: true,
    salad_raita: true,
    chinese: true,
    beverages_menu: true,   // RESTR_CATEGORIES id for Beverages
    ice_cream_drinks: true,
    tandoor_bread: true,
  };

  // Merge: existing overrides legacy hides for restaurant cards,
  // but always hide legacy and default-show restaurant cards if not set
  const merged: Record<string, boolean> = {
    ...legacyHide,
    ...existingVis,   // user's Manage Cards choices survive
  };

  // Always ensure restaurant categories have at least a "true" default if not set
  Object.entries(restaurantShow).forEach(([id, val]) => {
    if (merged[id] === undefined) {
      merged[id] = val;
    }
  });

  localStorage.setItem('pos_card_visibility', JSON.stringify(merged));
};

