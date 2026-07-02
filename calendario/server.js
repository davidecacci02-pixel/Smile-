const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 4000;
const EXCEL_FILE = path.join(__dirname, 'CALENDARIO AFFIANCAMENTI 2026.xls');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const MONTHS_MAP = {
  'GENNAIO': 1, 'FEBBRAIO': 2, 'MARZO': 3, 'APRILE': 4, 'MAGGIO': 5, 'GIUGNO': 6,
  'LUGLIO': 7, 'AGOSTO': 8, 'SETTEMBRE': 9, 'OTTOBRE': 10, 'NOVEMBRE': 11, 'DICEMBRE': 12
};

const MONTH_NAMES_LIST_S1 = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO'];
const MONTH_NAMES_LIST_S2 = ['LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];

// Helper to check if a row is part of the legend/stats section
function isLegendRow(sheet, r, range) {
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[xlsx.utils.encode_cell({ r, c })];
    if (cell && typeof cell.v === 'string') {
      const val = cell.v.trim();
      if (val === 'LEGENDA:' || val === 'IB' || val === 'AFFIANCAMENTI') {
        return true;
      }
    }
  }
  return false;
}

// Helper to find the legend row index dynamically
function findLegendRow(sheet) {
  const range = xlsx.utils.decode_range(sheet['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[xlsx.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'string') {
        const val = cell.v.trim();
        if (val === 'LEGENDA:' || val === 'IB' || val === 'AFFIANCAMENTI') {
          return r;
        }
      }
    }
  }
  return -1;
}

// Helper to shift cells down in a specific column block (colStart to colEnd) for a month
function shiftMonthColumnsDown(sheet, targetRow, colStart, colEnd, bottomRow) {
  const range = xlsx.utils.decode_range(sheet['!ref']);
  
  if (bottomRow + 1 > range.e.r) {
    range.e.r = bottomRow + 1;
    sheet['!ref'] = xlsx.utils.encode_range(range);
  }

  for (let r = bottomRow; r >= targetRow; r--) {
    for (let c = colStart; c <= colEnd; c++) {
      const fromRef = xlsx.utils.encode_cell({ r, c });
      const toRef = xlsx.utils.encode_cell({ r: r + 1, c });
      if (sheet[fromRef]) {
        sheet[toRef] = sheet[fromRef];
        delete sheet[fromRef];
      } else {
        delete sheet[toRef];
      }
    }
  }
}

// Helper to shift cells up in a specific column block (colStart to colEnd) for a month
function shiftMonthColumnsUp(sheet, targetRow, colStart, colEnd, bottomRow) {
  for (let r = targetRow; r < bottomRow; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      const fromRef = xlsx.utils.encode_cell({ r: r + 1, c });
      const toRef = xlsx.utils.encode_cell({ r, c });
      if (sheet[fromRef]) {
        sheet[toRef] = sheet[fromRef];
        delete sheet[fromRef];
      } else {
        delete sheet[toRef];
      }
    }
  }
  for (let c = colStart; c <= colEnd; c++) {
    delete sheet[xlsx.utils.encode_cell({ r: bottomRow, c })];
  }
}

app.get('/api/events', (req, res) => {
  if (!fs.existsSync(EXCEL_FILE)) {
    return res.status(404).json({ error: 'file_not_found', message: 'File Excel non trovato.' });
  }

  try {
    const workbook = xlsx.readFile(EXCEL_FILE);
    const events = [];
    
    // Sheet 1: first semester
    const sheet1Name = workbook.SheetNames[0];
    const sheet1 = workbook.Sheets[sheet1Name];
    const range1 = xlsx.utils.decode_range(sheet1['!ref']);
    
    for (let r = 2; r <= range1.e.r; r++) {
      if (isLegendRow(sheet1, r, range1)) break;
      
      for (let mIdx = 0; mIdx < MONTH_NAMES_LIST_S1.length; mIdx++) {
        const monthNum = mIdx + 1;
        const dayCol = mIdx * 3;
        const dowCol = dayCol + 1;
        const textCol = dayCol + 2;
        
        const dayCell = sheet1[xlsx.utils.encode_cell({ r, c: dayCol })];
        const dowCell = sheet1[xlsx.utils.encode_cell({ r, c: dowCol })];
        const textCell = sheet1[xlsx.utils.encode_cell({ r, c: textCol })];
        
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
              text: textCell ? String(textCell.v).trim() : '',
              sheet: sheet1Name,
              row: r,
              col: textCol
            });
          }
        }
      }
    }
    
    // Sheet 2: second semester
    const sheet2Name = workbook.SheetNames[1];
    const sheet2 = workbook.Sheets[sheet2Name];
    const range2 = xlsx.utils.decode_range(sheet2['!ref']);
    
    for (let r = 2; r <= range2.e.r; r++) {
      if (isLegendRow(sheet2, r, range2)) break;
      
      for (let mIdx = 0; mIdx < MONTH_NAMES_LIST_S2.length; mIdx++) {
        const monthNum = mIdx + 7;
        const dayCol = mIdx * 3;
        const dowCol = dayCol + 1;
        const textCol = dayCol + 2;
        
        const dayCell = sheet2[xlsx.utils.encode_cell({ r, c: dayCol })];
        const dowCell = sheet2[xlsx.utils.encode_cell({ r, c: dowCol })];
        const textCell = sheet2[xlsx.utils.encode_cell({ r, c: textCol })];
        
        // Handle potential typos in day cell (e.g. 'D' in September)
        let dayNum = null;
        if (dayCell && dayCell.v !== undefined && dayCell.v !== null && dayCell.v !== '') {
          dayNum = parseInt(dayCell.v);
          if (isNaN(dayNum) && String(dayCell.v).trim().toUpperCase() === 'D' && monthNum === 9 && r === 33) {
            dayNum = 30; // Hardcode fix for September 30 typo in template
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
            text: textCell ? String(textCell.v).trim() : '',
            sheet: sheet2Name,
            row: r,
            col: textCol
          });
        }
      }
    }
    
    res.json({ events });
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'read_error', message: 'Impossibile leggere il file Excel.' });
  }
});

// POST Endpoint to save/update/delete an event
app.post('/api/events', (req, res) => {
  const { action, id, sheet, row, col, date, text } = req.body;

  if (!fs.existsSync(EXCEL_FILE)) {
    return res.status(404).json({ error: 'file_not_found', message: 'File Excel non trovato.' });
  }

  try {
    const workbook = xlsx.readFile(EXCEL_FILE);
    
    if (action === 'modify' || action === 'delete') {
      if (!sheet || row === undefined || col === undefined) {
        return res.status(400).json({ error: 'bad_request', message: 'Parametri sheet, row o col mancanti.' });
      }
      
      const targetSheet = workbook.Sheets[sheet];
      if (!targetSheet) {
        return res.status(404).json({ error: 'sheet_not_found', message: `Foglio ${sheet} non trovato.` });
      }
      
      const cellRef = xlsx.utils.encode_cell({ r: row, c: col });
      
      if (action === 'delete') {
        // Find which day we are deleting the event for
        const dayCol = Math.floor(col / 3) * 3;
        const dayCell = targetSheet[xlsx.utils.encode_cell({ r: row, c: dayCol })];
        const dayVal = dayCell ? parseInt(dayCell.v) : NaN;
        
        let rowsForDayCount = 0;
        const range = xlsx.utils.decode_range(targetSheet['!ref']);
        
        if (!isNaN(dayVal)) {
          const monthNum = (sheet === workbook.SheetNames[0]) ? (Math.floor(col / 3) + 1) : (Math.floor(col / 3) + 7);
          
          for (let r = 2; r <= range.e.r; r++) {
            if (isLegendRow(targetSheet, r, range)) break;
            const checkCell = targetSheet[xlsx.utils.encode_cell({ r, c: dayCol })];
            let checkDayVal = checkCell ? parseInt(checkCell.v) : NaN;
            if (isNaN(checkDayVal) && checkCell && String(checkCell.v).trim().toUpperCase() === 'D' && monthNum === 9 && r === 33) {
              checkDayVal = 30;
            }
            if (checkDayVal === dayVal) {
              rowsForDayCount++;
            }
          }
        }
        
        if (rowsForDayCount > 1) {
          // Dynamic bottom limit based on legend
          const legendRow = findLegendRow(targetSheet);
          const bottomRow = legendRow !== -1 ? legendRow - 1 : range.e.r;
          
          // Shift columns up for this month
          shiftMonthColumnsUp(targetSheet, row, dayCol, dayCol + 2, bottomRow);
        } else {
          // Just clear the text cell
          targetSheet[cellRef] = { t: 's', v: '' };
        }
      } else {
        // Modify
        targetSheet[cellRef] = { t: 's', v: (text || '').trim() };
      }
      
    } else if (action === 'add') {
      if (!date || text === undefined) {
        return res.status(400).json({ error: 'bad_request', message: 'Parametri date o text mancanti.' });
      }
      
      const dateParts = date.split('-');
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]);
      const day = parseInt(dateParts[2]);
      
      if (year !== 2026 || isNaN(month) || isNaN(day)) {
        return res.status(400).json({ error: 'invalid_date', message: 'La data deve essere nel formato AAAA-MM-GG ed essere del 2026.' });
      }
      
      // Determine sheet and column block
      let sheetName, mIdx;
      if (month >= 1 && month <= 6) {
        sheetName = workbook.SheetNames[0];
        mIdx = month - 1;
      } else {
        sheetName = workbook.SheetNames[1];
        mIdx = month - 7;
      }
      
      const targetSheet = workbook.Sheets[sheetName];
      const range = xlsx.utils.decode_range(targetSheet['!ref']);
      const dayCol = mIdx * 3;
      const textCol = dayCol + 2;
      
      // Step 1: Scan rows to find if we already have an empty slot for this day
      let targetRowIndex = -1;
      let lastRowForDay = -1;
      
      for (let r = 2; r <= range.e.r; r++) {
        if (isLegendRow(targetSheet, r, range)) break;
        
        const dayCell = targetSheet[xlsx.utils.encode_cell({ r, c: dayCol })];
        let cellDayVal = dayCell ? parseInt(dayCell.v) : NaN;
        
        // Handle september typo
        if (isNaN(cellDayVal) && dayCell && String(dayCell.v).trim().toUpperCase() === 'D' && month === 9 && r === 33) {
          cellDayVal = 30;
        }
        
        if (cellDayVal === day) {
          lastRowForDay = r;
          const textCell = targetSheet[xlsx.utils.encode_cell({ r, c: textCol })];
          const textVal = textCell ? String(textCell.v).trim() : '';
          
          if (textVal === '' && targetRowIndex === -1) {
            targetRowIndex = r;
          }
        }
      }
      
      if (targetRowIndex !== -1) {
        // We found an empty pre-allocated slot for this day, write to it!
        const cellRef = xlsx.utils.encode_cell({ r: targetRowIndex, c: textCol });
        targetSheet[cellRef] = { t: 's', v: text.trim() };
      } else {
        // No empty slots exist for this day. We must insert a new row in the spreadsheet.
        // We will insert the row immediately after the last existing row for this day.
        let insertAtRow = -1;
        if (lastRowForDay !== -1) {
          insertAtRow = lastRowForDay + 1;
        } else {
          // Find first day that is greater than ours, insert before it
          for (let r = 2; r <= range.e.r; r++) {
            if (isLegendRow(targetSheet, r, range)) {
              insertAtRow = r;
              break;
            }
            const dayCell = targetSheet[xlsx.utils.encode_cell({ r, c: dayCol })];
            const cellDayVal = dayCell ? parseInt(dayCell.v) : NaN;
            if (!isNaN(cellDayVal) && cellDayVal > day) {
              insertAtRow = r;
              break;
            }
          }
          if (insertAtRow === -1) {
            const legendRow = findLegendRow(targetSheet);
            insertAtRow = legendRow !== -1 ? legendRow : range.e.r + 1;
          }
        }
        
        // Find legend row dynamically to determine bottom limit of shifting
        const legendRow = findLegendRow(targetSheet);
        const bottomRow = legendRow !== -1 ? legendRow - 1 : range.e.r;
        
        // Perform column shift only for this month's column block
        shiftMonthColumnsDown(targetSheet, insertAtRow, dayCol, dayCol + 2, bottomRow);
        
        // Set values for the new row in the target month column block
        const dayRef = xlsx.utils.encode_cell({ r: insertAtRow, c: dayCol });
        const dowRef = xlsx.utils.encode_cell({ r: insertAtRow, c: dayCol + 1 });
        const textRef = xlsx.utils.encode_cell({ r: insertAtRow, c: textCol });
        
        // Copy day of week name from a nearby day or use date library
        const daysOfWeekMap = ['D', 'L', 'M', 'ME', 'G', 'V', 'S'];
        const dateObj = new Date(2026, month - 1, day);
        const dowName = daysOfWeekMap[dateObj.getDay()];
        
        targetSheet[dayRef] = { t: 'n', v: day };
        targetSheet[dowRef] = { t: 's', v: dowName };
        targetSheet[textRef] = { t: 's', v: text.trim() };
      }
    } else {
      return res.status(400).json({ error: 'bad_request', message: 'Azione non valida.' });
    }

    // Attempt to write the workbook back to disk (safe-lock check)
    try {
      xlsx.writeFile(workbook, EXCEL_FILE);
      res.json({ success: true });
    } catch (writeErr) {
      console.error('File write error:', writeErr);
      if (writeErr.code === 'EBUSY' || writeErr.code === 'EACCES' || writeErr.message.includes('Permission denied')) {
        return res.status(423).json({
          error: 'file_locked',
          message: 'Il file Excel è attualmente aperto in un altro programma (es. Microsoft Excel). Chiudilo e riprova.'
        });
      }
      res.status(500).json({ error: 'write_error', message: 'Impossibile salvare le modifiche nel file Excel.' });
    }
  } catch (err) {
    console.error('API processing error:', err);
    res.status(500).json({ error: 'server_error', message: 'Errore interno del server durante il salvataggio.' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Smile Calendar Server running on http://localhost:${PORT}`);
});
