const xlsx = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, 'CALENDARIO AFFIANCAMENTI 2026.xls');

const MONTHS_MAP = {
  'GENNAIO': 1, 'FEBBRAIO': 2, 'MARZO': 3, 'APRILE': 4, 'MAGGIO': 5, 'GIUGNO': 6,
  'LUGLIO': 7, 'AGOSTO': 8, 'SETTEMBRE': 9, 'OTTOBRE': 10, 'NOVEMBRE': 11, 'DICEMBRE': 12
};

function parseEvents() {
  const workbook = xlsx.readFile(excelPath);
  const events = [];
  
  // Sheet 1: first semester
  const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
  parseSheet(sheet1, workbook.SheetNames[0], events, [
    'GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO'
  ]);
  
  // Sheet 2: second semester
  const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
  parseSheet(sheet2, workbook.SheetNames[1], events, [
    'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'
  ]);
  
  console.log(`Parsed ${events.length} events.`);
  console.log('Sample events:', events.slice(0, 10));
}

function parseSheet(sheet, sheetName, events, monthNames) {
  const range = xlsx.utils.decode_range(sheet['!ref']);
  
  // Row 2 is the first day row (index 2)
  // We scan down to the legend, which starts around row 58-60.
  // To be safe, we stop when we find the first row that contains legend cells (like 'IB' or 'LEGENDA').
  // Let's scan from r = 2 down to range.e.r
  for (let r = 2; r <= range.e.r; r++) {
    // Check if this row is part of the legend
    let isLegendRow = false;
    for (let c = 0; c <= range.e.c; c++) {
      const cell = sheet[xlsx.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'string' && (cell.v === 'LEGENDA:' || cell.v === 'IB' || cell.v === 'AFFIANCAMENTI')) {
        isLegendRow = true;
        break;
      }
    }
    if (isLegendRow) {
      console.log(`Stopping scan for ${sheetName} at row ${r} due to legend.`);
      break;
    }
    
    // Process each month in the sheet
    for (let mIdx = 0; mIdx < monthNames.length; mIdx++) {
      const monthName = monthNames[mIdx];
      const monthNum = MONTHS_MAP[monthName];
      const dayCol = mIdx * 3;
      const dowCol = dayCol + 1;
      const textCol = dayCol + 2;
      
      const dayCell = sheet[xlsx.utils.encode_cell({ r, c: dayCol })];
      const dowCell = sheet[xlsx.utils.encode_cell({ r, c: dowCol })];
      const textCell = sheet[xlsx.utils.encode_cell({ r, c: textCol })];
      
      if (dayCell && dayCell.v !== undefined && dayCell.v !== null && dayCell.v !== '') {
        const dayNum = parseInt(dayCell.v);
        if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
          const dateStr = `2026-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const textVal = textCell ? String(textCell.v).trim() : '';
          
          events.push({
            id: `evt_${sheetName}_r${r}_c${textCol}`,
            date: dateStr,
            day: dayNum,
            month: monthNum,
            dayOfWeek: dowCell ? String(dowCell.v).trim() : '',
            text: textVal,
            sheet: sheetName,
            row: r,
            col: textCol
          });
        }
      }
    }
  }
}

parseEvents();
