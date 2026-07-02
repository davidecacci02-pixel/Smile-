const xlsx = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, 'CALENDARIO AFFIANCAMENTI 2026.xls');
const workbook = xlsx.readFile(excelPath);
const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet1, { header: 1 });

console.log('Total rows in sheet 1:', data.length);
for (let r = 0; r < data.length; r++) {
  const row = data[r];
  const hasContent = row && row.some(cell => cell !== undefined && cell !== null && cell !== '');
  if (hasContent) {
    // Print row index and some columns
    console.log(`Row ${r}:`, row.slice(0, 18).map(v => v === undefined ? '' : v));
  }
}
