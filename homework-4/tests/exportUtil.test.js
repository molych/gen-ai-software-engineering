const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { exportExpensesToFile, toCsv } = require('../src/utils/exportUtil');

const EXPORTS_DIR = path.join(__dirname, '..', 'exports');

// Helper function to promisify exportExpensesToFile
function exportAsync(expenses, filename) {
  return new Promise((resolve, reject) => {
    exportExpensesToFile(expenses, filename, (error, destination) => {
      if (error) {
        reject(error);
      } else {
        resolve(destination);
      }
    });
  });
}

test('exportUtil', async (t) => {
  // Clean up any test files after each test
  t.afterEach(() => {
    const testFiles = [
      'valid.csv',
      'valid2.csv',
      'valid3.csv',
      'test_file.csv',
      'file-with-dash.csv',
      'file123.csv',
      'a.b.c.csv',
      'UPPERCASE.CSV',
      '.staging.csv', // Temporary staging file created by exportExpensesToFile
    ];
    testFiles.forEach((file) => {
      const filePath = path.join(EXPORTS_DIR, file);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        // File might not exist, that's ok
      }
    });
  });

  await t.test('exportExpensesToFile accepts valid filenames with letters', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'valid.csv';

    const destination = await exportAsync(expenses, filename);
    assert.ok(destination.includes('valid.csv'));
    assert.ok(fs.existsSync(destination));
    const content = fs.readFileSync(destination, 'utf8');
    assert.ok(content.includes('Test'));
  });

  await t.test('exportExpensesToFile accepts valid filenames with numbers', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'file123.csv';

    const destination = await exportAsync(expenses, filename);
    assert.ok(destination.includes('file123.csv'));
    assert.ok(fs.existsSync(destination));
  });

  await t.test('exportExpensesToFile accepts valid filenames with dashes', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'file-with-dash.csv';

    const destination = await exportAsync(expenses, filename);
    assert.ok(destination.includes('file-with-dash.csv'));
    assert.ok(fs.existsSync(destination));
  });

  await t.test('exportExpensesToFile accepts valid filenames with underscores', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'test_file.csv';

    const destination = await exportAsync(expenses, filename);
    assert.ok(destination.includes('test_file.csv'));
    assert.ok(fs.existsSync(destination));
  });

  await t.test('exportExpensesToFile accepts valid filenames with multiple dots', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'a.b.c.csv';

    const destination = await exportAsync(expenses, filename);
    assert.ok(destination.includes('a.b.c.csv'));
    assert.ok(fs.existsSync(destination));
  });

  await t.test('exportExpensesToFile accepts valid filenames with uppercase letters', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'UPPERCASE.CSV';

    const destination = await exportAsync(expenses, filename);
    assert.ok(destination.includes('UPPERCASE.CSV'));
    assert.ok(fs.existsSync(destination));
  });

  await t.test('exportExpensesToFile rejects filenames with semicolon', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'file;.csv';

    try {
      await exportAsync(expenses, filename);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
      assert.ok(error.message.includes('Invalid filename'));
    }
  });

  await t.test('exportExpensesToFile rejects filenames with space', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'file .csv';

    try {
      await exportAsync(expenses, filename);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
      assert.ok(error.message.includes('Invalid filename'));
    }
  });

  await t.test('exportExpensesToFile rejects filenames with forward slash', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'file/path.csv';

    try {
      await exportAsync(expenses, filename);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
      assert.ok(error.message.includes('Invalid filename'));
    }
  });

  await t.test('exportExpensesToFile rejects filenames with backslash', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'file\\path.csv';

    try {
      await exportAsync(expenses, filename);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
      assert.ok(error.message.includes('Invalid filename'));
    }
  });

  await t.test('exportExpensesToFile rejects filenames with pipe', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'file|path.csv';

    try {
      await exportAsync(expenses, filename);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
      assert.ok(error.message.includes('Invalid filename'));
    }
  });

  await t.test('exportExpensesToFile rejects filenames with ampersand', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'file&path.csv';

    try {
      await exportAsync(expenses, filename);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
      assert.ok(error.message.includes('Invalid filename'));
    }
  });

  await t.test('exportExpensesToFile rejects non-string filename (number)', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 123;

    try {
      await exportAsync(expenses, filename);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
      assert.ok(error.message.includes('Invalid filename'));
    }
  });

  await t.test('exportExpensesToFile rejects non-string filename (null)', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = null;

    try {
      await exportAsync(expenses, filename);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
      assert.ok(error.message.includes('Invalid filename'));
    }
  });

  await t.test('exportExpensesToFile rejects non-string filename (undefined)', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = undefined;

    try {
      await exportAsync(expenses, filename);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
      assert.ok(error.message.includes('Invalid filename'));
    }
  });

  await t.test('exportExpensesToFile rejects non-string filename (object)', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = { name: 'file.csv' };

    try {
      await exportAsync(expenses, filename);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error);
      assert.ok(error.message.includes('Invalid filename'));
    }
  });

  await t.test('exportExpensesToFile successfully writes CSV content to file', async () => {
    const expenses = [
      { id: 1, description: 'Coffee', amount: 4, category: 'food' },
      { id: 2, description: 'Bus ticket', amount: 2, category: 'transport' },
    ];
    const filename = 'valid.csv';

    const destination = await exportAsync(expenses, filename);
    const content = fs.readFileSync(destination, 'utf8');
    assert.ok(content.includes('id,description,amount,category'));
    assert.ok(content.includes('Coffee'));
    assert.ok(content.includes('Bus ticket'));
  });

  await t.test('exportExpensesToFile writes correct CSV format for multiple expenses', async () => {
    const expenses = [
      { id: 1, description: 'Coffee', amount: 4.5, category: 'food' },
      { id: 2, description: 'Bus', amount: 2, category: 'transport' },
      { id: 3, description: 'Lunch', amount: 10, category: 'food' },
    ];
    const filename = 'valid2.csv';

    const destination = await exportAsync(expenses, filename);
    const content = fs.readFileSync(destination, 'utf8');
    const lines = content.split('\n');
    assert.equal(lines.length, 4); // header + 3 expenses
    assert.ok(lines[0].includes('id,description,amount,category'));
    assert.ok(lines[1].includes('1,Coffee,4.5,food'));
    assert.ok(lines[2].includes('2,Bus,2,transport'));
    assert.ok(lines[3].includes('3,Lunch,10,food'));
  });

  await t.test('exportExpensesToFile creates file in exports directory', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'valid3.csv';

    const destination = await exportAsync(expenses, filename);
    const dirPath = path.dirname(destination);
    assert.equal(dirPath, EXPORTS_DIR);
  });

  await t.test('exportExpensesToFile returns destination path in callback', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'food' }];
    const filename = 'valid.csv';

    const destination = await exportAsync(expenses, filename);
    assert.ok(typeof destination === 'string');
    assert.ok(destination.includes('valid.csv'));
  });

  await t.test('exportExpensesToFile exports empty expenses array to CSV', async () => {
    const expenses = [];
    const filename = 'valid.csv';

    const destination = await exportAsync(expenses, filename);
    const content = fs.readFileSync(destination, 'utf8');
    assert.ok(content.includes('id,description,amount,category'));
    const lines = content.split('\n');
    assert.equal(lines.length, 1); // only header
  });

  await t.test('toCsv creates proper CSV header', () => {
    const expenses = [];
    const csv = toCsv(expenses);
    assert.equal(csv, 'id,description,amount,category');
  });

  await t.test('toCsv formats single expense correctly', () => {
    const expenses = [{ id: 1, description: 'Coffee', amount: 4, category: 'food' }];
    const csv = toCsv(expenses);
    assert.ok(csv.includes('id,description,amount,category'));
    assert.ok(csv.includes('1,Coffee,4,food'));
  });

  await t.test('toCsv formats multiple expenses with newlines', () => {
    const expenses = [
      { id: 1, description: 'Coffee', amount: 4, category: 'food' },
      { id: 2, description: 'Bus', amount: 2, category: 'transport' },
    ];
    const csv = toCsv(expenses);
    const lines = csv.split('\n');
    assert.equal(lines.length, 3); // header + 2 expenses
    assert.equal(lines[0], 'id,description,amount,category');
    assert.ok(lines[1].includes('1,Coffee,4,food'));
    assert.ok(lines[2].includes('2,Bus,2,transport'));
  });
});
