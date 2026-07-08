const fs = require('fs');
const path = require('path');

const EXPORTS_DIR = path.join(__dirname, '..', '..', 'exports');
const TMP_FILE = path.join(EXPORTS_DIR, '.staging.csv');

function toCsv(expenses) {
  const header = 'id,description,amount,category';
  const rows = expenses.map(
    (e) => `${e.id},${e.description},${e.amount},${e.category}`
  );
  return [header, ...rows].join('\n');
}

const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9._-]+$/;

function exportExpensesToFile(expenses, filename, callback) {
  if (typeof filename !== 'string' || !SAFE_FILENAME_PATTERN.test(filename)) {
    return callback(
      new Error('Invalid filename: only letters, numbers, dot, dash, and underscore are allowed.')
    );
  }
  const csvContent = toCsv(expenses);
  fs.writeFileSync(TMP_FILE, csvContent);
  const destination = path.join(EXPORTS_DIR, path.basename(filename));
  fs.copyFile(TMP_FILE, destination, (error) => {
    callback(error, destination);
  });
}

module.exports = {
  toCsv,
  exportExpensesToFile,
};
