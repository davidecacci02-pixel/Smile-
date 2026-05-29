// Scanner State
let html5QrCode = null;
let isScanning = false;
let audioCtx = null;

// Fallback for Html5QrcodeScannerState in case it is not exported globally by the CDN script
const ScannerState = window.Html5QrcodeScannerState || {
  UNKNOWN: 0,
  NOT_STARTED: 1,
  SCANNING: 2,
  PAUSED: 3
};

// DOM Elements
const cameraStatusBadge = document.getElementById('camera-status-badge');
const manualTicketIdInput = document.getElementById('manual-ticket-id');
const btnManualCheck = document.getElementById('btn-manual-check');
const qrFileInput = document.getElementById('qr-file-input');

// Overlays
const overlaySuccess = document.getElementById('overlay-success');
const overlayWarning = document.getElementById('overlay-warning');
const overlayError = document.getElementById('overlay-error');

const successGuestName = document.getElementById('success-guest-name');
const warningGuestName = document.getElementById('warning-guest-name');
const warningUseTime = document.getElementById('warning-use-time');
const errorTitle = document.getElementById('error-title');
const errorDesc = document.getElementById('error-desc');

// Close buttons
const btnCloseSuccess = document.getElementById('btn-close-success');
const btnCloseWarning = document.getElementById('btn-close-warning');
const btnCloseError = document.getElementById('btn-close-error');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Initialize HTML5 QR Code
  html5QrCode = new Html5Qrcode("reader");
  
  // Start Camera immediately
  startCamera();

  // Event Listeners
  btnManualCheck.addEventListener('click', handleManualCheck);
  manualTicketIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleManualCheck();
  });
  
  qrFileInput.addEventListener('change', handleFileSelected);
  
  btnCloseSuccess.addEventListener('click', closeAllOverlays);
  btnCloseWarning.addEventListener('click', closeAllOverlays);
  btnCloseError.addEventListener('click', closeAllOverlays);

  // Setup user interaction listeners to unlock AudioContext (browsers policy fallback)
  enableAudioOnInteraction();
});

// Setup user interaction listeners to unlock AudioContext (browsers policy fallback)
function enableAudioOnInteraction() {
  const init = () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    // Remove listeners once audio is unlocked
    document.removeEventListener('click', init);
    document.removeEventListener('touchstart', init);
  };
  document.addEventListener('click', init);
  document.addEventListener('touchstart', init);
}

// Audio Web Audio API synthesizer for Beeps
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  try {
    initAudio();
    if (!audioCtx) return;
    
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
      // Clean, clear high beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 Note
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } else {
      // Low, buzzy double error tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, audioCtx.currentTime); // Low buzz
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    }
  } catch (err) {
    console.error("Audio feedback error:", err);
  }
}

// Start Camera Stream
function startCamera() {
  cameraStatusBadge.textContent = "Avvio fotocamera...";
  cameraStatusBadge.style.backgroundColor = "rgba(245, 158, 11, 0.2)"; // Amber
  cameraStatusBadge.style.color = "var(--warning)";

  // Standard configuration for scanning
  const config = {
    fps: 15,
    qrbox: (width, height) => {
      // Responsive scanning box (min 200px, max 250px)
      const size = Math.min(width, height, 250) * 0.9;
      return { width: Math.round(size), height: Math.round(size) };
    },
    aspectRatio: 1.0 // Square aspect ratio is easier to align
  };

  // facingMode: "environment" prefers back camera on mobile
  html5QrCode.start(
    { facingMode: "environment" },
    config,
    onQrCodeSuccess,
    onQrCodeError
  ).then(() => {
    isScanning = true;
    cameraStatusBadge.textContent = "Fotocamera Attiva";
    cameraStatusBadge.style.backgroundColor = "var(--success-bg)";
    cameraStatusBadge.style.color = "var(--success)";
    console.log("Fotocamera avviata correttamente.");
  }).catch((err) => {
    isScanning = false;
    cameraStatusBadge.textContent = "Errore Fotocamera";
    cameraStatusBadge.style.backgroundColor = "var(--error-bg)";
    cameraStatusBadge.style.color = "var(--error)";
    console.warn("Impossibile avviare la fotocamera:", err);
    
    // Provide a visual instruction message for permissions
    document.getElementById('scanner-hud').style.display = 'none';
    const readerContainer = document.getElementById('reader');
    readerContainer.innerHTML = `
      <div style="padding: 2.5rem; text-align: center; color: var(--text-secondary); display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
        <span style="font-size: 3.5rem; margin-bottom: 1rem;">📷</span>
        <h3 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.1rem;">Accesso fotocamera non disponibile</h3>
        <p style="font-size: 0.85rem; line-height: 1.5; max-width: 280px; margin-bottom: 1.5rem;">
          Abilita i permessi della fotocamera nel tuo browser, oppure assicurati di utilizzare un protocollo sicuro (HTTPS o localhost).
        </p>
        <button class="btn btn-secondary btn-sm" onclick="location.reload()" style="width: auto;">
          🔄 Ricarica Pagina
        </button>
      </div>
    `;
  });
}

// Callback when QR code is scanned
async function onQrCodeSuccess(decodedText, decodedResult) {
  // Guard against multiple scans in a row while processing
  if (!isScanning) return;
  
  isScanning = false;
  
  // Pause the scanning camera feed
  try {
    html5QrCode.pause();
  } catch (e) {
    console.error("Errore pausa scanner:", e);
  }

  // Play success sound temporarily (we will adjust after API response)
  playSound('success');

  // Submit scan to backend
  await processCheckIn(decodedText);
}

// Error callback (called continuously while searching for QR)
function onQrCodeError(errorMessage) {
  // Silent console logs as the library triggers errors constantly when QR is not in sight
}

// Perform Check-in API Request
async function processCheckIn(ticketId) {
  const cleanId = ticketId.trim();
  
  try {
    const response = await fetch('/api/participants/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrCodeContent: cleanId })
    });

    if (!response.ok) throw new Error("Errore comunicazione server.");

    const result = await response.json();
    displayResultOverlay(result);

  } catch (error) {
    console.error("Errore durante il check-in:", error);
    displayResultOverlay({
      status: "ERRORE",
      message: "Errore di connessione al server dell'evento."
    });
  }
}

// Render checkin result fullscreen overlay and play audio alert + trigger vibration
function displayResultOverlay(result) {
  // Reset all overlays
  overlaySuccess.classList.remove('active');
  overlayWarning.classList.remove('active');
  overlayError.classList.remove('active');

  if (result.status === 'SUCCESSO') {
    // Play sweet success audio feedback
    playSound('success');
    
    // Haptic feedback (Vibrate 100ms)
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    successGuestName.textContent = `${result.name} ${result.surname}`;
    overlaySuccess.classList.add('active');
    
  } else if (result.status === 'GIA_UTILIZZATO') {
    // Play warning sound
    playSound('error');
    
    // Haptic feedback (Vibrate 100ms, pause 50ms, vibrate 100ms)
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    
    warningGuestName.textContent = `${result.name} ${result.surname}`;
    
    if (result.usedAt) {
      const time = new Date(result.usedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      warningUseTime.textContent = `Scansionato oggi alle ore ${time}`;
    } else {
      warningUseTime.textContent = `Già registrato nel database.`;
    }
    
    overlayWarning.classList.add('active');
    
  } else if (result.status === 'ANNULLATO') {
    playSound('error');
    
    // Haptic feedback (double buzz)
    if (navigator.vibrate) {
      navigator.vibrate([150, 75, 150]);
    }
    
    errorTitle.textContent = "BIGLIETTO ANNULLATO";
    errorDesc.textContent = `Il biglietto associato a ${result.name || ''} ${result.surname || ''} è stato revocato dall'amministratore.`;
    overlayError.classList.add('active');
    
  } else {
    // Invalid or error
    playSound('error');
    
    // Haptic feedback (double buzz)
    if (navigator.vibrate) {
      navigator.vibrate([150, 75, 150]);
    }
    
    errorTitle.textContent = "BIGLIETTO NON VALIDO";
    errorDesc.textContent = result.message || "Il codice scansionato non esiste nel database dell'evento.";
    overlayError.classList.add('active');
  }
}

// Close overlay and resume camera scanner
function closeAllOverlays() {
  overlaySuccess.classList.remove('active');
  overlayWarning.classList.remove('active');
  overlayError.classList.remove('active');
  
  manualTicketIdInput.value = '';
  
  if (html5QrCode && html5QrCode.getState() === ScannerState.PAUSED) {
    try {
      html5QrCode.resume();
      isScanning = true;
    } catch (e) {
      console.error("Errore riavvio scanner:", e);
    }
  } else if (html5QrCode && html5QrCode.getState() === ScannerState.UNKNOWN) {
    // Scanner was not active, do nothing
    isScanning = true;
  } else {
    isScanning = true;
  }
}

// Manual Check-in Handler
async function handleManualCheck() {
  const val = manualTicketIdInput.value.trim();
  if (!val) return;

  isScanning = false;
  try {
    html5QrCode.pause();
  } catch (e) {}

  btnManualCheck.disabled = true;
  btnManualCheck.textContent = "...";

  await processCheckIn(val);

  btnManualCheck.disabled = false;
  btnManualCheck.textContent = "Verifica";
}

// File Select Check-in Handler
function handleFileSelected(e) {
  if (e.target.files.length === 0) return;
  
  const file = e.target.files[0];
  cameraStatusBadge.textContent = "Scansione file...";
  
  // Use HTML5 QR Code file reader api
  html5QrCode.scanFile(file, true)
    .then(async (decodedText) => {
      // Pause scanner if it was active
      try { html5QrCode.pause(); } catch (e) {}
      isScanning = false;
      
      await processCheckIn(decodedText);
      qrFileInput.value = ''; // Reset input
    })
    .catch((err) => {
      console.error("Errore scansione file QR:", err);
      displayResultOverlay({
        status: "ERRORE",
        message: "Nessun codice QR valido trovato in questa immagine."
      });
      qrFileInput.value = '';
    });
}
