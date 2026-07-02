const xlsx = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, 'CALENDARIO AFFIANCAMENTI 2026.xls');
const workbook = xlsx.readFile(excelPath);
const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
const data = xlsx.utils.sheet_to_json(sheet2, { header: 1 });

console.log('Total rows in sheet 2:', data.length);
for (let r = 0; r < data.length; r++) {
  const row = data[r] || [];
  console.log(`Row ${r}:`, row.slice(0, 18).map(v => v === undefined ? '' : v));
}
