'use strict';

/**
 * test_import_csv.test.js
 * Unit tests for the CSV ticket importer.
 */

const fs = require('fs');
const path = require('path');
const { parseCsv } = require('../src/importers/csv');
const { importTickets } = require('../src/importers');
const { ImportError } = require('../src/importers/importError');

const FIXTURES = path.join(__dirname, 'fixtures');

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

// ---------------------------------------------------------------------------
// sample_tickets.csv — 50 valid rows
// ---------------------------------------------------------------------------

describe('CSV: sample_tickets.csv', () => {
  let records;
  beforeAll(() => {
    records = parseCsv(fixture('sample_tickets.csv'));
  });

  test('parses all 50 rows', () => {
    expect(records).toHaveLength(50);
  });

  test('every record has the five required string fields', () => {
    for (const r of records) {
      expect(typeof r.customer_id).toBe('string');
      expect(typeof r.customer_email).toBe('string');
      expect(typeof r.customer_name).toBe('string');
      expect(typeof r.subject).toBe('string');
      expect(typeof r.description).toBe('string');
    }
  });

  test('tags are normalised to arrays split by semicolon', () => {
    // At least some rows in the fixture have multi-value tags (e.g. "enterprise;escalated")
    const withMulti = records.find((r) => Array.isArray(r.tags) && r.tags.length > 1);
    // There is at least one multi-tag row in the 50-row fixture
    expect(withMulti).toBeDefined();
    expect(withMulti.tags.every((t) => typeof t === 'string' && t.length > 0)).toBe(true);
  });

  test('metadata fields are populated from metadata_* columns', () => {
    const withMeta = records.filter((r) => r.metadata !== undefined);
    expect(withMeta.length).toBeGreaterThan(0);
    for (const r of withMeta) {
      expect(typeof r.metadata).toBe('object');
    }
  });

  test('importTickets returns correct successful/failed counts for sample file', () => {
    const summary = importTickets(fixture('sample_tickets.csv'), 'csv');
    expect(summary.format).toBe('csv');
    expect(summary.total).toBe(50);
    expect(summary.successful).toBe(50);
    expect(summary.failed).toBe(0);
    expect(summary.tickets).toHaveLength(50);
  });
});

// ---------------------------------------------------------------------------
// invalid_missing_fields.csv — 2 invalid rows
// ---------------------------------------------------------------------------

describe('CSV: invalid_missing_fields.csv', () => {
  test('reports errors for invalid rows in the summary', () => {
    const summary = importTickets(fixture('invalid_missing_fields.csv'), 'csv');
    expect(summary.failed).toBeGreaterThan(0);
    expect(summary.errors.length).toBeGreaterThan(0);
    expect(summary.errors[0]).toHaveProperty('index');
    expect(Array.isArray(summary.errors[0].errors)).toBe(true);
  });

  test('successful count equals total minus failed', () => {
    const summary = importTickets(fixture('invalid_missing_fields.csv'), 'csv');
    expect(summary.successful + summary.failed).toBe(summary.total);
  });
});

// ---------------------------------------------------------------------------
// Malformed / edge cases
// ---------------------------------------------------------------------------

describe('CSV: malformed and edge cases', () => {
  test('throws ImportError on malformed CSV', () => {
    const bad = 'col1,col2\nval1,val2,extra_column_breaks_parse';
    expect(() => parseCsv(bad)).toThrow(ImportError);
  });

  test('throws ImportError on empty content string', () => {
    expect(() => importTickets('', 'csv')).toThrow(ImportError);
  });

  test('throws ImportError for unsupported format', () => {
    expect(() => importTickets('anything', 'pdf')).toThrow(ImportError);
  });

  test('throws ImportError when CSV has a header row but no data rows', () => {
    const headerOnly = 'customer_id,customer_email,customer_name,subject,description\n';
    expect(() => parseCsv(headerOnly)).toThrow(ImportError);
  });
});
