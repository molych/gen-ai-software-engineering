const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const EXPORTS_DIR = path.join(__dirname, '..', '..', 'exports');
const TMP_FILE = path.join(EXPORTS_DIR, '.staging.csv');

function toCsv(expenses) {
  const header = 'id,description,amount,category';
  const rows = expenses.map(
    (e) => `${e.id},${e.description},${e.amount},${e.category}`
  );
  return [header, ...rows].join('\n');
}

function exportExpensesToFile(expenses, filename, callback) {
  const csvContent = toCsv(expenses);
  fs.writeFileSync(TMP_FILE, csvContent);
  const destination = path.join(EXPORTS_DIR, filename);
  exec(`cp ${TMP_FILE} ${destination}`, (error, stdout, stderr) => {
    callback(error, destination);
  });
}

module.exports = {
  toCsv,
  exportExpensesToFile,
};
