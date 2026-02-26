/**
 * main.js - App entry point and navigation
 */
import './style.css';
import { initDB } from './db.js';
import { initStock, refreshStock } from './stock.js';
import { initSales } from './sales.js';
import { initReports, refreshReports } from './reports.js';
import { stopScanner } from './scanner.js';

// ===== NAVIGATION =====

const sections = {
    stock: {
        el: document.getElementById('section-stock'),
        title: 'Stock',
        showAdd: true,
    },
    ventas: {
        el: document.getElementById('section-ventas'),
        title: 'Ventas',
        showAdd: false,
    },
    reportes: {
        el: document.getElementById('section-reportes'),
        title: 'Reportes',
        showAdd: false,
    },
};

let currentSection = 'stock';

function navigateTo(sectionName) {
    if (currentSection === sectionName) return;

    // If currently scanning, stop
    stopScanner();

    // Hide old section
    sections[currentSection]?.el.classList.remove('active');
    document.querySelector(`[data-section="${currentSection}"]`)?.classList.remove('active');

    // Show new section
    currentSection = sectionName;
    sections[sectionName].el.classList.add('active');
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');

    // Update header
    document.getElementById('page-title').textContent = sections[sectionName].title;
    const addBtn = document.getElementById('header-action-btn');
    addBtn.style.display = sections[sectionName].showAdd ? 'flex' : 'none';

    // Refresh section data
    if (sectionName === 'reportes') {
        refreshReports();
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.section);
        });
    });
}

// ===== SCANNER CLOSE BUTTON =====
function setupScannerClose() {
    document.getElementById('close-scanner-modal').addEventListener('click', () => {
        stopScanner();
    });
}

// ===== TOAST =====
let toastTimeout;

export function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.display = 'none';
    }, 2800);
}

// ===== STOCK UPDATE EVENT =====
function setupStockUpdateEvent() {
    window.addEventListener('stock-updated', async () => {
        await refreshStock();
    });
}

// ===== INIT =====
async function main() {
    try {
        await initDB();

        setupNavigation();
        setupScannerClose();
        setupStockUpdateEvent();

        // Initialize all sections
        await initStock();
        initSales();
        initReports();

        // Show add button for stock (initial section)
        document.getElementById('header-action-btn').style.display = 'flex';

        // Register service worker for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { });
        }

    } catch (err) {
        console.error('Init error:', err);
        showToast('Error al iniciar la app', 'error');
    }
}

main();
