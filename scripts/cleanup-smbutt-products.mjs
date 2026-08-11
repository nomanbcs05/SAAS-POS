import { createClient } from "../node_modules/@supabase/supabase-js/dist/index.mjs";

const SUPABASE_URL = "https://jrzpsrmticjbpobloqej.supabase.co";
const SUPABASE_KEY = "sb_publishable_mJIXausOFKI23F2ICqzV5w_HTBC1TBv";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const NAMES_TO_DELETE = [
  "Alfredo pasta",
  "Chicken roll",
  "chickin roll",
  "Club Sandwich",
  "COMBO 1 (1 Qtr Broast, 1 Zinger, Drink, Bun, Fries)",
  "COMBO 2 (Half Broast, Fries, 2 Bun, 2 Sauce, Drink)",
  "COMBO 3 (Full Broast, 4 Bun, 4 Sauce, 1.5L Drink, Fries)",
  "COMBO 4 (Jumbo Pizza, 1 Kukkar, 4 Bun, 4 Sauce, 1.5L Drink, Fries)",
  "Crispy Wings 12Pcs",
  "Crispy Wings 6Pcs",
  "Garlic Mayo Fries",
  "Hotshot 10Pcs",
  "Hotshot 5Pcs",
  "Indus pletar",
  "half pletar",
  "Loaded Fries",
  "Macroni Pasta Large",
  "Macroni Pasta Small",
  "Malai Boti Sandwich",
  "Masala Fries",
  "Mexican Sandwich",
  "Oven Backed Wings 12Pcs",
  "Oven Backed Wings 6Pcs",
  "Pizza Loaded Fries Large",
  "Pizza Loaded Fries Small",
  "Plain Fries",
  "roll",
  "Spring Rolls 4 Pcs",
  "Sting 500 ml",
  "Zinger Burger",
  "Skin Spicy injected Broast Chest/Wing 2Pcs",
  "Skin Spicy injected Broast Leg/Thai 2Pcs",
  "Skin Spicy injected Full Broast 8Pcs",
  "Skin Spicy Injected Full Kukkar",
  "Skin Spicy injected Half Broast 4Pcs",
];

const { data: all, error: fetchError } = await supabase
  .from("products")
  .select("id,name,price");

if (fetchError) { console.error("Fetch error:", fetchError); process.exit(1); }
console.log("Total products in DB:", all.length);

// Find by name (case-insensitive)
const toDelete = all.filter(p =>
  NAMES_TO_DELETE.some(n => p.name.trim().toLowerCase() === n.trim().toLowerCase())
);

// Remove duplicate "badmi tea" - keep lowest price, delete rest
const badmiTeas = all.filter(p => p.name.trim().toLowerCase() === "badmi tea");
if (badmiTeas.length > 1) {
  const sorted = [...badmiTeas].sort((a, b) => a.price - b.price);
  toDelete.push(...sorted.slice(1));
}

// Remove duplicate "Dawn bread"
const dawnBreads = all.filter(p => p.name.trim().toLowerCase() === "dawn bread");
if (dawnBreads.length > 1) toDelete.push(...dawnBreads.slice(1));

// Remove duplicate "tandoori partha" case variants
const parthas = all.filter(p => p.name.trim().toLowerCase().includes("tandoori partha"));
if (parthas.length > 1) toDelete.push(...parthas.slice(1));

// Remove duplicate "tandoori roti" - keep highest price (Rs.25)
const rotis = all.filter(p => p.name.trim().toLowerCase().includes("tandoori roti"));
if (rotis.length > 1) {
  const sorted = [...rotis].sort((a, b) => b.price - a.price);
  toDelete.push(...sorted.slice(1));
}

// Remove duplicate "Crispy Wings 12Pcs" - already in NAMES_TO_DELETE list

// Deduplicate by id
const unique = [...new Map(toDelete.map(p => [p.id, p])).values()];
if (unique.length === 0) { console.log("Nothing to delete."); process.exit(0); }

console.log("\nTo DELETE (" + unique.length + " products):");
unique.forEach(p => console.log("  x " + p.name + " | Rs." + p.price));

const ids = unique.map(p => p.id);

// Delete from order_items first
await supabase.from("order_items").delete().in("product_id", ids);

// Delete from products
const { error: delError } = await supabase.from("products").delete().in("id", ids);
if (delError) { console.error("Delete error:", delError); process.exit(1); }

console.log("\nDELETED " + unique.length + " products.");
const remaining = all.filter(p => !ids.includes(p.id));
console.log("\nREMAINING (" + remaining.length + " products - Smbutt Karahi menu):");
remaining.forEach(p => console.log("  OK " + p.name + " | Rs." + p.price));
