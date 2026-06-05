'use strict';

/**
 * test_import_json.test.js
 * Unit tests for the JSON ticket importer.
 */

const fs = require('fs');
const path = require('path');
const { parseJson } = require('../src/importers/json');
const { importTickets } = require('../src/importers');
const { ImportError } = require('../src/importers/importError');

const FIXTURES = path.join(__dirname, 'fixtures');

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

// ---------------------------------------------------------------------------
// sample_tickets.json — 20 valid records (bare array)
// ---------------------------------------------------------------------------

describe('JSON: sample_tickets.json', () => {
  let records;
  beforeAll(() => {
    records = parseJson(fixture('sample_tickets.json'));
  });

  test('parses all 20 records from a bare array', () => {
    expect(records).toHaveLength(20);
  });

  test('every record has the required string fields', () => {
    for (const r of records) {
      expect(typeof r.customer_id).toBe('string');
      expect(typeof r.customer_email).toBe('string');
      expect(typeof r.customer_name).toBe('string');
      expect(typeof r.subject).toBe('string');
      expect(typeof r.description).toBe('string');
    }
  });

  test('importTickets returns 20 successful tickets for sample file', () => {
    const summary = importTickets(fixture('sample_tickets.json'), 'json');
    expect(summary.format).toBe('json');
    expect(summary.total).toBe(20);
    expect(summary.successful).toBe(20);
    expect(summary.failed).toBe(0);
    expect(summary.tickets).toHaveLength(20);
  });
});

// ---------------------------------------------------------------------------
// Object shape: { "tickets": [...] }
// ---------------------------------------------------------------------------

describe('JSON: object shape with tickets key', () => {
  test('accepts { tickets: [...] } wrapper object', () => {
    const wrapped = JSON.stringify({
      tickets: [
        {
          customer_id: 'C1',
          customer_email: 'a@example.com',
          customer_name: 'Alice',
          subject: 'Wrapped subject',
          description: 'Long enough description to satisfy the minimum length check.',
        },
      ],
    });
    const records = parseJson(wrapped);
    expect(records).toHaveLength(1);
    expect(records[0].customer_id).toBe('C1');
  });

  test('throws ImportError for object that lacks a tickets key', () => {
    const noTickets = JSON.stringify({ data: [] });
    expect(() => parseJson(noTickets)).toThrow(ImportError);
  });
});

// ---------------------------------------------------------------------------
// invalid_bad_email.json — 2 invalid records
// ---------------------------------------------------------------------------

describe('JSON: invalid_bad_email.json', () => {
  test('reports validation errors for bad email and short description', () => {
    const summary = importTickets(fixture('invalid_bad_email.json'), 'json');
    expect(summary.failed).toBe(2);
    expect(summary.successful).toBe(0);
    const emailError = summary.errors.find((e) =>
      e.errors.some((err) => err.field === 'customer_email'),
    );
    expect(emailError).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Malformed / edge cases
// ---------------------------------------------------------------------------

describe('JSON: malformed and edge cases', () => {
  test('throws ImportError on malformed JSON', () => {
    expect(() => parseJson(fixture('malformed.json'))).toThrow(ImportError);
  });

  test('throws ImportError for empty array []', () => {
    expect(() => parseJson('[]')).toThrow(ImportError);
  });

  test('throws ImportError for object with empty tickets array', () => {
    expect(() => parseJson('{"tickets":[]}')).toThrow(ImportError);
  });

  test('throws ImportError when content is empty via importTickets', () => {
    expect(() => importTickets('  ', 'json')).toThrow(ImportError);
  });
});
