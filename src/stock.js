/**
 * stock.js - Stock / Inventory section
 */
import { getAllProducts, saveProduct, deleteProduct, getProduct, formatCurrency } from './db.js';
import { startScanner, stopScanner } from './scanner.js';
import { showToast } from './main.js';

let allProducts = [];
let editingBarcode = null;
let photoDataUrl = null;

export async function initStock() {
    setupProductModal();
    setupPhotoUpload();
    setupSearch();
    await renderStock();
}

async function renderStock() {
    allProducts = await getAllProducts();
    filterAndRender(document.getElementById('stock-search').value);
}

function filterAndRender(query = '') {
    const list = document.getElementById('stock-list');
    const empty = document.getElementById('stock-empty');
    const q = query.toLowerCase().trim();

    const filtered = q
        ? allProducts.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.barcode.toLowerCase().includes(q)
        )
        : allProducts;

    if (filtered.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'flex';
    } else {
        empty.style.display = 'none';
        list.innerHTML = filtered.map(renderProductCard).join('');
        // Attach event listeners
        list.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEditProduct(btn.dataset.barcode);
            });
        });
        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmDeleteProduct(btn.dataset.barcode);
            });
        });
    }
}

function renderProductCard(product) {
    const qtyClass = product.quantity === 0 ? 'out' : product.quantity <= 5 ? 'low' : '';
    const qtyText = product.quantity === 0 ? 'Sin stock' : `${product.quantity} u.`;
    const thumbContent = product.photo
        ? `<img src="${product.photo}" alt="${product.name}" />`
        : '📦';

    return `
    <div class="product-card">
      <div class="product-thumb">${thumbContent}</div>
      <div class="product-info">
        <div class="product-name">${escapeHtml(product.name)}</div>
        <div class="product-barcode">${product.barcode}</div>
        <div class="product-meta">
          <span class="product-price">${formatCurrency(product.price)}</span>
          <span class="product-qty ${qtyClass}">${qtyText}</span>
        </div>
      </div>
      <div class="product-actions">
        <button class="action-btn edit-btn" data-barcode="${product.barcode}" title="Editar">✏️</button>
        <button class="action-btn danger delete-btn" data-barcode="${product.barcode}" title="Eliminar">🗑️</button>
      </div>
    </div>
  `;
}

function setupSearch() {
    document.getElementById('stock-search').addEventListener('input', (e) => {
        filterAndRender(e.target.value);
    });
}

// ===== PRODUCT MODAL =====

function setupProductModal() {
    // Open via header + button
    document.getElementById('header-action-btn').addEventListener('click', () => {
        openAddProduct();
    });

    // Close buttons
    document.getElementById('close-product-modal').addEventListener('click', closeProductModal);
    document.getElementById('cancel-product-btn').addEventListener('click', closeProductModal);

    // Scan barcode for product
    document.getElementById('scan-product-btn').addEventListener('click', () => {
        startScanner((code) => {
            document.getElementById('product-barcode').value = code;
        });
    });

    // Save
    document.getElementById('save-product-btn').addEventListener('click', saveProductHandler);

    // Close on overlay click
    document.getElementById('modal-product').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeProductModal();
    });
}

function openAddProduct(barcodeValue = '') {
    editingBarcode = null;
    photoDataUrl = null;
    document.getElementById('modal-product-title').textContent = 'Nuevo Producto';
    document.getElementById('product-barcode').value = barcodeValue;
    document.getElementById('product-barcode').readOnly = false;
    document.getElementById('product-name').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-quantity').value = '';
    document.getElementById('product-edit-id').value = '';
    document.getElementById('product-photo-preview').style.display = 'none';
    document.getElementById('photo-placeholder').style.display = 'flex';
    document.getElementById('modal-product').style.display = 'flex';
}

async function openEditProduct(barcode) {
    const product = await getProduct(barcode);
    if (!product) return;

    editingBarcode = barcode;
    photoDataUrl = product.photo || null;

    document.getElementById('modal-product-title').textContent = 'Editar Producto';
    document.getElementById('product-barcode').value = product.barcode;
    document.getElementById('product-barcode').readOnly = true;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-quantity').value = product.quantity;
    document.getElementById('product-edit-id').value = product.barcode;

    if (product.photo) {
        document.getElementById('product-photo-preview').src = product.photo;
        document.getElementById('product-photo-preview').style.display = 'block';
        document.getElementById('photo-placeholder').style.display = 'none';
    } else {
        document.getElementById('product-photo-preview').style.display = 'none';
        document.getElementById('photo-placeholder').style.display = 'flex';
    }

    document.getElementById('modal-product').style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('modal-product').style.display = 'none';
    editingBarcode = null;
    photoDataUrl = null;
}

async function saveProductHandler() {
    const barcode = document.getElementById('product-barcode').value.trim();
    const name = document.getElementById('product-name').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    const quantity = parseInt(document.getElementById('product-quantity').value);

    if (!barcode) { showToast('Ingresá o escaneá un código de barras', 'error'); return; }
    if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
    if (isNaN(price) || price < 0) { showToast('El precio no es válido', 'error'); return; }
    if (isNaN(quantity) || quantity < 0) { showToast('La cantidad no es válida', 'error'); return; }

    // Check if barcode already exists for new products
    if (!editingBarcode) {
        const existing = await getProduct(barcode);
        if (existing) {
            showToast('Ya existe un producto con ese código', 'error');
            return;
        }
    }

    const product = {
        barcode,
        name,
        price,
        quantity,
        photo: photoDataUrl || null,
        createdAt: editingBarcode ? undefined : new Date().toISOString(),
    };

    if (editingBarcode) {
        const existing = await getProduct(editingBarcode);
        product.createdAt = existing?.createdAt || new Date().toISOString();
    }

    await saveProduct(product);
    closeProductModal();
    await renderStock();
    showToast(editingBarcode ? 'Producto actualizado ✓' : 'Producto guardado ✓', 'success');

    // Dispatch event for sales module to refresh its cache
    window.dispatchEvent(new CustomEvent('stock-updated'));
}

async function confirmDeleteProduct(barcode) {
    const product = await getProduct(barcode);
    if (!product) return;
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    await deleteProduct(barcode);
    await renderStock();
    showToast('Producto eliminado', 'warning');
    window.dispatchEvent(new CustomEvent('stock-updated'));
}

// ===== PHOTO UPLOAD =====

function setupPhotoUpload() {
    const area = document.getElementById('photo-upload-area');
    const input = document.getElementById('product-photo-input');
    const preview = document.getElementById('product-photo-preview');
    const placeholder = document.getElementById('photo-placeholder');

    area.addEventListener('click', () => input.click());

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            photoDataUrl = ev.target.result;
            preview.src = photoDataUrl;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
    });
}

// ===== PUBLIC API =====

export async function refreshStock() {
    await renderStock();
}

export function openAddProductWithBarcode(barcode) {
    openAddProduct(barcode);
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
