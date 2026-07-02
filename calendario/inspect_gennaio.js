const xlsx = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, 'CALENDARIO AFFIANCAMENTI 2026.xls');
const workbook = xlsx.readFile(excelPath);
const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet1, { header: 1 });

for (let r = 2; r < 58; r++) {
  const row = data[r] || [];
  const day = row[0];
  const dow = row[1];
  const text = row[2];
  if (day !== undefined || dow !== undefined || text !== undefined) {
    console.log(`Row ${r}: Day=${day}, DoW=${dow}, Text="${text || ''}"`);
  }
}
