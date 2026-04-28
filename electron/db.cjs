const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Store database in the user data directory
const dbPath = path.join(app.getPath('userData'), 'pos_offline.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    items TEXT NOT NULL,
    synced INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products_cache (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const dbManager = {
  // Order Methods
  saveOrder: (order, items) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO orders (id, data, items, synced) VALUES (?, ?, ?, 0)');
    return stmt.run(order.id, JSON.stringify(order), JSON.stringify(items));
  },

  getUnsyncedOrders: () => {
    const stmt = db.prepare('SELECT * FROM orders WHERE synced = 0');
    return stmt.all();
  },

  markAsSynced: (id) => {
    const stmt = db.prepare('UPDATE orders SET synced = 1 WHERE id = ?');
    return stmt.run(id);
  },

  getAllOrders: () => {
    const stmt = db.prepare('SELECT * FROM orders ORDER BY created_at DESC');
    return stmt.all();
  },

  getOrderById: (id) => {
    const stmt = db.prepare('SELECT * FROM orders WHERE id = ?');
    return stmt.get(id);
  },

  updateOrderStatus: (id, status) => {
    const stmt = db.prepare('UPDATE orders SET data = json_set(data, "$.status", ?) WHERE id = ?');
    return stmt.run(status, id);
  },

  updateOrderItems: (id, items, total) => {
    const stmt = db.prepare('UPDATE orders SET items = ?, data = json_set(data, "$.total_amount", ?) WHERE id = ?');
    return stmt.run(JSON.stringify(items), total, id);
  },

  deleteOrder: (id) => {
    const stmt = db.prepare('DELETE FROM orders WHERE id = ?');
    return stmt.run(id);
  },

  // Product Cache Methods
  cacheProducts: (products) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO products_cache (id, data) VALUES (?, ?)');
    const insertMany = db.transaction((items) => {
      for (const item of items) stmt.run(item.id, JSON.stringify(item));
    });
    insertMany(products);
  },

  getCachedProducts: () => {
    const stmt = db.prepare('SELECT data FROM products_cache');
    return stmt.all().map(row => JSON.parse(row.data));
  }
};

module.exports = dbManager;
