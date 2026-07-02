const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const outputPath = path.join(__dirname, '..', 'calendario_prova.xlsx');

console.log('Generazione del file Excel di prova in corso...');

function generateSheetData(startMonthNum) {
  const monthNames = startMonthNum === 1 
    ? ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO']
    : ['LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
    
  const data = [];
  
  // Riga 0: Nomi dei mesi
  const row0 = [];
  for (let mIdx = 0; mIdx < 6; mIdx++) {
    row0.push(monthNames[mIdx], '', '');
  }
  data.push(row0);
  
  // Riga 1: Sotto-intestazioni
  const row1 = [];
  for (let mIdx = 0; mIdx < 6; mIdx++) {
    row1.push('G', 'M', 'Testo / Affiancamento');
  }
  data.push(row1);
  
  // Righe da 2 a 32 (giorni da 1 a 31)
  const daysAbbrev = ['D', 'L', 'M', 'Me', 'G', 'V', 'S'];
  
  for (let d = 1; d <= 31; d++) {
    const row = [];
    for (let mIdx = 0; mIdx < 6; mIdx++) {
      const monthNum = startMonthNum + mIdx;
      // Calcola i giorni totali di questo mese
      const maxDays = new Date(2026, monthNum, 0).getDate();
      
      if (d <= maxDays) {
        const dateObj = new Date(2026, monthNum - 1, d);
        const dayOfWeek = daysAbbrev[dateObj.getDay()];
        
        // Inseriamo qualche impegno finto di prova
        let text = '';
        if (d === 5) {
          if (monthNum % 2 === 0) {
            text = 'MIKY ENRICO';
          } else {
            text = 'ERMELINDA VALENTINO';
          }
        } else if (d === 12) {
          text = 'RIUNIONE Commerciale';
        } else if (d === 15) {
          text = 'GUGLIELMO ANTONIO';
        } else if (d === 22) {
          text = 'ACADEMY MASTER CLASS';
        } else if (d === 28) {
          text = 'MIKY TIZIANO';
        }
        
        row.push(d, dayOfWeek, text);
      } else {
        row.push('', '', '');
      }
    }
    data.push(row);
  }
  
  // Riga Legenda alla fine
  const legendRow = ['LEGENDA:', 'IB', 'AFFIANCAMENTI'];
  for (let c = 3; c < 18; c++) legendRow.push('');
  data.push(legendRow);
  
  return data;
}

try {
  const wb = xlsx.utils.book_new();
  
  // 1° Semestre
  const data1 = generateSheetData(1);
  const ws1 = xlsx.utils.aoa_to_sheet(data1);
  xlsx.utils.book_append_sheet(wb, ws1, 'CAL 1° SEMESTRE 2026');
  
  // 2° Semestre
  const data2 = generateSheetData(7);
  const ws2 = xlsx.utils.aoa_to_sheet(data2);
  xlsx.utils.book_append_sheet(wb, ws2, 'CAL 2° SEMESTRE 2026');
  
  xlsx.writeFile(wb, outputPath);
  console.log(`File Excel di prova creato con successo: ${outputPath} 🚀`);
} catch (err) {
  console.error('Errore durante la creazione del file Excel:', err);
}
