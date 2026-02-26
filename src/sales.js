/**
 * sales.js - Sales (Ventas) section
 */
import { getProduct, createSale, formatCurrency } from './db.js';
import { startScanner } from './scanner.js';
import { showToast } from './main.js';

// Cart state: [{ barcode, name, price, quantity, photo }]
let cart = [];
let pendingProduct = null; // product being added to cart (waiting for qty)

export function initSales() {
    setupScanButton();
    setupCartControls();
    setupQuantityModal();
    renderCart();
}

// ===== SCANNER =====

function setupScanButton() {
    document.getElementById('scan-venta-btn').addEventListener('click', () => {
        startScanner(handleScannedBarcode, (err) => {
            showToast('No se pudo acceder a la cámara', 'error');
        });
    });
}

async function handleScannedBarcode(barcode) {
    const product = await getProduct(barcode);
    if (!product) {
        showToast('Producto no encontrado en el inventario', 'error');
        return;
    }
    if (product.quantity <= 0) {
        showToast(`Sin stock: ${product.name}`, 'error');
        return;
    }
    openQuantityModal(product);
}

// ===== QUANTITY MODAL =====

function setupQuantityModal() {
    document.getElementById('close-qty-modal').addEventListener('click', closeQtyModal);
    document.getElementById('cancel-qty-btn').addEventListener('click', closeQtyModal);

    document.getElementById('qty-minus').addEventListener('click', () => {
        const input = document.getElementById('qty-value');
        const val = parseInt(input.value) || 1;
        if (val > 1) input.value = val - 1;
    });

    document.getElementById('qty-plus').addEventListener('click', () => {
        const input = document.getElementById('qty-value');
        const val = parseInt(input.value) || 1;
        const max = pendingProduct?.quantity || 999;
        if (val < max) input.value = val + 1;
    });

    document.getElementById('confirm-qty-btn').addEventListener('click', addToCart);

    document.getElementById('modal-quantity').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeQtyModal();
    });
}

function openQuantityModal(product) {
    pendingProduct = product;
    document.getElementById('qty-product-name').textContent = product.name;
    document.getElementById('qty-stock-info').textContent = `Disponible: ${product.quantity} unidades`;
    document.getElementById('qty-value').value = 1;
    document.getElementById('qty-value').max = product.quantity;
    document.getElementById('modal-quantity').style.display = 'flex';
}

function closeQtyModal() {
    document.getElementById('modal-quantity').style.display = 'none';
    pendingProduct = null;
}

function addToCart() {
    if (!pendingProduct) return;

    const qty = parseInt(document.getElementById('qty-value').value) || 1;
    const clamped = Math.min(qty, pendingProduct.quantity);

    // Check if already in cart
    const existing = cart.find(i => i.barcode === pendingProduct.barcode);
    if (existing) {
        const newQty = existing.quantity + clamped;
        if (newQty > pendingProduct.quantity) {
            showToast('No hay suficiente stock', 'error');
            closeQtyModal();
            return;
        }
        existing.quantity = newQty;
    } else {
        cart.push({
            barcode: pendingProduct.barcode,
            name: pendingProduct.name,
            price: pendingProduct.price,
            quantity: clamped,
            photo: pendingProduct.photo,
        });
    }

    closeQtyModal();
    renderCart();
    showToast(`${pendingProduct.name} agregado ✓`, 'success');
}

// ===== CART RENDERING =====

function renderCart() {
    const list = document.getElementById('cart-items');
    const empty = document.getElementById('cart-empty');
    const footer = document.getElementById('cart-footer');

    if (cart.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'flex';
        footer.style.display = 'none';
        return;
    }

    empty.style.display = 'none';
    footer.style.display = 'block';

    list.innerHTML = cart.map((item, idx) => {
        const thumbContent = item.photo
            ? `<img src="${item.photo}" alt="${item.name}" />`
            : '🛒';
        return `
      <div class="cart-item">
        <div class="cart-item-thumb">${thumbContent}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${escapeHtml(item.name)}</div>
          <div class="cart-item-subtotal">${formatCurrency(item.price * item.quantity)}</div>
        </div>
        <div class="cart-item-qty">
          <button class="cart-qty-btn" data-idx="${idx}" data-action="dec">−</button>
          <span class="cart-item-quantity">${item.quantity}</span>
          <button class="cart-qty-btn" data-idx="${idx}" data-action="inc">+</button>
        </div>
      </div>
    `;
    }).join('');

    // Qty buttons
    list.querySelectorAll('.cart-qty-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const idx = parseInt(btn.dataset.idx);
            const action = btn.dataset.action;
            const item = cart[idx];
            if (!item) return;

            if (action === 'dec') {
                item.quantity--;
                if (item.quantity <= 0) cart.splice(idx, 1);
            } else {
                // Check actual stock
                const product = await getProduct(item.barcode);
                if (product && item.quantity < product.quantity) {
                    item.quantity++;
                } else {
                    showToast('Sin más stock disponible', 'warning');
                }
            }
            renderCart();
        });
    });

    // Total
    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    document.getElementById('cart-total').textContent = formatCurrency(total);
}

// ===== CART CONTROLS =====

function setupCartControls() {
    document.getElementById('clear-cart-btn').addEventListener('click', () => {
        if (cart.length === 0) return;
        if (confirm('¿Limpiar el carrito?')) {
            cart = [];
            renderCart();
        }
    });

    document.getElementById('confirm-sale-btn').addEventListener('click', confirmSale);
}

async function confirmSale() {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

    if (!confirm(`Confirmar venta de ${itemCount} ítem${itemCount > 1 ? 's' : ''} por ${formatCurrency(total)}?`)) return;

    try {
        await createSale(cart);
        showToast(`Venta confirmada: ${formatCurrency(total)} ✓`, 'success');
        cart = [];
        renderCart();
        // Notify stock module to refresh
        window.dispatchEvent(new CustomEvent('stock-updated'));
    } catch (err) {
        console.error(err);
        showToast('Error al procesar la venta', 'error');
    }
}

// ===== REFRESH =====
export function refreshSales() {
    renderCart();
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
