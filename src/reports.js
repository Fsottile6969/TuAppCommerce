/**
 * reports.js - Daily Sales Report section
 */
import { getSalesByDate, formatCurrency, today } from './db.js';

export function initReports() {
    // Set default date to today
    const dateInput = document.getElementById('report-date');
    dateInput.value = today();

    document.getElementById('refresh-report-btn').addEventListener('click', loadReport);

    // Load today's report on init
    loadReport();
}

async function loadReport() {
    const dateStr = document.getElementById('report-date').value;
    if (!dateStr) return;

    const sales = await getSalesByDate(dateStr);
    renderReport(sales, dateStr);
}

function renderReport(sales, dateStr) {
    const reportData = document.getElementById('report-data');
    const reportEmpty = document.getElementById('report-empty');

    if (!sales || sales.length === 0) {
        reportData.style.display = 'none';
        reportEmpty.style.display = 'flex';
        return;
    }

    reportEmpty.style.display = 'none';
    reportData.style.display = 'block';

    // Aggregate product quantities sold
    const productMap = {}; // barcode -> { name, qty, subtotal, price }
    let totalRevenue = 0;
    let totalUnits = 0;

    for (const sale of sales) {
        totalRevenue += sale.total;
        for (const item of sale.items) {
            totalUnits += item.quantity;
            if (!productMap[item.barcode]) {
                productMap[item.barcode] = {
                    barcode: item.barcode,
                    name: item.name,
                    price: item.price,
                    qty: 0,
                    subtotal: 0,
                };
            }
            productMap[item.barcode].qty += item.quantity;
            productMap[item.barcode].subtotal += item.price * item.quantity;
        }
    }

    const products = Object.values(productMap).sort((a, b) => b.subtotal - a.subtotal);

    // Summary cards
    document.getElementById('report-total').textContent = formatCurrency(totalRevenue);
    document.getElementById('report-count').textContent = sales.length;
    document.getElementById('report-units').textContent = totalUnits;

    // Product detail table
    const productList = document.getElementById('report-products-list');
    productList.innerHTML = products.map(p => `
    <div class="report-row">
      <div class="report-row-name">${escapeHtml(p.name)}</div>
      <div class="report-row-right">
        <span class="report-row-qty">${p.qty} u. × ${formatCurrency(p.price)}</span>
        <span class="report-row-subtotal">${formatCurrency(p.subtotal)}</span>
      </div>
    </div>
  `).join('');

    // Restock list - "reponer" = items sold today
    const restockList = document.getElementById('report-restock-list');
    restockList.innerHTML = products.map(p => `
    <div class="restock-item">
      <span class="restock-item-name">📦 ${escapeHtml(p.name)}</span>
      <span class="restock-item-qty">Reponer: ${p.qty} u.</span>
    </div>
  `).join('');
}

export function refreshReports() {
    loadReport();
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
