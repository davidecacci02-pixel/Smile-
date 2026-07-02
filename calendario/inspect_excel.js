const xlsx = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, 'CALENDARIO AFFIANCAMENTI 2026.xls');

try {
  const workbook = xlsx.readFile(excelPath);
  console.log('Sheets found:', workbook.SheetNames);
  
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const range = xlsx.utils.decode_range(sheet['!ref']);
    console.log(`\n--- Sheet: ${sheetName} ---`);
    console.log('Range:', range);
    
    // Print first 5 rows and 20 columns
    for (let r = 0; r < 5; r++) {
      let rowStr = `Row ${r}: `;
      for (let c = range.s.c; c <= Math.min(range.e.c, 25); c++) {
        const cellRef = xlsx.utils.encode_cell({ r, c });
        const cell = sheet[cellRef];
        rowStr += `[Col ${c} (${cellRef}): ${cell ? cell.v : 'EMPTY'}] `;
      }
      console.log(rowStr);
    }
  });
} catch (error) {
  console.error('Error reading Excel file:', error);
}
