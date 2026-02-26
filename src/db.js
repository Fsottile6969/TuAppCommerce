/**
 * db.js - IndexedDB data layer using idb library
 */
import { openDB } from 'idb';

const DB_NAME = 'comercio-app';
const DB_VERSION = 1;

let db;

export async function initDB() {
    db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(database) {
            // Products store
            if (!database.objectStoreNames.contains('products')) {
                const productStore = database.createObjectStore('products', { keyPath: 'barcode' });
                productStore.createIndex('name', 'name');
                productStore.createIndex('createdAt', 'createdAt');
            }

            // Sales store
            if (!database.objectStoreNames.contains('sales')) {
                const salesStore = database.createObjectStore('sales', {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                salesStore.createIndex('date', 'date');
                salesStore.createIndex('timestamp', 'timestamp');
            }
        },
    });
    return db;
}

function getDB() {
    if (!db) throw new Error('DB not initialized');
    return db;
}

// ===== PRODUCTS =====

export async function getAllProducts() {
    return getDB().getAll('products');
}

export async function getProduct(barcode) {
    return getDB().get('products', barcode);
}

export async function saveProduct(product) {
    // product = { barcode, name, price, quantity, photo, createdAt }
    return getDB().put('products', {
        ...product,
        updatedAt: new Date().toISOString(),
    });
}

export async function deleteProduct(barcode) {
    return getDB().delete('products', barcode);
}

export async function updateProductQuantity(barcode, delta) {
    const tx = getDB().transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    const product = await store.get(barcode);
    if (!product) throw new Error('Producto no encontrado');
    product.quantity = Math.max(0, product.quantity + delta);
    product.updatedAt = new Date().toISOString();
    await store.put(product);
    await tx.done;
    return product;
}

// ===== SALES =====

/**
 * Create a sale record and deduct stock for each item.
 * @param {Array} items - [{ barcode, name, price, quantity }]
 * @returns {number} sale id
 */
export async function createSale(items) {
    const now = new Date();
    const dateStr = toDateString(now);

    const tx = getDB().transaction(['products', 'sales'], 'readwrite');
    const productsStore = tx.objectStore('products');
    const salesStore = tx.objectStore('sales');

    // Deduct stock
    for (const item of items) {
        const product = await productsStore.get(item.barcode);
        if (product) {
            product.quantity = Math.max(0, product.quantity - item.quantity);
            product.updatedAt = now.toISOString();
            await productsStore.put(product);
        }
    }

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Save sale
    const saleId = await salesStore.add({
        items,
        total,
        date: dateStr,
        timestamp: now.toISOString(),
    });

    await tx.done;
    return saleId;
}

export async function getSalesByDate(dateStr) {
    return getDB().getAllFromIndex('sales', 'date', dateStr);
}

export async function getAllSales() {
    return getDB().getAll('sales');
}

// ===== HELPERS =====

export function toDateString(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().split('T')[0];
}

export function formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(amount);
}

export function today() {
    return toDateString(new Date());
}
