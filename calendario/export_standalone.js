const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const excelPath = path.join(__dirname, 'CALENDARIO AFFIANCAMENTI 2026.xls');
const indexHtmlPath = path.join(__dirname, 'public', 'index.html');
const styleCssPath = path.join(__dirname, 'public', 'style.css');
const appJsPath = path.join(__dirname, 'public', 'app.js');
const logoPath = path.join(__dirname, 'public', 'logo.png');
const outputPath = path.join(__dirname, 'smile_calendario_standalone.html');

console.log('Avvio esportazione del calendario in formato HTML standalone...');

try {
  // 1. Legge gli eventi da Excel
  if (!fs.existsSync(excelPath)) {
    console.error('Errore: File Excel non trovato.');
    process.exit(1);
  }
  
  const workbook = xlsx.readFile(excelPath);
  const events = [];
  
  const MONTH_NAMES_LIST_S1 = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO'];
  const MONTH_NAMES_LIST_S2 = ['LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
  
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
  
  // Foglio 1
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
            text: textCell ? String(textCell.v).trim() : ''
          });
        }
      }
    }
  }
  
  // Foglio 2
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
  
  console.log(`Letti con successo ${events.length} impegni da Excel.`);

  // 2. Legge il logo e lo converte in Base64
  let logoBase64 = '';
  if (fs.existsSync(logoPath)) {
    const logoData = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
    console.log('Logo aziendale convertito in Base64.');
  }

  // 3. Legge i file dell'applicazione
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  let css = fs.readFileSync(styleCssPath, 'utf8');
  let js = fs.readFileSync(appJsPath, 'utf8');

  // 4. Modifica il JavaScript per il funzionamento Offline
  // Impostiamo IS_STANDALONE su true
  js = js.replace('const IS_STANDALONE = false;', 'const IS_STANDALONE = true;');
  
  // Inseriamo i dati degli impegni all'interno di EMBEDDED_EVENTS
  const embeddedEventsStr = `const EMBEDDED_EVENTS = ${JSON.stringify(events, null, 2)};`;
  js = js.replace('const EMBEDDED_EVENTS = [];', () => embeddedEventsStr);

  // 5. Unisce tutto in un unico file HTML
  // Utilizziamo delle funzioni freccia per evitare che i caratteri speciali (es. $) nel codice vengano interpretati dal replace di JS
  html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`);
  html = html.replace('<script src="app.js"></script>', () => `<script>${js}</script>`);
  if (logoBase64) {
    html = html.replace('src="logo.png"', () => `src="${logoBase64}"`);
  }

  // 6. Scrive il file finale
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`\nEsportazione riuscita! File creato con successo: ${outputPath} ✅`);
  console.log('Puoi ora inviare questo singolo file HTML a tuo padre (es. per email o WhatsApp). Potrà aprirlo su qualsiasi dispositivo con un doppio clic.');
} catch (err) {
  console.error('Errore durante l\'esportazione:', err);
}
