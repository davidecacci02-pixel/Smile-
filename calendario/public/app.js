// Standalone config for offline distribution
const IS_STANDALONE = false;
const EMBEDDED_EVENTS = [];

// App State
const state = {
  events: [],
  currentYear: 2026,
  currentMonth: 6, // Default to June 2026
  activeView: 'tutti', // 'tutti', 'miky', 'ermelinda', 'guglielmo', 'academy', 'riunioni'
  selectedMikyAgent: 'tutti',
  selectedErmelindaAgent: 'tutti',
  selectedGuglielmoAgent: 'tutti',
  currentLayout: 'month', // 'month', 'week', 'list'
  lastSelectedLayout: 'month', // User's manually chosen layout
  compareMode: false,
  compareMonthA: 5, // Maggio
  compareMonthB: 6, // Giugno
  searchQuery: '',
  selectedEvent: null // Keeps reference to the event being edited
};

// Predefined agents list
const AGENT_LIST = [
  'Andrea', 'Umberto', 'Antonio', 'Enrico', 'Valentino', 
  'Tiziano', 'Gianni', 'Roberto', 'Agostino', 'Emanuele', 
  'Diego', 'Nicola', 'Genny'
];

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

// DOM Selectors
const DOM = {
  loadingOverlay: document.getElementById('loadingOverlay'),
  currentPeriodTitle: document.getElementById('currentPeriodTitle'),
  currentFilterLabel: document.getElementById('currentFilterLabel'),
  searchBar: document.getElementById('searchBar'),
  btnPrint: document.getElementById('btnPrint'),
  btnPrevMonth: document.getElementById('btnPrevMonth'),
  btnNextMonth: document.getElementById('btnNextMonth'),
  selectMonth: document.getElementById('selectMonth'),
  chkCompare: document.getElementById('chkCompare'),
  compareSelectsWrapper: document.getElementById('compareSelectsWrapper'),
  selectCompareA: document.getElementById('selectCompareA'),
  selectCompareB: document.getElementById('selectCompareB'),
  btnLayoutMonth: document.getElementById('btnLayoutMonth'),
  btnLayoutWeek: document.getElementById('btnLayoutWeek'),
  btnLayoutList: document.getElementById('btnLayoutList'),
  singleLayoutContainer: document.getElementById('singleLayoutContainer'),
  calendarHeaders: document.getElementById('calendarHeaders'),
  calendarGrid: document.getElementById('calendarGrid'),
  compareLayoutContainer: document.getElementById('compareLayoutContainer'),
  compareGridA: document.getElementById('compareGridA'),
  compareGridB: document.getElementById('compareGridB'),
  compareMonthTitleA: document.getElementById('compareMonthTitleA'),
  compareMonthTitleB: document.getElementById('compareMonthTitleB'),
  listViewContainer: document.getElementById('listViewContainer'),
  listEvents: document.getElementById('listEvents'),
  printSubHeader: document.getElementById('printSubHeader'),
  
  // Sidebar elements
  btnViewAll: document.getElementById('btnViewAll'),
  btnViewMiky: document.getElementById('btnViewMiky'),
  btnViewErmelinda: document.getElementById('btnViewErmelinda'),
  btnViewGuglielmo: document.getElementById('btnViewGuglielmo'),
  btnViewAcademy: document.getElementById('btnViewAcademy'),
  btnViewMeetings: document.getElementById('btnViewMeetings'),
  dropdownMiky: document.getElementById('dropdownMiky'),
  dropdownErmelinda: document.getElementById('dropdownErmelinda'),
  dropdownGuglielmo: document.getElementById('dropdownGuglielmo'),
  selectMikyAgent: document.getElementById('selectMikyAgent'),
  selectErmelindaAgent: document.getElementById('selectErmelindaAgent'),
  selectGuglielmoAgent: document.getElementById('selectGuglielmoAgent'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  statusDesc: document.getElementById('statusDesc'),
  btnTriggerImport: document.getElementById('btnTriggerImport'),
  excelFileInput: document.getElementById('excelFileInput'),
  importModal: document.getElementById('importModal'),
  importCountText: document.getElementById('importCountText'),
  btnImportReplace: document.getElementById('btnImportReplace'),
  btnImportAppend: document.getElementById('btnImportAppend'),
  btnCancelImportModal: document.getElementById('btnCancelImportModal'),
  btnDiscardImportModal: document.getElementById('btnDiscardImportModal'),
  btnResetImport: document.getElementById('btnResetImport'),
  btnClearDatabase: document.getElementById('btnClearDatabase'),
  
  // Modal elements
  eventModal: document.getElementById('eventModal'),
  modalTitle: document.getElementById('modalTitle'),
  eventForm: document.getElementById('eventForm'),
  eventDate: document.getElementById('eventDate'),
  eventCategory: document.getElementById('eventCategory'),
  agentSelectorGroup: document.getElementById('agentSelectorGroup'),
  eventAgent: document.getElementById('eventAgent'),
  eventAgentCustom: document.getElementById('eventAgentCustom'),
  eventText: document.getElementById('eventText'),
  modalError: document.getElementById('modalError'),
  modalErrorText: document.getElementById('modalErrorText'),
  btnDeleteEvent: document.getElementById('btnDeleteEvent'),
  btnCancelModal: document.getElementById('btnCancelModal'),
  btnDiscardEvent: document.getElementById('btnDiscardEvent'),
  btnCurrentMonth: document.getElementById('btnCurrentMonth'),
  eventManualText: document.getElementById('eventManualText')
};

// Initialize App
async function init() {
  // Pre-fill agent dropdowns
  populateAgentDropdowns();
  
  // Setup current month selector value
  DOM.selectMonth.value = state.currentMonth;
  
  // Setup compare month selector lists
  populateCompareMonthSelectors();
  
  // Setup event listeners
  setupEventListeners();
  
  // Set current local month if it is 2026
  const now = new Date();
  if (now.getFullYear() === 2026) {
    state.currentMonth = now.getMonth() + 1;
    DOM.selectMonth.value = state.currentMonth;
  }
  
  // Fetch initial events
  await fetchEvents();
}

// Populate Miky, Ermelinda, Guglielmo agent dropdowns in sidebar and modal
function populateAgentDropdowns() {
  const addOptionsToSelect = (selectElement) => {
    AGENT_LIST.forEach(agent => {
      const opt = document.createElement('option');
      opt.value = agent.toLowerCase();
      opt.textContent = agent;
      selectElement.appendChild(opt);
    });
  };
  
  addOptionsToSelect(DOM.selectMikyAgent);
  addOptionsToSelect(DOM.selectErmelindaAgent);
  addOptionsToSelect(DOM.selectGuglielmoAgent);
  
  // Also populate modal agent select
  AGENT_LIST.forEach(agent => {
    const opt = document.createElement('option');
    opt.value = agent.toLowerCase();
    opt.textContent = agent;
    DOM.eventAgent.appendChild(opt);
  });
}

// Populate compare month dropdown elements
function populateCompareMonthSelectors() {
  MONTH_NAMES.forEach((m, idx) => {
    const optA = document.createElement('option');
    optA.value = idx + 1;
    optA.textContent = m;
    const optB = document.createElement('option');
    optB.value = idx + 1;
    optB.textContent = m;
    
    DOM.selectCompareA.appendChild(optA);
    DOM.selectCompareB.appendChild(optB);
  });
  
  // Default values
  DOM.selectCompareA.value = state.compareMonthA;
  DOM.selectCompareB.value = state.compareMonthB;
}

// Helper to determine the category of an event from the text
function getEventCategory(text) {
  if (!text) return 'other';
  const upper = text.toUpperCase();
  
  if (upper.includes('MIKY')) return 'miky';
  if (upper.includes('ERMELINDA') || upper.includes('ERME')) return 'ermelinda';
  if (upper.includes('GUGLIELMO') || upper.includes('GUGLI')) return 'guglielmo';
  
  // Academy/Courses keywords
  const academyKeywords = [
    'ACADEMY', 'UNIVERSITY', 'MASTER', 'ACADACCADEMIA', 'CARE SPECIALIST', 
    'COLLEZIONE', 'CULTURE', 'BOARD', 'BORD', 'DISCOVERY', 'TTT', 'HAIR UP', 'GENESIS',
    'CAPABILITY', 'FORMAZIONE', 'ILLEGAL', 'SCUMACI', 'TOGHETER', 'TOGETHER',
    'MEETING', 'TRAINING', 'METODO', 'MILANO'
  ];
  if (academyKeywords.some(kw => upper.includes(kw))) return 'academy';
  
  if (upper.includes('RIUNIONE')) return 'riunioni';
  
  return 'other';
}

// Helper to get agent name from text
function getEventAgent(text) {
  if (!text) return null;
  const upper = text.toUpperCase();
  const found = AGENT_LIST.find(agent => upper.includes(agent.toUpperCase()));
  return found ? found.toLowerCase() : null;
}

// Parse a XLSX workbook client-side
function parseExcelWorkbook(workbook) {
  const events = [];
  const MONTH_NAMES_LIST_S1 = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO'];
  const MONTH_NAMES_LIST_S2 = ['LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
  
  function isLegendRow(sheet, r, range) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'string') {
        const val = cell.v.trim();
        if (val === 'LEGENDA:' || val === 'IB' || val === 'AFFIANCAMENTI') {
          return true;
        }
      }
    }
    return false;
  }
  
  try {
    // Foglio 1 (Semestre 1)
    const sheet1Name = workbook.SheetNames[0];
    const sheet1 = workbook.Sheets[sheet1Name];
    if (sheet1 && sheet1['!ref']) {
      const range1 = XLSX.utils.decode_range(sheet1['!ref']);
      for (let r = 2; r <= range1.e.r; r++) {
        if (isLegendRow(sheet1, r, range1)) break;
        for (let mIdx = 0; mIdx < MONTH_NAMES_LIST_S1.length; mIdx++) {
          const monthNum = mIdx + 1;
          const dayCol = mIdx * 3;
          const dowCol = dayCol + 1;
          const textCol = dayCol + 2;
          
          const dayCell = sheet1[XLSX.utils.encode_cell({ r, c: dayCol })];
          const dowCell = sheet1[XLSX.utils.encode_cell({ r, c: dowCol })];
          const textCell = sheet1[XLSX.utils.encode_cell({ r, c: textCol })];
          
          if (dayCell && dayCell.v !== undefined && dayCell.v !== null && dayCell.v !== '') {
            const dayNum = parseInt(dayCell.v);
            if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
              const dateStr = `2026-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              events.push({
                id: `evt_s1_r${r}_c${textCol}`,
                date: dateStr,
                day: dayNum,
                month: monthNum,
                dayOfWeek: dowCell ? String(dowCell.v).trim() : '',
                text: textCell ? String(textCell.v).trim() : ''
              });
            }
          }
        }
      }
    }
    
    // Foglio 2 (Semestre 2)
    const sheet2Name = workbook.SheetNames[1];
    const sheet2 = workbook.Sheets[sheet2Name];
    if (sheet2 && sheet2['!ref']) {
      const range2 = XLSX.utils.decode_range(sheet2['!ref']);
      for (let r = 2; r <= range2.e.r; r++) {
        if (isLegendRow(sheet2, r, range2)) break;
        for (let mIdx = 0; mIdx < MONTH_NAMES_LIST_S2.length; mIdx++) {
          const monthNum = mIdx + 7;
          const dayCol = mIdx * 3;
          const dowCol = dayCol + 1;
          const textCol = dayCol + 2;
          
          const dayCell = sheet2[XLSX.utils.encode_cell({ r, c: dayCol })];
          const dowCell = sheet2[XLSX.utils.encode_cell({ r, c: dowCol })];
          const textCell = sheet2[XLSX.utils.encode_cell({ r, c: textCol })];
          
          let dayNum = null;
          if (dayCell && dayCell.v !== undefined && dayCell.v !== null && dayCell.v !== '') {
            dayNum = parseInt(dayCell.v);
            if (isNaN(dayNum) && String(dayCell.v).trim().toUpperCase() === 'D' && monthNum === 9 && r === 33) {
              dayNum = 30;
            }
          }
          
          if (dayNum !== null && !isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
            const dateStr = `2026-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            events.push({
              id: `evt_s2_r${r}_c${textCol}`,
              date: dateStr,
              day: dayNum,
              month: monthNum,
              dayOfWeek: dowCell ? String(dowCell.v).trim() : '',
              text: textCell ? String(textCell.v).trim() : ''
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Error parsing workbook client-side:', err);
  }
  return events;
}

// Fetch Events from API
async function fetchEvents() {
  showLoading(true);
  try {
    let rawEvents = [];
    if (IS_STANDALONE) {
      const stored = localStorage.getItem('smile_calendar_events');
      if (stored) {
        try {
          rawEvents = JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse stored events, fallback to embedded', e);
          rawEvents = EMBEDDED_EVENTS;
        }
      } else {
        rawEvents = EMBEDDED_EVENTS;
        localStorage.setItem('smile_calendar_events', JSON.stringify(rawEvents));
      }
      setConnectionStatus(true);
    } else {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Network response not ok');
      const data = await res.json();
      rawEvents = data.events || [];
      setConnectionStatus(true);
    }
    
    // Process events by adding frontend-specific category and agent tags
    state.events = rawEvents.map(evt => {
      const category = getEventCategory(evt.text);
      const agent = getEventAgent(evt.text);
      return {
        ...evt,
        category,
        agent
      };
    });
  } catch (err) {
    console.error('Error fetching events:', err);
    setConnectionStatus(false);
  } finally {
    showLoading(false);
    render();
  }
}

// Show/Hide Loading Overlay
function showLoading(show) {
  if (show) {
    DOM.loadingOverlay.classList.add('active');
  } else {
    DOM.loadingOverlay.classList.remove('active');
  }
}

// Update Connection Status UI
function setConnectionStatus(connected) {
  if (IS_STANDALONE) {
    DOM.statusDot.className = 'status-dot';
    DOM.statusText.textContent = 'Salvataggio Locale (Browser)';
    DOM.statusDot.style.backgroundColor = '#10b981';
    DOM.statusDot.style.boxShadow = '0 0 8px #10b981';
    if (DOM.statusDesc) {
      DOM.statusDesc.innerHTML = 'Le modifiche vengono salvate in questo browser. <a href="#" id="btnResetLocalDb" style="color: #60a5fa; text-decoration: underline; font-weight: 500;">Ripristina calendario originale</a>';
    }
    return;
  }
  
  // Reset inline styles
  DOM.statusDot.style.backgroundColor = '';
  DOM.statusDot.style.boxShadow = '';
  
  if (connected) {
    DOM.statusDot.className = 'status-dot online';
    DOM.statusText.textContent = 'Excel Connesso';
  } else {
    DOM.statusDot.className = 'status-dot offline';
    DOM.statusText.textContent = 'Excel Disconnesso';
  }
}

// Main Render Routine
function render() {
  // Update header filter description
  updateHeaderLabels();
  
  // Hide all layouts first
  DOM.singleLayoutContainer.classList.remove('active');
  DOM.compareLayoutContainer.classList.remove('active');
  DOM.listViewContainer.classList.remove('active');
  
  if (state.compareMode) {
    DOM.compareLayoutContainer.classList.add('active');
    renderCompare();
  } else if (state.currentLayout === 'month') {
    DOM.singleLayoutContainer.classList.add('active');
    DOM.calendarHeaders.style.display = 'grid';
    renderMonth(state.currentMonth, DOM.calendarGrid);
  } else if (state.currentLayout === 'week') {
    DOM.singleLayoutContainer.classList.add('active');
    DOM.calendarHeaders.style.display = 'grid';
    renderWeek();
  } else if (state.currentLayout === 'list') {
    DOM.listViewContainer.classList.add('active');
    renderList();
  }
}

// Update top header titles and filter descriptions
function updateHeaderLabels() {
  const monthName = MONTH_NAMES[state.currentMonth - 1];
  DOM.currentPeriodTitle.textContent = `${monthName} ${state.currentYear}`;
  DOM.printSubHeader.textContent = `${monthName} ${state.currentYear}`;
  
  let label = 'Visualizzazione: ';
  switch (state.activeView) {
    case 'tutti':
      label += 'Calendario Generale';
      break;
    case 'miky':
      label += `Impegni Miky - Agente: ${state.selectedMikyAgent.toUpperCase()}`;
      break;
    case 'ermelinda':
      label += `Impegni Ermelinda - Agente: ${state.selectedErmelindaAgent.toUpperCase()}`;
      break;
    case 'guglielmo':
      label += `Impegni Guglielmo - Agente: ${state.selectedGuglielmoAgent.toUpperCase()}`;
      break;
    case 'academy':
      label += 'Academy (Formazione)';
      break;
    case 'riunioni':
      label += 'Riunioni Commerciali';
      break;
  }
  DOM.currentFilterLabel.textContent = label;
}

// Get filtered events for current view state
function getFilteredEvents(monthFilter = null) {
  let list = state.events;
  
  // Filter by Month if provided, except for 'riunioni' view which shows all year
  if (state.activeView !== 'riunioni') {
    if (monthFilter !== null) {
      list = list.filter(e => e.month === monthFilter);
    } else if (!state.compareMode) {
      list = list.filter(e => e.month === state.currentMonth);
    }
  }
  
  // Filter by Search Query
  if (state.searchQuery.trim() !== '') {
    const q = state.searchQuery.toUpperCase();
    list = list.filter(e => e.text.toUpperCase().includes(q) || e.date.includes(q));
  }
  
  // Filter by Active View
  if (state.activeView === 'miky') {
    list = list.filter(e => e.category === 'miky');
    if (state.selectedMikyAgent !== 'tutti') {
      list = list.filter(e => e.text.toUpperCase().includes(state.selectedMikyAgent.toUpperCase()));
    }
  } else if (state.activeView === 'ermelinda') {
    list = list.filter(e => e.category === 'ermelinda');
    if (state.selectedErmelindaAgent !== 'tutti') {
      list = list.filter(e => e.text.toUpperCase().includes(state.selectedErmelindaAgent.toUpperCase()));
    }
  } else if (state.activeView === 'guglielmo') {
    list = list.filter(e => e.category === 'guglielmo');
    if (state.selectedGuglielmoAgent !== 'tutti') {
      list = list.filter(e => e.text.toUpperCase().includes(state.selectedGuglielmoAgent.toUpperCase()));
    }
  } else if (state.activeView === 'academy') {
    list = list.filter(e => e.category === 'academy');
  } else if (state.activeView === 'riunioni') {
    list = list.filter(e => e.category === 'riunioni');
  }
  
  return list;
}

// Render Monthly Calendar Grid
function renderMonth(month, gridElement) {
  gridElement.innerHTML = '';
  
  // Month specifications
  const firstDay = new Date(2026, month - 1, 1);
  const totalDays = new Date(2026, month, 0).getDate();
  
  // Determine start padding (Lunedì index = 0)
  const firstDayIndex = firstDay.getDay(); // 0: Sun, 1: Mon, etc.
  const startPadding = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  
  // Get events for this month
  const monthEvents = getFilteredEvents(month);
  
  // Render empty cells for start padding
  for (let i = 0; i < startPadding; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell inactive';
    gridElement.appendChild(cell);
  }
  
  // Render active month cells
  const today = new Date();
  const isCurrentYearMonth = today.getFullYear() === 2026 && (today.getMonth() + 1) === month;
  
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    if (isCurrentYearMonth && today.getDate() === day) {
      cell.classList.add('today');
    }
    
    // Header row in cell (Day number and Quick Add button)
    const header = document.createElement('div');
    header.className = 'day-header';
    
    const num = document.createElement('span');
    num.className = 'day-number';
    num.textContent = day;
    header.appendChild(num);
    
    const quickAdd = document.createElement('button');
    quickAdd.className = 'btn-quick-add';
    quickAdd.textContent = '+';
    quickAdd.title = 'Aggiungi impegno per questo giorno';
    quickAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(dateStr, null);
    });
    header.appendChild(quickAdd);
    
    cell.appendChild(header);
    
    // Day events container
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'day-events';
    
    // Find all events for this specific day
    const dayEvents = monthEvents.filter(e => e.day === day);
    
    dayEvents.forEach(evt => {
      // Do not display cards for pre-allocated empty slots unless editing
      if (evt.text.trim() === '') return;
      
      const card = document.createElement('div');
      card.className = `event-card ${evt.category}`;
      card.textContent = evt.text;
      card.title = evt.text;
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(dateStr, evt);
      });
      eventsContainer.appendChild(card);
    });
    
    cell.appendChild(eventsContainer);
    
    // Open modal by clicking anywhere on the cell
    cell.addEventListener('click', () => {
      openModal(dateStr, null);
    });
    
    gridElement.appendChild(cell);
  }
  
  // Render end padding cells to balance grid row alignment (standard multi-row balancing)
  const totalCells = startPadding + totalDays;
  const endPadding = Math.ceil(totalCells / 7) * 7 - totalCells;
  for (let i = 0; i < endPadding; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell inactive';
    gridElement.appendChild(cell);
  }
}

// Render Weekly View Layout of the current month
function renderWeek() {
  DOM.calendarGrid.innerHTML = '';
  
  // Weekly view filters events of current month, shows only days that contain actual events
  const monthEvents = getFilteredEvents(state.currentMonth).filter(e => e.text.trim() !== '');
  const weeks = {};
  
  // Group days of the month by week index
  for (let d = 1; d <= 31; d++) {
    const dateObj = new Date(2026, state.currentMonth - 1, d);
    if (dateObj.getMonth() + 1 !== state.currentMonth) continue;
    
    // Calculate week of month index
    const firstDay = new Date(2026, state.currentMonth - 1, 1);
    const firstDayIndex = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const weekIdx = Math.floor((d + firstDayIndex - 1) / 7);
    
    if (!weeks[weekIdx]) {
      weeks[weekIdx] = [];
    }
    weeks[weekIdx].push({ day: d, dateStr: `2026-${String(state.currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }
  
  // Find which week has events, or default to first week
  let activeWeekIndex = 0;
  const today = new Date();
  if (today.getFullYear() === 2026 && today.getMonth() + 1 === state.currentMonth) {
    const firstDay = new Date(2026, state.currentMonth - 1, 1);
    const firstDayIndex = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    activeWeekIndex = Math.floor((today.getDate() + firstDayIndex - 1) / 7);
  }
  
  const weekDays = weeks[activeWeekIndex] || weeks[0];
  
  // Render empty padding cells until the first day of the week
  const firstDay = weekDays[0];
  const dateObj = new Date(2026, state.currentMonth - 1, firstDay.day);
  const startPadding = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
  
  for (let i = 0; i < startPadding; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell inactive';
    DOM.calendarGrid.appendChild(cell);
  }
  
  // Render week days
  weekDays.forEach(wd => {
    const cell = document.createElement('div');
    cell.className = 'day-cell';
    
    const header = document.createElement('div');
    header.className = 'day-header';
    
    const num = document.createElement('span');
    num.className = 'day-number';
    num.textContent = wd.day;
    header.appendChild(num);
    
    const quickAdd = document.createElement('button');
    quickAdd.className = 'btn-quick-add';
    quickAdd.textContent = '+';
    quickAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(wd.dateStr, null);
    });
    header.appendChild(quickAdd);
    cell.appendChild(header);
    
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'day-events';
    
    const dayEvents = monthEvents.filter(e => e.day === wd.day);
    dayEvents.forEach(evt => {
      const card = document.createElement('div');
      card.className = `event-card ${evt.category}`;
      card.textContent = evt.text;
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal(wd.dateStr, evt);
      });
      eventsContainer.appendChild(card);
    });
    cell.appendChild(eventsContainer);
    
    cell.addEventListener('click', () => {
      openModal(wd.dateStr, null);
    });
    DOM.calendarGrid.appendChild(cell);
  });
  
  // Fill the rest of the week grid
  const endPadding = 7 - (startPadding + weekDays.length);
  for (let i = 0; i < endPadding; i++) {
    const cell = document.createElement('div');
    cell.className = 'day-cell inactive';
    DOM.calendarGrid.appendChild(cell);
  }
}

// Render Chronological List View
function renderList() {
  DOM.listEvents.innerHTML = '';
  
  const filtered = getFilteredEvents().filter(e => e.text.trim() !== '');
  
  // Sort events chronologically
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  
  if (filtered.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'list-row';
    emptyRow.style.justifyContent = 'center';
    emptyRow.style.color = 'var(--text-muted)';
    emptyRow.textContent = 'Nessun impegno trovato in questo mese.';
    DOM.listEvents.appendChild(emptyRow);
    return;
  }
  
  filtered.forEach(evt => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.addEventListener('click', () => {
      openModal(evt.date, evt);
    });
    
    const colDate = document.createElement('div');
    colDate.className = 'col-date';
    // Format date in Italian (dd/mm/yyyy)
    const dParts = evt.date.split('-');
    colDate.textContent = `${dParts[2]}/${dParts[1]}/${dParts[0]}`;
    row.appendChild(colDate);
    
    const colDay = document.createElement('div');
    colDay.className = 'col-day';
    colDay.textContent = evt.dayOfWeek || '';
    row.appendChild(colDay);
    
    const colEvent = document.createElement('div');
    colEvent.className = 'col-event';
    
    const badge = document.createElement('span');
    badge.className = `event-badge ${evt.category}`;
    badge.textContent = evt.text;
    colEvent.appendChild(badge);
    row.appendChild(colEvent);
    
    DOM.listEvents.appendChild(row);
  });
}

// Render day-by-day comparative table in comparison mode
function renderCompare() {
  DOM.compareMonthTitleA.textContent = `${MONTH_NAMES[state.compareMonthA - 1]} 2026`;
  DOM.compareMonthTitleB.textContent = `${MONTH_NAMES[state.compareMonthB - 1]} 2026`;
  
  const body = document.getElementById('compareTableBody');
  if (!body) return;
  body.innerHTML = '';
  
  const eventsA = getFilteredEvents(state.compareMonthA);
  const eventsB = getFilteredEvents(state.compareMonthB);
  
  const daysOfWeekMap = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  
  for (let day = 1; day <= 31; day++) {
    const dateObjA = new Date(2026, state.compareMonthA - 1, day);
    const dateObjB = new Date(2026, state.compareMonthB - 1, day);
    
    const isValidA = dateObjA.getMonth() + 1 === state.compareMonthA;
    const isValidB = dateObjB.getMonth() + 1 === state.compareMonthB;
    
    if (!isValidA && !isValidB) continue;
    
    const row = document.createElement('div');
    row.className = 'compare-row';
    
    // Day indicator (Column 1)
    const dayCell = document.createElement('div');
    dayCell.className = 'compare-cell-day';
    dayCell.textContent = day;
    row.appendChild(dayCell);
    
    // Month A events (Column 2)
    const cellA = document.createElement('div');
    cellA.className = 'compare-cell-events';
    if (isValidA) {
      const dowA = daysOfWeekMap[dateObjA.getDay()];
      const dayLabel = document.createElement('span');
      dayLabel.className = 'compare-day-label';
      dayLabel.textContent = `${dowA} ${day}`;
      cellA.appendChild(dayLabel);
      
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'compare-events-list';
      
      const dayEvtsA = eventsA.filter(e => e.day === day && e.text.trim() !== '');
      dayEvtsA.forEach(evt => {
        const card = document.createElement('div');
        card.className = `event-card ${evt.category}`;
        card.textContent = evt.text;
        card.title = evt.text;
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          const dateStr = `2026-${String(state.compareMonthA).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          openModal(dateStr, evt);
        });
        eventsContainer.appendChild(card);
      });
      cellA.appendChild(eventsContainer);
      
      const addBtn = document.createElement('button');
      addBtn.className = 'btn-quick-add-sm';
      addBtn.textContent = '+';
      addBtn.title = 'Aggiungi impegno';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dateStr = `2026-${String(state.compareMonthA).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        openModal(dateStr, null);
      });
      cellA.appendChild(addBtn);
      
      cellA.addEventListener('click', () => {
        const dateStr = `2026-${String(state.compareMonthA).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        openModal(dateStr, null);
      });
    } else {
      cellA.classList.add('compare-cell-disabled');
    }
    row.appendChild(cellA);
    
    // Month B events (Column 3)
    const cellB = document.createElement('div');
    cellB.className = 'compare-cell-events';
    if (isValidB) {
      const dowB = daysOfWeekMap[dateObjB.getDay()];
      const dayLabel = document.createElement('span');
      dayLabel.className = 'compare-day-label';
      dayLabel.textContent = `${dowB} ${day}`;
      cellB.appendChild(dayLabel);
      
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'compare-events-list';
      
      const dayEvtsB = eventsB.filter(e => e.day === day && e.text.trim() !== '');
      dayEvtsB.forEach(evt => {
        const card = document.createElement('div');
        card.className = `event-card ${evt.category}`;
        card.textContent = evt.text;
        card.title = evt.text;
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          const dateStr = `2026-${String(state.compareMonthB).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          openModal(dateStr, evt);
        });
        eventsContainer.appendChild(card);
      });
      cellB.appendChild(eventsContainer);
      
      const addBtn = document.createElement('button');
      addBtn.className = 'btn-quick-add-sm';
      addBtn.textContent = '+';
      addBtn.title = 'Aggiungi impegno';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dateStr = `2026-${String(state.compareMonthB).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        openModal(dateStr, null);
      });
      cellB.appendChild(addBtn);
      
      cellB.addEventListener('click', () => {
        const dateStr = `2026-${String(state.compareMonthB).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        openModal(dateStr, null);
      });
    } else {
      cellB.classList.add('compare-cell-disabled');
    }
    row.appendChild(cellB);
    
    body.appendChild(row);
  }
}

// Modal open logic
function openModal(dateStr, eventObj) {
  state.selectedEvent = eventObj;
  
  DOM.modalError.style.display = 'none';
  DOM.eventDate.value = dateStr;
  
  if (eventObj) {
    // Modify/Delete Mode
    DOM.modalTitle.textContent = 'Gestione Impegno';
    DOM.eventCategory.value = eventObj.category;
    DOM.eventText.value = eventObj.text;
    DOM.btnDeleteEvent.style.display = 'block';
    
    // Set agent dropdown if boss category
    if (['miky', 'ermelinda', 'guglielmo'].includes(eventObj.category)) {
      DOM.agentSelectorGroup.style.display = 'block';
      if (eventObj.agent) {
        DOM.eventAgent.value = eventObj.agent;
        DOM.eventAgentCustom.style.display = 'none';
      } else {
        DOM.eventAgent.value = 'custom';
        DOM.eventAgentCustom.style.display = 'block';
        const regex = new RegExp(`^(miky|ermelinda|guglielmo|gugli|erme)\\s+`, 'i');
        DOM.eventAgentCustom.value = eventObj.text.replace(regex, '').trim();
      }
    } else {
      DOM.agentSelectorGroup.style.display = 'none';
    }
    
    // Check category type to set manual text states
    const cat = eventObj.category;
    if (['academy', 'other'].includes(cat)) {
      DOM.eventManualText.disabled = true;
      DOM.eventManualText.checked = true;
      DOM.eventText.readOnly = false;
    } else {
      DOM.eventManualText.disabled = false;
      
      // Check if the current event text is auto-generated or manual
      let isStandard = false;
      const text = eventObj.text;
      if (['miky', 'ermelinda', 'guglielmo'].includes(cat)) {
        const boss = cat.toUpperCase();
        if (eventObj.agent) {
          if (text === `${boss} ${eventObj.agent.toUpperCase()}`) isStandard = true;
        } else {
          const regex = new RegExp(`^${boss}(\\s+[A-Z]+)?$`, 'i');
          if (regex.test(text)) isStandard = true;
        }
      } else if (cat === 'riunioni') {
        if (text === 'RIUNIONE Commerciale') isStandard = true;
      }
      
      if (isStandard) {
        DOM.eventManualText.checked = false;
        DOM.eventText.readOnly = true;
      } else {
        DOM.eventManualText.checked = true;
        DOM.eventText.readOnly = false;
      }
    }
  } else {
    // Add Mode
    DOM.modalTitle.textContent = 'Aggiungi Impegno';
    DOM.eventCategory.value = 'miky'; // Default category
    DOM.agentSelectorGroup.style.display = 'block';
    DOM.eventAgent.value = '';
    DOM.eventAgentCustom.style.display = 'none';
    DOM.eventAgentCustom.value = '';
    DOM.eventManualText.disabled = false;
    DOM.eventManualText.checked = false;
    DOM.eventText.readOnly = true;
    DOM.btnDeleteEvent.style.display = 'none';
    autocomposeText();
  }
  
  DOM.eventModal.classList.add('active');
}

// Generate combined text based on Category & Agent dropdowns (auto-composition)
function autocomposeText() {
  if (DOM.eventManualText.checked) {
    // User is typing manually, don't overwrite
    return;
  }
  
  const cat = DOM.eventCategory.value;
  DOM.eventText.readOnly = true;
  
  if (['miky', 'ermelinda', 'guglielmo'].includes(cat)) {
    const boss = cat.toUpperCase();
    const agentVal = DOM.eventAgent.value;
    
    if (agentVal === 'custom') {
      const customVal = DOM.eventAgentCustom.value.trim().toUpperCase();
      DOM.eventText.value = customVal ? `${boss} ${customVal}` : boss;
    } else if (agentVal !== '') {
      DOM.eventText.value = `${boss} ${agentVal.toUpperCase()}`;
    } else {
      DOM.eventText.value = boss;
    }
  } else if (cat === 'riunioni') {
    DOM.eventText.value = 'RIUNIONE Commerciale';
  } else {
    // Academy or Other
    if (!state.selectedEvent) {
      DOM.eventText.value = '';
    }
  }
}

// Close modal logic
function closeModal() {
  DOM.eventModal.classList.remove('active');
  state.selectedEvent = null;
}

// HTTP request handler to save/modify/delete event
async function saveEvent(e) {
  e.preventDefault();
  if (IS_STANDALONE) {
    const textVal = DOM.eventText.value.trim();
    if (textVal === '') {
      showModalError('Il testo dell\'impegno è obbligatorio.');
      return;
    }
    
    if (state.selectedEvent) {
      // Modify mode
      const idx = state.events.findIndex(evt => evt.id === state.selectedEvent.id);
      if (idx !== -1) {
        state.events[idx].text = textVal;
        state.events[idx].category = getEventCategory(textVal);
        state.events[idx].agent = getEventAgent(textVal);
      }
    } else {
      // Add mode
      const newDate = DOM.eventDate.value;
      const dateParts = newDate.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);
      const day = parseInt(dateParts[2]);
      
      const dateObj = new Date(year, month - 1, day);
      const daysAbbrev = ['D', 'L', 'M', 'Me', 'G', 'V', 'S'];
      const dayOfWeek = daysAbbrev[dateObj.getDay()];
      
      const newEvent = {
        id: 'evt_local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        date: newDate,
        day: day,
        month: month,
        dayOfWeek: dayOfWeek,
        text: textVal,
        category: getEventCategory(textVal),
        agent: getEventAgent(textVal)
      };
      state.events.push(newEvent);
    }
    
    localStorage.setItem('smile_calendar_events', JSON.stringify(state.events));
    closeModal();
    render();
    return;
  }
  
  DOM.modalError.style.display = 'none';
  
  const textVal = DOM.eventText.value.trim();
  if (textVal === '') {
    showModalError('Il testo dell\'impegno è obbligatorio.');
    return;
  }
  
  showLoading(true);
  
  let payload = {};
  if (state.selectedEvent) {
    // Modify or Delete (called through delete button)
    payload = {
      action: 'modify',
      sheet: state.selectedEvent.sheet,
      row: state.selectedEvent.row,
      col: state.selectedEvent.col,
      text: textVal
    };
  } else {
    // Add New Event
    payload = {
      action: 'add',
      date: DOM.eventDate.value,
      text: textVal
    };
  }
  
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if (!res.ok) {
      if (res.status === 423) {
        showModalError(result.message || 'Il file Excel è bloccato.');
      } else {
        showModalError(result.message || 'Si è verificato un errore durante il salvataggio.');
      }
      showLoading(false);
      return;
    }
    
    closeModal();
    await fetchEvents(); // Reload all events
  } catch (err) {
    console.error('Save error:', err);
    showModalError('Impossibile comunicare con il server.');
    showLoading(false);
  }
}

// Delete Event trigger
async function deleteEvent() {
  if (IS_STANDALONE) {
    if (!state.selectedEvent) return;
    if (!confirm('Sei sicuro di voler eliminare questo impegno?')) return;
    
    state.events = state.events.filter(evt => evt.id !== state.selectedEvent.id);
    
    localStorage.setItem('smile_calendar_events', JSON.stringify(state.events));
    closeModal();
    render();
    return;
  }
  
  if (!state.selectedEvent) return;
  if (!confirm('Sei sicuro di voler eliminare questo impegno?')) return;
  
  DOM.modalError.style.display = 'none';
  showLoading(true);
  
  const payload = {
    action: 'delete',
    sheet: state.selectedEvent.sheet,
    row: state.selectedEvent.row,
    col: state.selectedEvent.col
  };
  
  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await res.json();
    if (!res.ok) {
      if (res.status === 423) {
        showModalError(result.message || 'Il file Excel è bloccato.');
      } else {
        showModalError(result.message || 'Si è verificato un errore durante l\'eliminazione.');
      }
      showLoading(false);
      return;
    }
    
    closeModal();
    await fetchEvents(); // Reload
  } catch (err) {
    console.error('Delete error:', err);
    showModalError('Impossibile comunicare con il server.');
    showLoading(false);
  }
}

function showModalError(msg) {
  DOM.modalErrorText.textContent = msg;
  DOM.modalError.style.display = 'block';
}

// Bind UI event listeners
function setupEventListeners() {
  if (IS_STANDALONE && DOM.statusDesc) {
    DOM.statusDesc.addEventListener('click', (e) => {
      const resetLink = e.target.closest('#btnResetLocalDb');
      if (resetLink) {
        e.preventDefault();
        if (confirm('Sei sicuro di voler ripristinare il calendario originale cancellando tutte le modifiche locali?')) {
          localStorage.removeItem('smile_calendar_events');
          location.reload();
        }
      }
    });
  }

  // Trigger Excel File Input
  if (DOM.btnTriggerImport && DOM.excelFileInput) {
    DOM.btnTriggerImport.addEventListener('click', () => {
      DOM.excelFileInput.click();
    });
    
    DOM.excelFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      showLoading(true);
      
      const reader = new FileReader();
      reader.onload = function(evt) {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const parsedEvents = parseExcelWorkbook(workbook);
          
          if (parsedEvents.length === 0) {
            alert("Nessun appuntamento valido trovato nel file Excel selezionato. Controlla il formato.");
            showLoading(false);
            return;
          }
          
          showLoading(false);
          
          // Save to temp state and open the modal options
          state.tempParsedEvents = parsedEvents;
          DOM.importCountText.textContent = parsedEvents.length;
          DOM.importModal.classList.add('active');
        } catch (err) {
          console.error(err);
          showLoading(false);
          alert("Errore durante la lettura del file Excel: " + err.message);
        }
      };
      
      reader.onerror = function() {
        showLoading(false);
        alert("Errore durante la lettura del file.");
      };
      
      reader.readAsArrayBuffer(file);
      // Reset to allow selecting same file again
      DOM.excelFileInput.value = '';
    });
  }

  // Import Modal action handlers
  const closeImportModal = () => {
    DOM.importModal.classList.remove('active');
    state.tempParsedEvents = null;
  };

  if (DOM.btnCancelImportModal) DOM.btnCancelImportModal.addEventListener('click', closeImportModal);
  if (DOM.btnDiscardImportModal) DOM.btnDiscardImportModal.addEventListener('click', closeImportModal);

  if (DOM.btnImportReplace) {
    DOM.btnImportReplace.addEventListener('click', () => {
      if (!state.tempParsedEvents) return;
      
      state.events = state.tempParsedEvents.map(evt => {
        const category = getEventCategory(evt.text);
        const agent = getEventAgent(evt.text);
        return {
          ...evt,
          category,
          agent
        };
      });
      
      localStorage.setItem('smile_calendar_events', JSON.stringify(state.events));
      closeImportModal();
      render();
      alert("Calendario importato e sostituito con successo! 🔄");
    });
  }

  if (DOM.btnImportAppend) {
    DOM.btnImportAppend.addEventListener('click', () => {
      if (!state.tempParsedEvents) return;
      
      const existingKeys = new Set(state.events.map(evt => `${evt.date}_${evt.text.trim().toUpperCase()}`));
      let addedCount = 0;
      
      state.tempParsedEvents.forEach(evt => {
        const key = `${evt.date}_${evt.text.trim().toUpperCase()}`;
        if (!existingKeys.has(key)) {
          const category = getEventCategory(evt.text);
          const agent = getEventAgent(evt.text);
          state.events.push({
            ...evt,
            category,
            agent
          });
          addedCount++;
        }
      });
      
      localStorage.setItem('smile_calendar_events', JSON.stringify(state.events));
      closeImportModal();
      render();
      alert(`Calendario aggiornato! Aggiunti ${addedCount} nuovi impegni (saltati quelli già presenti). ➕`);
    });
  }

  // Sidebar extra database link actions
  if (DOM.btnResetImport) {
    DOM.btnResetImport.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm("Sei sicuro di voler ripristinare il calendario originale basato sul file Excel iniziale? Tutte le modifiche locali andranno perse.")) {
        localStorage.removeItem('smile_calendar_events');
        location.reload();
      }
    });
  }

  if (DOM.btnClearDatabase) {
    DOM.btnClearDatabase.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm("ATTENZIONE: Sei sicuro di voler SVUOTARE COMPLETAMENTE il calendario? Tutti gli impegni salvati verranno eliminati definitivamente.")) {
        state.events = [];
        localStorage.setItem('smile_calendar_events', JSON.stringify(state.events));
        render();
        alert("Calendario svuotato con successo! Ora puoi inserire gli impegni manualmente o importare un altro file Excel.");
      }
    });
  }

  // Sidebar View Switch buttons
  const setSidebarActive = (btn) => {
    document.querySelectorAll('.sidebar-nav .nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
  
  const hideAllSidebarDropdowns = () => {
    DOM.dropdownMiky.style.display = 'none';
    DOM.dropdownErmelinda.style.display = 'none';
    DOM.dropdownGuglielmo.style.display = 'none';
  };
  
  const handleViewChange = (newView) => {
    state.activeView = newView;
    
    if (newView === 'riunioni') {
      // Force list view
      state.currentLayout = 'list';
      // Disable layout switch buttons
      DOM.btnLayoutMonth.disabled = true;
      DOM.btnLayoutWeek.disabled = true;
      DOM.btnLayoutList.disabled = true;
      // Set list layout button active
      setLayoutActive(DOM.btnLayoutList);
    } else {
      // Restore previous layout
      state.currentLayout = state.lastSelectedLayout || 'month';
      // Re-enable layout switch buttons (unless compareMode is on)
      if (!state.compareMode) {
        DOM.btnLayoutMonth.disabled = false;
        DOM.btnLayoutWeek.disabled = false;
        DOM.btnLayoutList.disabled = false;
      }
      // Set correct layout button active
      if (state.currentLayout === 'month') setLayoutActive(DOM.btnLayoutMonth);
      else if (state.currentLayout === 'week') setLayoutActive(DOM.btnLayoutWeek);
      else if (state.currentLayout === 'list') setLayoutActive(DOM.btnLayoutList);
    }
    render();
  };

  DOM.btnViewAll.addEventListener('click', (e) => {
    setSidebarActive(e.currentTarget);
    hideAllSidebarDropdowns();
    handleViewChange('tutti');
  });
  
  DOM.btnViewMiky.addEventListener('click', (e) => {
    setSidebarActive(e.currentTarget);
    hideAllSidebarDropdowns();
    DOM.dropdownMiky.style.display = 'block';
    handleViewChange('miky');
  });
  
  DOM.btnViewErmelinda.addEventListener('click', (e) => {
    setSidebarActive(e.currentTarget);
    hideAllSidebarDropdowns();
    DOM.dropdownErmelinda.style.display = 'block';
    handleViewChange('ermelinda');
  });
  
  DOM.btnViewGuglielmo.addEventListener('click', (e) => {
    setSidebarActive(e.currentTarget);
    hideAllSidebarDropdowns();
    DOM.dropdownGuglielmo.style.display = 'block';
    handleViewChange('guglielmo');
  });
  
  DOM.btnViewAcademy.addEventListener('click', (e) => {
    setSidebarActive(e.currentTarget);
    hideAllSidebarDropdowns();
    handleViewChange('academy');
  });
  
  DOM.btnViewMeetings.addEventListener('click', (e) => {
    setSidebarActive(e.currentTarget);
    hideAllSidebarDropdowns();
    handleViewChange('riunioni');
  });
  
  // Sidebar select changes
  DOM.selectMikyAgent.addEventListener('change', (e) => {
    state.selectedMikyAgent = e.target.value;
    render();
  });
  DOM.selectErmelindaAgent.addEventListener('change', (e) => {
    state.selectedErmelindaAgent = e.target.value;
    render();
  });
  DOM.selectGuglielmoAgent.addEventListener('change', (e) => {
    state.selectedGuglielmoAgent = e.target.value;
    render();
  });
  
  // Navigation Month buttons
  DOM.btnPrevMonth.addEventListener('click', () => {
    if (state.currentMonth > 1) {
      state.currentMonth -= 1;
      DOM.selectMonth.value = state.currentMonth;
      render();
    }
  });
  
  DOM.btnNextMonth.addEventListener('click', () => {
    if (state.currentMonth < 12) {
      state.currentMonth += 1;
      DOM.selectMonth.value = state.currentMonth;
      render();
    }
  });
  
  DOM.selectMonth.addEventListener('change', (e) => {
    state.currentMonth = parseInt(e.target.value);
    render();
  });
  
  // Search bar input
  DOM.searchBar.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    render();
  });
  
  // Compare checkbox
  DOM.chkCompare.addEventListener('change', (e) => {
    state.compareMode = e.target.checked;
    if (state.compareMode) {
      DOM.compareSelectsWrapper.style.display = 'flex';
      // Disable layout toggles
      document.querySelectorAll('.view-toggle button').forEach(b => b.disabled = true);
    } else {
      DOM.compareSelectsWrapper.style.display = 'none';
      document.querySelectorAll('.view-toggle button').forEach(b => b.disabled = false);
    }
    render();
  });
  
  // Compare month dropdown selections
  DOM.selectCompareA.addEventListener('change', (e) => {
    state.compareMonthA = parseInt(e.target.value);
    render();
  });
  DOM.selectCompareB.addEventListener('change', (e) => {
    state.compareMonthB = parseInt(e.target.value);
    render();
  });
  
  // Layout toggles (Month / Week / List)
  const setLayoutActive = (btn) => {
    document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };
  
  DOM.btnLayoutMonth.addEventListener('click', (e) => {
    setLayoutActive(e.target);
    state.currentLayout = 'month';
    state.lastSelectedLayout = 'month';
    render();
  });
  DOM.btnLayoutWeek.addEventListener('click', (e) => {
    setLayoutActive(e.target);
    state.currentLayout = 'week';
    state.lastSelectedLayout = 'week';
    render();
  });
  DOM.btnLayoutList.addEventListener('click', (e) => {
    setLayoutActive(e.target);
    state.currentLayout = 'list';
    state.lastSelectedLayout = 'list';
    render();
  });
  
  DOM.btnCurrentMonth.addEventListener('click', () => {
    const now = new Date();
    state.currentMonth = (now.getFullYear() === 2026) ? (now.getMonth() + 1) : 6;
    DOM.selectMonth.value = state.currentMonth;
    
    if (state.compareMode) {
      state.compareMode = false;
      DOM.chkCompare.checked = false;
      DOM.compareSelectsWrapper.style.display = 'none';
      if (state.activeView !== 'riunioni') {
        DOM.btnLayoutMonth.disabled = false;
        DOM.btnLayoutWeek.disabled = false;
        DOM.btnLayoutList.disabled = false;
      }
    }
    render();
  });
  
  // Print Button trigger
  DOM.btnPrint.addEventListener('click', () => {
    window.print();
  });
  
  // Modal controllers
  DOM.btnCancelModal.addEventListener('click', closeModal);
  DOM.btnDiscardEvent.addEventListener('click', closeModal);
  DOM.btnDeleteEvent.addEventListener('click', deleteEvent);
  
  DOM.eventForm.addEventListener('submit', saveEvent);
  
  // Modal inputs change triggers auto-composition
  DOM.eventCategory.addEventListener('change', (e) => {
    const val = e.target.value;
    if (['miky', 'ermelinda', 'guglielmo'].includes(val)) {
      DOM.agentSelectorGroup.style.display = 'block';
      DOM.eventManualText.disabled = false;
      DOM.eventManualText.checked = false;
      DOM.eventText.readOnly = true;
    } else if (val === 'riunioni') {
      DOM.agentSelectorGroup.style.display = 'none';
      DOM.eventManualText.disabled = false;
      DOM.eventManualText.checked = false;
      DOM.eventText.readOnly = true;
    } else {
      DOM.agentSelectorGroup.style.display = 'none';
      DOM.eventAgent.value = '';
      DOM.eventAgentCustom.style.display = 'none';
      DOM.eventAgentCustom.value = '';
      
      // For academy or other, force manual input!
      DOM.eventManualText.disabled = true;
      DOM.eventManualText.checked = true;
      DOM.eventText.readOnly = false;
    }
    autocomposeText();
  });
  
  DOM.eventAgent.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      DOM.eventAgentCustom.style.display = 'block';
      DOM.eventAgentCustom.focus();
    } else {
      DOM.eventAgentCustom.style.display = 'none';
      DOM.eventAgentCustom.value = '';
    }
    autocomposeText();
  });
  
  DOM.eventAgentCustom.addEventListener('input', autocomposeText);
  
  DOM.eventManualText.addEventListener('change', (e) => {
    if (e.target.checked) {
      DOM.eventText.readOnly = false;
      DOM.eventText.focus();
    } else {
      DOM.eventText.readOnly = true;
      autocomposeText();
    }
  });
}

// Run init on load
window.addEventListener('DOMContentLoaded', init);
