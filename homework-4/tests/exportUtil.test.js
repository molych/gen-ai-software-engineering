const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const exportUtil = require('../src/utils/exportUtil');

const EXPORTS_DIR = path.join(__dirname, '..', 'exports');

// Helper to wrap callback in a Promise
function promisifyExport(expenses, filename) {
  return new Promise((resolve, reject) => {
    exportUtil.exportExpensesToFile(expenses, filename, (error, destination) => {
      resolve({ error, destination });
    });
  });
}

// Helper to clean up a test file
function cleanupFile(filename) {
  const filepath = path.join(EXPORTS_DIR, filename);
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

test('exportUtil', async (t) => {
  await t.test('exportExpensesToFile exports valid expenses to a safe filename', async () => {
    const expenses = [
      { id: 1, description: 'Coffee', amount: 4, category: 'food' },
      { id: 2, description: 'Bus ticket', amount: 2, category: 'transport' },
    ];

    const testFilename = 'test-export-valid.csv';

    try {
      const { error, destination } = await promisifyExport(expenses, testFilename);

      assert.equal(error, null);
      assert.equal(fs.existsSync(destination), true);

      const content = fs.readFileSync(destination, 'utf-8');
      assert.match(content, /id,description,amount,category/);
      assert.match(content, /1,Coffee,4,food/);
      assert.match(content, /2,Bus ticket,2,transport/);
    } finally {
      cleanupFile(testFilename);
    }
  });

  await t.test('exportExpensesToFile rejects filenames with special characters', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'test' }];
    const { error, destination } = await promisifyExport(expenses, 'file;%20touch%20/tmp/pwned');

    assert.ok(error);
    assert.match(error.message, /Invalid filename/);
    assert.equal(destination, undefined);
  });

  await t.test('exportExpensesToFile rejects filenames with path traversal attempts', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'test' }];
    const { error, destination } = await promisifyExport(expenses, '../../../etc/passwd');

    assert.ok(error);
    assert.match(error.message, /Invalid filename/);
    assert.equal(destination, undefined);
  });

  await t.test('exportExpensesToFile rejects filenames with slashes', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'test' }];
    const { error, destination } = await promisifyExport(expenses, 'subdir/file.csv');

    assert.ok(error);
    assert.match(error.message, /Invalid filename/);
    assert.equal(destination, undefined);
  });

  await t.test('exportExpensesToFile rejects non-string filenames', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'test' }];
    const { error, destination } = await promisifyExport(expenses, 123);

    assert.ok(error);
    assert.match(error.message, /Invalid filename/);
    assert.equal(destination, undefined);
  });

  await t.test('exportExpensesToFile allows filenames with dots, dashes, and underscores', async () => {
    const expenses = [
      { id: 1, description: 'Coffee', amount: 4, category: 'food' },
    ];

    const testFilename = 'test-export_v1.0.csv';

    try {
      const { error, destination } = await promisifyExport(expenses, testFilename);

      assert.equal(error, null);
      assert.equal(fs.existsSync(destination), true);
    } finally {
      cleanupFile(testFilename);
    }
  });

  await t.test('exportExpensesToFile rejects filenames with spaces', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'test' }];
    const { error, destination } = await promisifyExport(expenses, 'file with spaces.csv');

    assert.ok(error);
    assert.match(error.message, /Invalid filename/);
    assert.equal(destination, undefined);
  });

  await t.test('exportExpensesToFile properly escapes shell characters', async () => {
    const expenses = [{ id: 1, description: 'Test', amount: 10, category: 'test' }];

    const maliciousFilenames = [
      'file`whoami`.csv',
      'file$(whoami).csv',
      'file$(rm -rf /).csv',
      'file||rm -rf /.csv',
      'file&&rm -rf /.csv',
    ];

    for (const filename of maliciousFilenames) {
      const { error } = await promisifyExport(expenses, filename);
      assert.ok(error, `Should reject: ${filename}`);
    }
  });

  await t.test('exportExpensesToFile creates valid CSV content', async () => {
    const expenses = [
      { id: 1, description: 'Lunch', amount: 15, category: 'food' },
      { id: 2, description: 'Taxi', amount: 25, category: 'transport' },
      { id: 3, description: 'Book', amount: 12, category: 'entertainment' },
    ];

    const testFilename = 'test-export-content.csv';

    try {
      const { error, destination } = await promisifyExport(expenses, testFilename);

      assert.equal(error, null);

      const content = fs.readFileSync(destination, 'utf-8');
      const lines = content.split('\n');

      assert.equal(lines[0], 'id,description,amount,category');
      assert.equal(lines[1], '1,Lunch,15,food');
      assert.equal(lines[2], '2,Taxi,25,transport');
      assert.equal(lines[3], '3,Book,12,entertainment');
    } finally {
      cleanupFile(testFilename);
    }
  });

  await t.test('exportExpensesToFile handles empty expense list', async () => {
    const expenses = [];
    const testFilename = 'test-export-empty.csv';

    try {
      const { error, destination } = await promisifyExport(expenses, testFilename);

      assert.equal(error, null);
      assert.equal(fs.existsSync(destination), true);

      const content = fs.readFileSync(destination, 'utf-8');
      assert.equal(content, 'id,description,amount,category');
    } finally {
      cleanupFile(testFilename);
    }
  });
});
