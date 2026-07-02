// SPA App State
let participants = [];
let emails = [];
let activeEmailId = null;
let eventConfig = { title: '', date: '', time: '', location: '' };
let parsedCsvList = [];

// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Dashboard Elements
const guestsTableBody = document.getElementById('guests-table-body');
const addGuestForm = document.getElementById('add-guest-form');
const guestNameInput = document.getElementById('guest-name');
const guestSurnameInput = document.getElementById('guest-surname');
const guestEmailInput = document.getElementById('guest-email');
const guestNoteInput = document.getElementById('guest-note');
const guestSearchInput = document.getElementById('guest-search');
const btnRefreshGuests = document.getElementById('btn-refresh-guests');
const btnExportGuests = document.getElementById('btn-export-guests');
const btnSendAll = document.getElementById('btn-send-all');

const statTotalGuests = document.getElementById('stat-total-guests');
const statCheckedIn = document.getElementById('stat-checked-in');
const statAttendanceRate = document.getElementById('stat-attendance-rate');
const attendanceCirclePath = document.getElementById('attendance-circle-path');

// CSV Elements
const csvDropzone = document.getElementById('csv-dropzone');
const csvFileInput = document.getElementById('csv-file-input');
const csvPreviewContainer = document.getElementById('csv-preview-container');
const csvCount = document.getElementById('csv-count');
const csvCancel = document.getElementById('csv-cancel');
const btnImportCsv = document.getElementById('btn-import-csv');

const serverIpDisplay = document.getElementById('server-ip-display');
const scannerQrCanvas = document.getElementById('scanner-url-qr-canvas');

// Email Simulator Elements
const emailItemsContainer = document.getElementById('email-items-container');
const emailDetailPanel = document.getElementById('email-detail-panel');
const emailDetailEmpty = document.getElementById('email-detail-empty-view');
const emailDetailContent = document.getElementById('email-detail-content-view');
const mailSubject = document.getElementById('mail-subject');
const mailTo = document.getElementById('mail-to');
const mailDate = document.getElementById('mail-date');
const mailBodyGreeting = document.getElementById('mail-body-greeting');
const mailBodyFullname = document.getElementById('mail-body-fullname');
const mailBodyTicketid = document.getElementById('mail-body-ticketid');
const mailBodyQrImg = document.getElementById('mail-body-qr-img');
const mailNotePreview = document.getElementById('mail-note-preview');
const btnSimulateScanShortcut = document.getElementById('btn-simulate-scan-shortcut');
const btnClearEmails = document.getElementById('btn-clear-emails');
const unreadEmailBadge = document.getElementById('unread-email-badge');
const mailSmtpStatus = document.getElementById('mail-smtp-status');
const mailSmtpError = document.getElementById('mail-smtp-error');

// SMTP Elements
const smtpSettingsForm = document.getElementById('smtp-settings-form');
const smtpEnabled = document.getElementById('smtp-enabled');
const smtpFields = document.getElementById('smtp-fields');
const smtpHost = document.getElementById('smtp-host');
const smtpPort = document.getElementById('smtp-port');
const smtpUser = document.getElementById('smtp-user');
const smtpPass = document.getElementById('smtp-pass');

// Event Settings Elements
const eventSettingsForm = document.getElementById('event-settings-form');
const eventTitleInput = document.getElementById('event-title');
const eventDateInput = document.getElementById('event-date');
const eventTimeInput = document.getElementById('event-time');
const eventLocationInput = document.getElementById('event-location');

// Modal Elements for Quick Simulation
const checkinResultModal = document.getElementById('checkin-result-modal');
const modalIcon = document.getElementById('modal-icon');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');

// Initialize the Application
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  fetchSystemInfo();
  fetchParticipants();
  fetchEmails();
  fetchSmtpSettings();
  fetchEventSettings();
  setupSSE();
  setupCSVHandlers();

  // Event Listeners
  addGuestForm.addEventListener('submit', handleAddGuest);
  guestSearchInput.addEventListener('input', filterGuestsTable);
  btnRefreshGuests.addEventListener('click', fetchParticipants);
  btnExportGuests.addEventListener('click', handleExportGuests);
  btnSendAll.addEventListener('click', handleSendAll);
  btnClearEmails.addEventListener('click', handleClearEmails);
  smtpEnabled.addEventListener('change', toggleSmtpFields);
  smtpSettingsForm.addEventListener('submit', handleSaveSmtpSettings);
  eventSettingsForm.addEventListener('submit', handleSaveEventSettings);
  btnSimulateScanShortcut.addEventListener('click', handleShortcutSimulateScan);
});

// 1. Navigation Tabs Setup
function setupTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      
      // Update Tab Buttons
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update Tab Contents
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.getAttribute('id') === targetTab) {
          content.classList.add('active');
        }
      });

      // Clear badges if clicking email tab
      if (targetTab === 'emails') {
        unreadEmailBadge.style.display = 'none';
        unreadEmailBadge.textContent = '0';
      }
    });
  });
}

// 2. Fetch System Information (IP and Port)
async function fetchSystemInfo() {
  try {
    const response = await fetch('/api/system-info');
    const data = await response.json();
    
    // Prioritize HTTPS URL for smartphone camera access
    const displayUrl = data.scannerSecureUrl || data.scannerUrl;
    
    serverIpDisplay.innerHTML = `<a href="${displayUrl}" target="_blank" style="color: var(--primary); text-decoration: underline;">${displayUrl}</a>`;
    
    // Generate QR code for scanner URL using QRious
    new QRious({
      element: scannerQrCanvas,
      value: displayUrl,
      size: 80,
      background: '#ffffff',
      foreground: '#0a0b10',
      level: 'H'
    });
  } catch (error) {
    console.error('Errore nel recupero informazioni server:', error);
    const fallbackUrl = `${window.location.origin}/scanner.html`;
    serverIpDisplay.innerHTML = `<a href="${fallbackUrl}" target="_blank" style="color: var(--primary); text-decoration: underline;">${fallbackUrl}</a>`;
  }
}

// 3. Fetch Guest Participants List
async function fetchParticipants() {
  try {
    const response = await fetch('/api/participants');
    participants = await response.json();
    
    updateStats();
    renderParticipantsTable(participants);
  } catch (error) {
    console.error('Errore caricamento partecipanti:', error);
    guestsTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--error); padding: 3rem;">
          ⚠️ Errore di connessione con il server.
        </td>
      </tr>
    `;
  }
}

// Render participants list in the UI table
function renderParticipantsTable(list) {
  if (list.length === 0) {
    guestsTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          Nessun partecipante registrato.
        </td>
      </tr>
    `;
    return;
  }

  guestsTableBody.innerHTML = '';
  list.forEach(p => {
    const tr = document.createElement('tr');
    
    let statusClass = 'badge-inviato';
    if (p.status === 'Utilizzato') statusClass = 'badge-utilizzato';
    if (p.status === 'Annullato') statusClass = 'badge-annullato';

    tr.innerHTML = `
      <td style="font-weight: 600;">${escapeHtml(p.name)} ${escapeHtml(p.surname)}</td>
      <td>${escapeHtml(p.email)}</td>
      <td>${escapeHtml(p.note || '')}</td>
      <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(p.id)}</td>
      <td>
        <span class="badge ${statusClass}">${p.status}</span>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn btn-secondary btn-sm action-send-qr" data-id="${p.id}" title="Genera e Invia QR Code">
            ✉️ Invia QR
          </button>
          <button class="btn btn-danger btn-sm action-delete" data-id="${p.id}" title="Rimuovi invitato">
            🗑️ Rimuovi
          </button>
        </div>
      </td>
    `;
    
    guestsTableBody.appendChild(tr);
  });

  // Attach actions event listeners
  document.querySelectorAll('.action-send-qr').forEach(btn => {
    btn.addEventListener('click', (e) => handleSendSingleQr(e.target.getAttribute('data-id'), e.target));
  });

  document.querySelectorAll('.action-delete').forEach(btn => {
    btn.addEventListener('click', (e) => handleDeleteGuest(e.target.getAttribute('data-id')));
  });
}

// Search and filter guests table client-side
function filterGuestsTable() {
  const query = guestSearchInput.value.toLowerCase().trim();
  if (!query) {
    renderParticipantsTable(participants);
    return;
  }

  const filtered = participants.filter(p => {
    return p.name.toLowerCase().includes(query) || 
           p.surname.toLowerCase().includes(query) || 
           p.email.toLowerCase().includes(query) ||
           p.id.toLowerCase().includes(query);
  });

  renderParticipantsTable(filtered);
}

// 4. Update stats cards
function updateStats() {
  const total = participants.length;
  const checkedIn = participants.filter(p => p.status === 'Utilizzato').length;
  const rate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  statTotalGuests.textContent = total;
  statCheckedIn.textContent = checkedIn;
  statAttendanceRate.textContent = `${rate}%`;

  if (attendanceCirclePath) {
    attendanceCirclePath.setAttribute('stroke-dasharray', `${rate}, 100`);
  }
}

// 5. Add Guest Handler
async function handleAddGuest(e) {
  e.preventDefault();
  
  const name = guestNameInput.value.trim();
  const surname = guestSurnameInput.value.trim();
  const email = guestEmailInput.value.trim();
  const note = guestNoteInput.value.trim();

  if (!name || !surname || !email) return;

  const btnSubmit = document.getElementById('btn-add-guest');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<span class="spinner"></span> Aggiunta in corso...`;

  try {
    const response = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, surname, email, note })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Errore nella creazione del partecipante');
    }

    addGuestForm.reset();
    await fetchParticipants();
    await fetchEmails();

    // Increment notification badge if not on the email tab
    const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    if (activeTab !== 'emails') {
      unreadEmailBadge.style.display = 'inline-block';
      unreadEmailBadge.textContent = parseInt(unreadEmailBadge.textContent || 0) + 1;
    }

  } catch (error) {
    alert(`Errore: ${error.message}`);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Aggiungi Partecipante';
  }
}

// 6. Send QR code email to a single guest
async function handleSendSingleQr(id, buttonElement) {
  const originalText = buttonElement.innerHTML;
  buttonElement.disabled = true;
  buttonElement.innerHTML = `<span class="spinner"></span> Invio...`;

  try {
    const note = window.prompt('Aggiungi una nota personalizzata da includere nel biglietto (facoltativa):', '');
    const payload = note === null ? {} : { note: note };
    const response = await fetch(`/api/participants/${id}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Errore durante l\'invio');
    }

    const data = await response.json();
    
    // Refresh lists
    await fetchParticipants();
    await fetchEmails();

    // Visual feedback on button
    buttonElement.style.backgroundColor = 'var(--success)';
    buttonElement.style.color = '#fff';
    buttonElement.innerHTML = '✔️ Inviato';
    
    setTimeout(() => {
      buttonElement.style.backgroundColor = '';
      buttonElement.style.color = '';
      buttonElement.innerHTML = originalText;
      buttonElement.disabled = false;
    }, 2000);

    // Update unread badge if email tab is not open
    const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    if (activeTab !== 'emails') {
      unreadEmailBadge.style.display = 'inline-block';
      unreadEmailBadge.textContent = parseInt(unreadEmailBadge.textContent || 0) + 1;
    }

  } catch (error) {
    alert(`Impossibile inviare il QR Code: ${error.message}`);
    buttonElement.disabled = false;
    buttonElement.innerHTML = originalText;
  }
}

// 7. Bulk Send (Invia a Tutti)
async function handleSendAll() {
  if (participants.length === 0) {
    alert('Nessun partecipante nella lista da contattare.');
    return;
  }

  const confirmSend = confirm(`Stai per inviare l'email con QR Code a tutti i partecipanti attivi (${participants.filter(p => p.status !== 'Annullato').length}). Continuare?`);
  if (!confirmSend) return;

  btnSendAll.disabled = true;
  btnSendAll.innerHTML = `<span class="spinner"></span> Invio di gruppo...`;

  try {
    const note = window.prompt('Aggiungi una nota personalizzata da includere in tutti i biglietti (facoltativa):', '');
    const response = await fetch('/api/participants/send-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note || '' })
    });

    if (!response.ok) throw new Error('Errore nell\'invio massivo');

    const data = await response.json();
    alert(data.message);

    await fetchParticipants();
    await fetchEmails();

    const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');
    if (activeTab !== 'emails') {
      unreadEmailBadge.style.display = 'inline-block';
      unreadEmailBadge.textContent = parseInt(unreadEmailBadge.textContent || 0) + data.count;
    }

  } catch (error) {
    alert(`Errore nell'invio di gruppo: ${error.message}`);
  } finally {
    btnSendAll.disabled = false;
    btnSendAll.innerHTML = `<i class="icon-send"></i> Invia a Tutti`;
  }
}

// 8. Delete / Cancel Guest Ticket
async function handleDeleteGuest(id) {
  const confirmDelete = confirm('Sei sicuro di voler eliminare questo partecipante? Il suo biglietto diventerà non valido.');
  if (!confirmDelete) return;

  try {
    const response = await fetch(`/api/participants/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Impossibile rimuovere il partecipante');

    await fetchParticipants();
  } catch (error) {
    alert(`Errore: ${error.message}`);
  }
}

// ==============================================
// SIMULATED EMAIL CLIENT LOGIC
// ==============================================

// Fetch simulated emails list
async function fetchEmails() {
  try {
    const response = await fetch('/api/emails');
    emails = await response.json();
    renderEmailsList();
  } catch (error) {
    console.error('Errore caricamento email simulate:', error);
  }
}

// Populate the email list sidebar
function renderEmailsList() {
  if (emails.length === 0) {
    emailItemsContainer.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
        Nessun messaggio inviato nella posta simulata.
      </div>
    `;
    emailDetailEmpty.style.display = 'flex';
    emailDetailContent.style.display = 'none';
    activeEmailId = null;
    return;
  }

  emailItemsContainer.innerHTML = '';
  emails.forEach(email => {
    const item = document.createElement('div');
    item.className = `email-item ${activeEmailId === email.id ? 'active' : ''}`;
    item.setAttribute('data-id', email.id);

    const formattedTime = new Date(email.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    item.innerHTML = `
      <div class="email-item-meta">
        <span>A: ${escapeHtml(email.to)}</span>
        <span>${formattedTime}</span>
      </div>
      <div class="email-item-to">${escapeHtml(email.subject)}</div>
      <div class="email-item-subject">Codice Biglietto: ${escapeHtml(email.participantId)}</div>
      ${email.note ? `<div class="email-item-note">Nota: ${escapeHtml(email.note)}</div>` : ''}
    `;

    item.addEventListener('click', () => selectEmail(email.id));
    emailItemsContainer.appendChild(item);
  });

  // Re-select active email if it still exists
  if (activeEmailId) {
    const stillExists = emails.some(e => e.id === activeEmailId);
    if (!stillExists) {
      activeEmailId = null;
      emailDetailEmpty.style.display = 'flex';
      emailDetailContent.style.display = 'none';
    } else {
      selectEmail(activeEmailId);
    }
  }
}

// Handle email selection and preview rendering
function selectEmail(id) {
  activeEmailId = id;
  
  // Highlight active item
  document.querySelectorAll('.email-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-id') === id) {
      item.classList.add('active');
    }
  });

  const email = emails.find(e => e.id === id);
  if (!email) return;

  // Show detailed view
  emailDetailEmpty.style.display = 'none';
  emailDetailContent.style.display = 'block';

  // Fill in content
  mailSubject.textContent = email.subject;
  mailTo.textContent = email.to;
  
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  mailDate.textContent = new Date(email.sentAt).toLocaleDateString('it-IT', options);

  // Extract name/surname from subject or email info to populate mock email
  // The server sends it to participant.email
  const pId = email.participantId;
  const participant = participants.find(p => p.id === pId);
  const guestName = participant ? `${participant.name} ${participant.surname}` : 'Invitato';

  mailBodyGreeting.textContent = `Ciao ${guestName},`;
  mailBodyFullname.textContent = guestName;
  mailBodyTicketid.textContent = pId;
  const emailNote = email.note || (participant && participant.note ? participant.note.trim() : '');
  if (emailNote) {
    mailNotePreview.style.display = 'block';
    mailNotePreview.innerHTML = `
      <div style="padding: 12px 14px; border-radius: 14px; background: #0f172a; border: 1px solid rgba(148,163,184,0.24); color: #e2e8f0; font-size: 13px; line-height: 1.6;">
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #c7d2fe; margin-bottom: 8px;">Messaggio speciale</div>
        ${escapeHtml(emailNote)}
      </div>
    `;
  } else {
    mailNotePreview.style.display = 'none';
    mailNotePreview.textContent = '';
  }
  
  // Update event details in preview box
  document.getElementById('mail-header-title').textContent = eventConfig.title || 'Pass d\'ingresso';
  document.getElementById('mail-preview-date').textContent = eventConfig.date ? formatDateIt(eventConfig.date) : 'N/D';
  document.getElementById('mail-preview-time').textContent = eventConfig.time || 'N/D';
  document.getElementById('mail-preview-location').textContent = eventConfig.location || 'N/D';
  
  // Display the base64 QR Code image generated by server
  mailBodyQrImg.src = email.qrCode;

  // Update SMTP status
  mailSmtpStatus.textContent = email.smtpStatus || 'Disattivato (Solo Simulazione)';
  if (email.smtpStatus === 'Inviata con successo') {
    mailSmtpStatus.style.color = 'var(--success)';
  } else if (email.smtpStatus === 'Errore di invio') {
    mailSmtpStatus.style.color = 'var(--error)';
  } else if (email.smtpStatus === 'In invio...') {
    mailSmtpStatus.style.color = 'var(--warning)';
  } else {
    mailSmtpStatus.style.color = 'var(--text-secondary)';
  }
  
  if (email.smtpError) {
    mailSmtpError.textContent = `Errore: ${email.smtpError}`;
    mailSmtpError.style.display = 'block';
  } else {
    mailSmtpError.textContent = '';
    mailSmtpError.style.display = 'none';
  }
}

// Simulated scan from within the email client (allows easy testing)
async function handleShortcutSimulateScan() {
  if (!activeEmailId) return;
  const email = emails.find(e => e.id === activeEmailId);
  if (!email) return;

  const btn = btnSimulateScanShortcut;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Esecuzione Check-in...`;

  try {
    const response = await fetch('/api/participants/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrCodeContent: email.participantId })
    });

    const result = await response.json();
    
    // Refresh data to show updated state
    await fetchParticipants();

    // Trigger visual overlay in dashboard
    showCheckinModal(result);

  } catch (error) {
    alert(`Errore di simulazione check-in: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="icon-sim"></i> Simula Check-in`;
  }
}

// Show local feedback overlay modal
function showCheckinModal(result) {
  checkinResultModal.className = 'result-overlay active';
  
  if (result.status === 'SUCCESSO') {
    checkinResultModal.classList.add('result-overlay-success');
    modalIcon.textContent = '✔️';
    modalTitle.textContent = 'ACCESSO CONSENTITO';
    modalDesc.textContent = `${result.name} ${result.surname} - Benvenuto!`;
  } else if (result.status === 'GIA_UTILIZZATO') {
    checkinResultModal.classList.add('result-overlay-warning');
    modalIcon.textContent = '⚠️';
    modalTitle.textContent = 'ATTENZIONE';
    modalDesc.textContent = `BIGLIETTO GIÀ UTILIZZATO - ${result.name} ${result.surname}`;
  } else {
    checkinResultModal.classList.add('result-overlay-error');
    modalIcon.textContent = '❌';
    modalTitle.textContent = 'BIGLIETTO NON VALIDO';
    modalDesc.textContent = result.message || 'Codice non riconosciuto o biglietto annullato.';
  }
}

// Close the checkin modal overlay
window.closeCheckinModal = function() {
  checkinResultModal.className = 'result-overlay';
};

// Clear all simulated emails
async function handleClearEmails() {
  const confirmClear = confirm('Sei sicuro di voler cancellare tutta la posta inviata simulata?');
  if (!confirmClear) return;

  try {
    await fetch('/api/emails', { method: 'DELETE' });
    await fetchEmails();
  } catch (error) {
    console.error('Errore svuotamento email:', error);
  }
}

// ==============================================
// SMTP SETTINGS LOGIC
// ==============================================

// Enable/Disable form inputs depending on toggle status
function toggleSmtpFields() {
  if (smtpEnabled.checked) {
    smtpFields.style.opacity = '1';
    smtpFields.style.pointerEvents = 'auto';
    smtpHost.required = true;
    smtpPort.required = true;
    smtpUser.required = true;
    smtpPass.required = true;
  } else {
    smtpFields.style.opacity = '0.5';
    smtpFields.style.pointerEvents = 'none';
    smtpHost.required = false;
    smtpPort.required = false;
    smtpUser.required = false;
    smtpPass.required = false;
  }
}

// Fetch saved SMTP settings from server
async function fetchSmtpSettings() {
  try {
    const response = await fetch('/api/settings/smtp');
    const config = await response.json();
    
    smtpEnabled.checked = config.enabled;
    smtpHost.value = config.host || '';
    smtpPort.value = config.port || '465';
    smtpUser.value = config.user || '';
    smtpPass.value = config.pass || '';
    
    toggleSmtpFields();
  } catch (error) {
    console.error('Errore nel recupero impostazioni SMTP:', error);
  }
}

// Save SMTP settings to server
async function handleSaveSmtpSettings(e) {
  e.preventDefault();

  const settings = {
    enabled: smtpEnabled.checked,
    host: smtpHost.value.trim(),
    port: smtpPort.value.trim(),
    user: smtpUser.value.trim(),
    pass: smtpPass.value
  };

  try {
    const response = await fetch('/api/settings/smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });

    if (!response.ok) throw new Error('Errore nel salvataggio');
    
    alert('Impostazioni SMTP salvate correttamente!');
    toggleSmtpFields();
  } catch (error) {
    alert(`Impossibile salvare le impostazioni SMTP: ${error.message}`);
  }
}

// Helper: Escape HTML to avoid XSS issues
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Format Date from YYYY-MM-DD to DD/MM/YYYY
function formatDateIt(dateStr) {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateStr;
  }
}

// Client-side Server-Sent Events (SSE) listener for real-time synchronization
function setupSSE() {
  const eventSource = new EventSource('/api/events');

  eventSource.onmessage = function(event) {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'update') {
        participants = payload.data;
        updateStats();
        
        // Re-render table while preserving active search query
        const query = guestSearchInput.value.toLowerCase().trim();
        if (query) {
          filterGuestsTable();
        } else {
          renderParticipantsTable(participants);
        }
      } else if (payload.type === 'event_update') {
        eventConfig = payload.data;
        // Pre-fill settings inputs if they are not active
        if (document.activeElement !== eventTitleInput) eventTitleInput.value = eventConfig.title || '';
        if (document.activeElement !== eventDateInput) eventDateInput.value = eventConfig.date || '';
        if (document.activeElement !== eventTimeInput) eventTimeInput.value = eventConfig.time || '';
        if (document.activeElement !== eventLocationInput) eventLocationInput.value = eventConfig.location || '';
        
        // Refresh active email details preview
        if (activeEmailId) {
          selectEmail(activeEmailId);
        }
      }
    } catch (e) {
      console.error("Errore parsing evento SSE:", e);
    }
  };

  eventSource.onerror = function(err) {
    console.warn("Connessione SSE persa. Riprovo in background...");
  };
}

// Fetch event details settings
async function fetchEventSettings() {
  try {
    const response = await fetch('/api/settings/event');
    eventConfig = await response.json();
    
    eventTitleInput.value = eventConfig.title || '';
    eventDateInput.value = eventConfig.date || '';
    eventTimeInput.value = eventConfig.time || '';
    eventLocationInput.value = eventConfig.location || '';
  } catch (e) {
    console.error("Errore nel recupero dettagli evento:", e);
  }
}

// Save event details settings
async function handleSaveEventSettings(e) {
  e.preventDefault();

  const details = {
    title: eventTitleInput.value.trim(),
    date: eventDateInput.value,
    time: eventTimeInput.value,
    location: eventLocationInput.value.trim()
  };

  try {
    const response = await fetch('/api/settings/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(details)
    });

    if (!response.ok) throw new Error("Errore nel salvataggio");
    alert("Dettagli dell'evento salvati correttamente!");
    fetchEmails(); // Reload simulated email template layout
  } catch (err) {
    alert("Impossibile salvare i dettagli dell'evento: " + err.message);
  }
}

// Handle CSV Import Drag & Drop + Parsing
function setupCSVHandlers() {
  if (!csvDropzone) return;

  // Drag & drop visual effects
  ['dragenter', 'dragover'].forEach(eventName => {
    csvDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      csvDropzone.classList.add('drag-active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    csvDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      csvDropzone.classList.remove('drag-active');
    }, false);
  });

  csvDropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleCsvFile(files[0]);
    }
  });

  csvDropzone.addEventListener('click', () => {
    csvFileInput.click();
  });

  csvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleCsvFile(e.target.files[0]);
    }
  });

  csvCancel.addEventListener('click', (e) => {
    e.preventDefault();
    resetCsvImport();
  });

  btnImportCsv.addEventListener('click', executeBulkImport);
}

// Read and parse CSV file client-side
function handleCsvFile(file) {
  if (!file.name.endsWith('.csv')) {
    alert('Errore: Caricare esclusivamente file in formato .csv');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    parseCsvText(text);
  };
  reader.readAsText(file);
}

function parseCsvText(text) {
  // Split lines
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) {
    alert("Errore: Il file CSV è vuoto o non contiene intestazioni.");
    return;
  }

  // Detect delimiter (comma or semicolon)
  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());

  // Find column indices
  const nameIdx = headers.findIndex(h => h.includes('nome') || h.includes('name') || h.includes('first'));
  const surnameIdx = headers.findIndex(h => h.includes('cognome') || h.includes('surname') || h.includes('last'));
  const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('mail'));

  if (nameIdx === -1 || surnameIdx === -1 || emailIdx === -1) {
    alert("Errore: Colonne non riconosciute. Il CSV deve contenere intestazioni simili a 'Nome', 'Cognome', 'Email'.");
    return;
  }

  parsedCsvList = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map(c => c.trim());
    if (cols.length < headers.length) continue; // Skip malformed rows
    
    const name = cols[nameIdx];
    const surname = cols[surnameIdx];
    const email = cols[emailIdx];

    if (name && surname && email) {
      parsedCsvList.push({ name, surname, email });
    }
  }

  if (parsedCsvList.length === 0) {
    alert("Nessun partecipante valido estratto dal file CSV.");
    resetCsvImport();
    return;
  }

  // Display preview
  csvCount.textContent = parsedCsvList.length;
  csvPreviewContainer.style.display = 'block';
  csvDropzone.style.display = 'none';
}

function resetCsvImport() {
  parsedCsvList = [];
  csvFileInput.value = '';
  csvPreviewContainer.style.display = 'none';
  csvDropzone.style.display = 'flex';
}

// Send parsed CSV list in bulk to server
async function executeBulkImport() {
  if (parsedCsvList.length === 0) return;

  btnImportCsv.disabled = true;
  btnImportCsv.innerHTML = `<span class="spinner"></span> Importazione in corso...`;

  try {
    const response = await fetch('/api/participants/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ list: parsedCsvList })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Errore importazione');
    }

    const resData = await response.json();
    alert(resData.message);
    resetCsvImport();
    await fetchParticipants();
    await fetchEmails();
  } catch (err) {
    alert('Errore di importazione bulk: ' + err.message);
    btnImportCsv.disabled = false;
    btnImportCsv.textContent = 'Avvia Importazione';
  }
}

// Export guests to CSV client-side
function handleExportGuests() {
  if (participants.length === 0) {
    alert("Nessun partecipante registrato da poter esportare.");
    return;
  }

  // CSV content creation
  let csvContent = "Nome;Cognome;Email;ID Biglietto;Stato;Data Check-in\n";

  participants.forEach(p => {
    const name = p.name.replace(/;/g, ' ');
    const surname = p.surname.replace(/;/g, ' ');
    const email = p.email.replace(/;/g, ' ');
    const id = p.id;
    const status = p.status;
    const checkedInAt = p.checkedInAt ? new Date(p.checkedInAt).toLocaleString('it-IT') : '-';
    
    csvContent += `${name};${surname};${email};${id};${status};${checkedInAt}\n`;
  });

  // Download trigger
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", `report_partecipanti_${(eventConfig.title || 'evento').toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
