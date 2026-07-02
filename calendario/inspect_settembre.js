const xlsx = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, 'CALENDARIO AFFIANCAMENTI 2026.xls');
const workbook = xlsx.readFile(excelPath);
const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
const data = xlsx.utils.sheet_to_json(sheet2, { header: 1 });

console.log('Settembre cells:');
for (let r = 2; r < data.length; r++) {
  const row = data[r] || [];
  console.log(`Row ${r}: Day=${row[6]}, DoW=${row[7]}, Text="${row[8] || ''}"`);
}
