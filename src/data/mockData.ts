import { Product, Customer } from '@/stores/cartStore';

export const categories = [
  { id: 'all', name: 'All Category', icon: 'Grid3x3' },
  { id: 'beverages', name: 'Beverages', icon: 'Coffee' },
  { id: 'food', name: 'Food', icon: 'UtensilsCrossed' },
  { id: 'snacks', name: 'Snacks', icon: 'Cookie' },
  { id: 'desserts', name: 'Desserts', icon: 'Cake' },
  { id: 'merchandise', name: 'Merchandise', icon: 'ShoppingBag' },
];

export const products: Product[] = [
  // Beverages
  { id: '1', name: 'Espresso', sku: 'BEV001', price: 350, cost: 100, stock: 100, category: 'beverages', image: '☕' },
  { id: '2', name: 'Americano', sku: 'BEV002', price: 400, cost: 120, stock: 100, category: 'beverages', image: '☕' },
  { id: '3', name: 'Cappuccino', sku: 'BEV003', price: 550, cost: 180, stock: 85, category: 'beverages', image: '☕' },
  { id: '4', name: 'Latte', sku: 'BEV004', price: 600, cost: 200, stock: 90, category: 'beverages', image: '🥛' },
  { id: '5', name: 'Mocha', sku: 'BEV005', price: 650, cost: 220, stock: 75, category: 'beverages', image: '🍫' },
  { id: '6', name: 'Iced Coffee', sku: 'BEV006', price: 550, cost: 150, stock: 60, category: 'beverages', image: '🧊' },
  { id: '7', name: 'Cold Brew', sku: 'BEV007', price: 600, cost: 180, stock: 45, category: 'beverages', image: '🧊' },
  { id: '8', name: 'Green Tea', sku: 'BEV008', price: 300, cost: 80, stock: 80, category: 'beverages', image: '🍵' },
  { id: '9', name: 'Chai Latte', sku: 'BEV009', price: 450, cost: 140, stock: 55, category: 'beverages', image: '🍵' },
  { id: '10', name: 'Hot Chocolate', sku: 'BEV010', price: 500, cost: 160, stock: 70, category: 'beverages', image: '🍫' },
  { id: '11', name: 'Fresh Orange Juice', sku: 'BEV011', price: 700, cost: 300, stock: 30, category: 'beverages', image: '🍊' },
  { id: '12', name: 'Lemonade', sku: 'BEV012', price: 400, cost: 120, stock: 40, category: 'beverages', image: '🍋' },

  // Food
  { id: '13', name: 'Croissant', sku: 'FOOD001', price: 450, cost: 150, stock: 25, category: 'food', image: '🥐' },
  { id: '14', name: 'Bagel with Cream Cheese', sku: 'FOOD002', price: 550, cost: 200, stock: 20, category: 'food', image: '🥯' },
  { id: '15', name: 'Avocado Toast', sku: 'FOOD003', price: 950, cost: 400, stock: 15, category: 'food', image: '🥑' },
  { id: '16', name: 'Breakfast Burrito', sku: 'FOOD004', price: 850, cost: 350, stock: 12, category: 'food', image: '🌯' },
  { id: '17', name: 'Turkey Sandwich', sku: 'FOOD005', price: 900, cost: 350, stock: 18, category: 'food', image: '🥪' },
  { id: '18', name: 'Grilled Cheese', sku: 'FOOD006', price: 750, cost: 250, stock: 20, category: 'food', image: '🧀' },
  { id: '19', name: 'Caesar Salad', sku: 'FOOD007', price: 950, cost: 400, stock: 10, category: 'food', image: '🥗' },
  { id: '20', name: 'Soup of the Day', sku: 'FOOD008', price: 600, cost: 200, stock: 8, category: 'food', image: '🍲' },

  // Snacks
  { id: '21', name: 'Chocolate Chip Cookie', sku: 'SNK001', price: 250, cost: 80, stock: 50, category: 'snacks', image: '🍪' },
  { id: '22', name: 'Blueberry Muffin', sku: 'SNK002', price: 350, cost: 120, stock: 35, category: 'snacks', image: '🧁' },
  { id: '23', name: 'Banana Bread', sku: 'SNK003', price: 300, cost: 100, stock: 20, category: 'snacks', image: '🍞' },
  { id: '24', name: 'Protein Bar', sku: 'SNK004', price: 450, cost: 250, stock: 40, category: 'snacks', image: '🍫' },
  { id: '25', name: 'Trail Mix', sku: 'SNK005', price: 400, cost: 180, stock: 30, category: 'snacks', image: '🥜' },
  { id: '26', name: 'Granola Bar', sku: 'SNK006', price: 200, cost: 80, stock: 45, category: 'snacks', image: '🌾' },

  // Desserts
  { id: '27', name: 'Chocolate Cake Slice', sku: 'DES001', price: 650, cost: 250, stock: 12, category: 'desserts', image: '🍰' },
  { id: '28', name: 'Cheesecake', sku: 'DES002', price: 750, cost: 300, stock: 10, category: 'desserts', image: '🧀' },
  { id: '29', name: 'Tiramisu', sku: 'DES003', price: 850, cost: 350, stock: 8, category: 'desserts', image: '🍰' },
  { id: '30', name: 'Brownie', sku: 'DES004', price: 450, cost: 150, stock: 25, category: 'desserts', image: '🍫' },
  { id: '31', name: 'Apple Pie', sku: 'DES005', price: 600, cost: 220, stock: 6, category: 'desserts', image: '🥧' },
  { id: '32', name: 'Ice Cream Sundae', sku: 'DES006', price: 550, cost: 200, stock: 20, category: 'desserts', image: '🍨' },

  // Merchandise
  { id: '33', name: 'Coffee Mug', sku: 'MER001', price: 1500, cost: 600, stock: 30, category: 'merchandise', image: '☕' },
  { id: '34', name: 'Tote Bag', sku: 'MER002', price: 1200, cost: 500, stock: 25, category: 'merchandise', image: '👜' },
  { id: '35', name: 'Coffee Beans (250g)', sku: 'MER003', price: 2500, cost: 1200, stock: 40, category: 'merchandise', image: '☕' },
  { id: '36', name: 'Gift Card Rs 2500', sku: 'MER004', price: 2500, cost: 2500, stock: 100, category: 'merchandise', image: '🎁' },
];

// Generate 200+ customers
const firstNames = ['Muhammad', 'Ali', 'Ahmed', 'Fatima', 'Ayesha', 'Zainab', 'Bilal', 'Omar', 'Usman', 'Hassan', 'Hussain', 'Mariam', 'Sana', 'Sadia', 'Hina', 'Yusuf', 'Ibrahim', 'Abdullah', 'Hamza', 'Saad', 'Fahad', 'Noman', 'Kamran', 'Rizwan', 'Nasir', 'Junaid', 'Waqas', 'Adeel', 'Farhan', 'Sohail', 'Asim', 'Khalid', 'Tariq', 'Zahid', 'Imran', 'Salman', 'Rashid', 'Javed', 'Akbar', 'Qasim'];
const lastNames = ['Khan', 'Ahmed', 'Ali', 'Hussain', 'Malik', 'Raja', 'Chaudhry', 'Sheikh', 'Butt', 'Mir', 'Qureshi', 'Siddiqui', 'Rehman', 'Iqbal', 'Shah', 'Nawaz', 'Sharif', 'Jutt', 'Bhatti', 'Cheema', 'Bajwa', 'Gondal', 'Ansari', 'Farooq', 'Latif', 'Akram', 'Bibi', 'Begum', 'Kausar', 'Parveen'];

export const customers: Customer[] = Array.from({ length: 220 }, (_, i) => {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const phone = `+923${Math.floor(Math.random() * 90 + 10)}${Math.floor(Math.random() * 9000000 + 1000000)}`;

  return {
    id: `cust-${i + 1}`,
    name: `${firstName} ${lastName}`,
    phone,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@email.com`,
    loyaltyPoints: Math.floor(Math.random() * 500),
    totalSpent: Math.floor(Math.random() * 50000) + 1000,
    visitCount: Math.floor(Math.random() * 50) + 1,
  };
});

export const businessInfo = {
  name: 'THE pizza&burger HOUSE',
  address: 'Near Lasani Chicken Broast, Gol Wala Complex',
  city: 'Nawabshah',
  phone: '+92 332 2822654',
  taxId: '',
  website: '',
  email: '',
};
