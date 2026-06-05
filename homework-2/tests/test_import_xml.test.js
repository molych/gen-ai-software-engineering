'use strict';

/**
 * test_import_xml.test.js
 * Unit tests for the XML ticket importer.
 */

const fs = require('fs');
const path = require('path');
const { parseXml, normalizeTags, normalizeTicket } = require('../src/importers/xml');
const { importTickets } = require('../src/importers');
const { ImportError } = require('../src/importers/importError');

const FIXTURES = path.join(__dirname, 'fixtures');

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

// ---------------------------------------------------------------------------
// sample_tickets.xml — 30 valid records
// ---------------------------------------------------------------------------

describe('XML: sample_tickets.xml', () => {
  let records;
  beforeAll(() => {
    records = parseXml(fixture('sample_tickets.xml'));
  });

  test('parses all 30 records', () => {
    expect(records).toHaveLength(30);
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

  test('tags field is always an array when present', () => {
    for (const r of records) {
      if (r.tags !== undefined) {
        expect(Array.isArray(r.tags)).toBe(true);
      }
    }
  });

  test('metadata is an object when present', () => {
    const withMeta = records.filter((r) => r.metadata !== undefined);
    expect(withMeta.length).toBeGreaterThan(0);
    for (const r of withMeta) {
      expect(typeof r.metadata).toBe('object');
      expect(Array.isArray(r.metadata)).toBe(false);
    }
  });

  test('importTickets returns correct successful/failed counts for sample file', () => {
    const summary = importTickets(fixture('sample_tickets.xml'), 'xml');
    expect(summary.format).toBe('xml');
    expect(summary.total).toBe(30);
    expect(summary.successful).toBe(30);
    expect(summary.failed).toBe(0);
    expect(summary.tickets).toHaveLength(30);
  });
});

// ---------------------------------------------------------------------------
// Single vs multiple <ticket> nodes
// ---------------------------------------------------------------------------

describe('XML: single ticket node', () => {
  test('parses a document with exactly one <ticket> element', () => {
    const singleXml = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>CUST-SINGLE</customer_id>
    <customer_email>single@example.com</customer_email>
    <customer_name>Single User</customer_name>
    <subject>Only one ticket here</subject>
    <description>A description that is long enough to satisfy validation rules.</description>
  </ticket>
</tickets>`;
    const records = parseXml(singleXml);
    expect(records).toHaveLength(1);
    expect(records[0].customer_id).toBe('CUST-SINGLE');
    expect(records[0].customer_email).toBe('single@example.com');
  });

  test('parses a document with multiple <ticket> elements', () => {
    const multiXml = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>CUST-A</customer_id>
    <customer_email>a@example.com</customer_email>
    <customer_name>User A</customer_name>
    <subject>First ticket subject</subject>
    <description>A description that is long enough to satisfy validation rules.</description>
  </ticket>
  <ticket>
    <customer_id>CUST-B</customer_id>
    <customer_email>b@example.com</customer_email>
    <customer_name>User B</customer_name>
    <subject>Second ticket subject</subject>
    <description>Another description that is long enough to satisfy validation rules.</description>
  </ticket>
</tickets>`;
    const records = parseXml(multiXml);
    expect(records).toHaveLength(2);
    expect(records[0].customer_id).toBe('CUST-A');
    expect(records[1].customer_id).toBe('CUST-B');
  });
});

// ---------------------------------------------------------------------------
// normalizeTags
// ---------------------------------------------------------------------------

describe('XML: normalizeTags', () => {
  test('returns empty array for undefined input', () => {
    expect(normalizeTags(undefined)).toEqual([]);
  });

  test('returns empty array for null input', () => {
    expect(normalizeTags(null)).toEqual([]);
  });

  test('returns empty array for a non-object (string) input', () => {
    expect(normalizeTags('some-string')).toEqual([]);
  });

  test('returns empty array when tag key is undefined', () => {
    expect(normalizeTags({})).toEqual([]);
  });

  test('wraps a single tag string in an array', () => {
    expect(normalizeTags({ tag: 'vip' })).toEqual(['vip']);
  });

  test('preserves an array of multiple tags', () => {
    expect(normalizeTags({ tag: ['vip', 'escalated'] })).toEqual(['vip', 'escalated']);
  });

  test('trims whitespace from tags', () => {
    expect(normalizeTags({ tag: ['  vip  ', ' escalated '] })).toEqual([
      'vip',
      'escalated',
    ]);
  });

  test('filters out blank/empty tags', () => {
    expect(normalizeTags({ tag: ['vip', '', '   '] })).toEqual(['vip']);
  });
});

// ---------------------------------------------------------------------------
// normalizeTicket
// ---------------------------------------------------------------------------

describe('XML: normalizeTicket', () => {
  test('maps required fields directly', () => {
    const node = {
      customer_id: 'C1',
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Subject',
      description: 'Description',
    };
    const record = normalizeTicket(node);
    expect(record.customer_id).toBe('C1');
    expect(record.customer_email).toBe('test@example.com');
    expect(record.customer_name).toBe('Test');
    expect(record.subject).toBe('Subject');
    expect(record.description).toBe('Description');
  });

  test('includes optional fields when present', () => {
    const node = {
      customer_id: 'C1',
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Subject',
      description: 'Description',
      category: 'bug_report',
      priority: 'high',
      status: 'in_progress',
    };
    const record = normalizeTicket(node);
    expect(record.category).toBe('bug_report');
    expect(record.priority).toBe('high');
    expect(record.status).toBe('in_progress');
  });

  test('omits optional fields that are blank strings', () => {
    const node = {
      customer_id: 'C1',
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Subject',
      description: 'Description',
      category: '',
      assigned_to: '  ',
    };
    const record = normalizeTicket(node);
    expect(record.category).toBeUndefined();
    expect(record.assigned_to).toBeUndefined();
  });

  test('builds metadata object from nested metadata element', () => {
    const node = {
      customer_id: 'C1',
      customer_email: 'test@example.com',
      customer_name: 'Test',
      subject: 'Subject',
      description: 'Description',
      metadata: { source: 'chat', browser: 'Chrome', device_type: 'desktop' },
    };
    const record = normalizeTicket(node);
    expect(record.metadata).toBeDefined();
    expect(record.metadata.source).toBe('chat');
    expect(record.metadata.browser).toBe('Chrome');
    expect(record.metadata.device_type).toBe('desktop');
  });
});

// ---------------------------------------------------------------------------
// invalid_enum.xml — 1 record with an invalid category value
// ---------------------------------------------------------------------------

describe('XML: invalid_enum.xml', () => {
  test('reports the invalid ticket as failed in the summary', () => {
    const summary = importTickets(fixture('invalid_enum.xml'), 'xml');
    expect(summary.failed).toBeGreaterThan(0);
    expect(summary.successful).toBe(0);
    expect(summary.errors.length).toBeGreaterThan(0);
    expect(summary.errors[0]).toHaveProperty('index');
    expect(Array.isArray(summary.errors[0].errors)).toBe(true);
  });

  test('total equals successful plus failed', () => {
    const summary = importTickets(fixture('invalid_enum.xml'), 'xml');
    expect(summary.successful + summary.failed).toBe(summary.total);
  });
});

// ---------------------------------------------------------------------------
// malformed.xml → throws ImportError
// ---------------------------------------------------------------------------

describe('XML: malformed.xml', () => {
  test('throws ImportError for malformed XML with unclosed tag', () => {
    expect(() => parseXml(fixture('malformed.xml'))).toThrow(ImportError);
  });

  test('throws ImportError via importTickets for malformed XML', () => {
    expect(() => importTickets(fixture('malformed.xml'), 'xml')).toThrow(ImportError);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('XML: edge cases', () => {
  test('throws ImportError when content is empty via importTickets', () => {
    expect(() => importTickets('', 'xml')).toThrow(ImportError);
  });

  test('throws ImportError for unsupported format', () => {
    expect(() => importTickets('anything', 'xlsx')).toThrow(ImportError);
  });

  test('throws ImportError when <tickets> root is missing', () => {
    const noRoot = `<?xml version="1.0"?><root><ticket><customer_id>X</customer_id></ticket></root>`;
    expect(() => parseXml(noRoot)).toThrow(ImportError);
  });

  test('tickets with tags element are parsed with normalized array', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tickets>
  <ticket>
    <customer_id>CUST-TAG</customer_id>
    <customer_email>tag@example.com</customer_email>
    <customer_name>Tag User</customer_name>
    <subject>Tagged ticket subject</subject>
    <description>A description that is long enough to satisfy validation rules.</description>
    <tags><tag>vip</tag><tag>enterprise</tag></tags>
  </ticket>
</tickets>`;
    const records = parseXml(xml);
    expect(records[0].tags).toEqual(['vip', 'enterprise']);
  });
});
