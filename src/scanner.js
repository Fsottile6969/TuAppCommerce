/**
 * scanner.js - Barcode scanner module using html5-qrcode
 */
import { Html5Qrcode } from 'html5-qrcode';

let scanner = null;
let isScanning = false;

/**
 * Start barcode scanning in element with id 'qr-reader'
 * @param {Function} onSuccess - called with scanned barcode string
 * @param {Function} onError - called on error (optional)
 */
export async function startScanner(onSuccess, onError) {
    const modal = document.getElementById('modal-scanner');
    const resultEl = document.getElementById('scanner-result-text');

    if (isScanning) {
        await stopScanner();
    }

    modal.style.display = 'flex';
    resultEl.textContent = '';
    resultEl.classList.remove('show');

    try {
        scanner = new Html5Qrcode('qr-reader');

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
            throw new Error('No se encontró cámara');
        }

        // Prefer back camera
        const camera = cameras.find(c =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('trasera') ||
            c.label.toLowerCase().includes('rear')
        ) || cameras[cameras.length - 1];

        await scanner.start(
            camera.id,
            {
                fps: 15,
                qrbox: { width: 260, height: 120 },
                aspectRatio: window.innerHeight / window.innerWidth,
                disableFlip: false,
            },
            (decodedText) => {
                // Success
                isScanning = false;
                resultEl.textContent = decodedText;
                resultEl.classList.add('show');

                // Vibrate on success
                if (navigator.vibrate) navigator.vibrate(100);

                // Brief delay to show the result then close
                setTimeout(async () => {
                    await stopScanner();
                    onSuccess(decodedText);
                }, 600);
            },
            (_error) => {
                // Frame error - ignore silently
            }
        );

        isScanning = true;
    } catch (err) {
        console.error('Scanner error:', err);
        modal.style.display = 'none';
        if (onError) onError(err);
        else alert('No se pudo acceder a la cámara. Verificá los permisos.');
    }
}

export async function stopScanner() {
    const modal = document.getElementById('modal-scanner');
    if (scanner) {
        try {
            if (isScanning) {
                await scanner.stop();
            }
        } catch (e) {
            console.warn('Error stopping scanner:', e);
        } finally {
            try { scanner.clear(); } catch (_) { }
            scanner = null;
        }
    }
    isScanning = false;
    modal.style.display = 'none';
}
