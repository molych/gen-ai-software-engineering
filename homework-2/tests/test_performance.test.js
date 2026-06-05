'use strict';

/**
 * test_performance.test.js
 * Performance/timing tests for bulk import, query latency, and classifier throughput.
 * All budgets are deliberately generous so the suite is stable across CI environments.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { store } = require('../src/store');
const logger = require('../src/logger');
const { importTickets } = require('../src/importers');
const { classify } = require('../src/classification/classifier');

const app = createApp();

const FIXTURES = path.join(__dirname, 'fixtures');

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

const validBody = (i = 0) => ({
  customer_id: `CUST-PERF-${i}`,
  customer_email: `perf${i}@example.com`,
  customer_name: `Perf User ${i}`,
  subject: `Performance test ticket number ${i}`,
  description: 'A description that is long enough to satisfy all validation rules here.',
});

beforeEach(() => {
  store.clear();
  logger.clear();
});

// ---------------------------------------------------------------------------
// Bulk import timing
// ---------------------------------------------------------------------------

describe('Performance: bulk CSV import (50 rows)', () => {
  test('importTickets parses 50-row CSV in under 2000 ms', () => {
    const content = fixture('sample_tickets.csv');
    const start = Date.now();
    const summary = importTickets(content, 'csv');
    const elapsed = Date.now() - start;

    expect(summary.successful).toBe(50);
    expect(elapsed).toBeLessThan(2000);
  });

  test('POST /tickets/import with 50-row CSV completes in under 3000 ms', async () => {
    const content = fixture('sample_tickets.csv');
    const start = Date.now();
    const res = await request(app)
      .post('/tickets/import')
      .send({ format: 'csv', content });
    const elapsed = Date.now() - start;

    expect(res.status).toBe(201);
    expect(res.body.successful).toBe(50);
    expect(elapsed).toBeLessThan(3000);
  });
});

describe('Performance: bulk JSON import (20 records)', () => {
  test('importTickets parses 20-record JSON in under 500 ms', () => {
    const content = fixture('sample_tickets.json');
    const start = Date.now();
    const summary = importTickets(content, 'json');
    const elapsed = Date.now() - start;

    expect(summary.successful).toBe(20);
    expect(elapsed).toBeLessThan(500);
  });
});

describe('Performance: bulk XML import (30 records)', () => {
  test('importTickets parses 30-record XML in under 1000 ms', () => {
    const content = fixture('sample_tickets.xml');
    const start = Date.now();
    const summary = importTickets(content, 'xml');
    const elapsed = Date.now() - start;

    expect(summary.successful).toBe(30);
    expect(elapsed).toBeLessThan(1000);
  });
});

// ---------------------------------------------------------------------------
// List / query latency with many tickets
// ---------------------------------------------------------------------------

describe('Performance: GET /tickets query latency', () => {
  test('GET /tickets with 100 tickets in store responds in under 500 ms', async () => {
    // Pre-populate the store via bulk import (50 CSV + 20 JSON + 30 XML = 100)
    await request(app)
      .post('/tickets/import')
      .send({ format: 'csv', content: fixture('sample_tickets.csv') });
    await request(app)
      .post('/tickets/import')
      .send({ format: 'json', content: fixture('sample_tickets.json') });
    await request(app)
      .post('/tickets/import')
      .send({ format: 'xml', content: fixture('sample_tickets.xml') });

    const start = Date.now();
    const res = await request(app).get('/tickets?limit=100');
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(100);
    expect(elapsed).toBeLessThan(500);
  });

  test('filtered query (category + priority) with 100 tickets responds in under 500 ms', async () => {
    await request(app)
      .post('/tickets/import')
      .send({ format: 'csv', content: fixture('sample_tickets.csv') });
    await request(app)
      .post('/tickets/import')
      .send({ format: 'json', content: fixture('sample_tickets.json') });
    await request(app)
      .post('/tickets/import')
      .send({ format: 'xml', content: fixture('sample_tickets.xml') });

    const start = Date.now();
    const res = await request(app).get('/tickets?category=technical_issue&priority=high');
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(500);
  });

  test('paginated query with limit=10 page=3 responds in under 500 ms', async () => {
    await request(app)
      .post('/tickets/import')
      .send({ format: 'csv', content: fixture('sample_tickets.csv') });

    const start = Date.now();
    const res = await request(app).get('/tickets?limit=10&page=3');
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(10);
    expect(elapsed).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
// Classifier throughput
// ---------------------------------------------------------------------------

describe('Performance: classify() throughput', () => {
  test('classify() runs 1000 times in under 1000 ms', () => {
    const subjects = [
      'Cannot login to my account',
      'Payment and invoice refund needed',
      'Bug in the dashboard steps to reproduce',
      'Feature request for dark mode enhancement',
      'Critical production down security issue',
      'Minor cosmetic suggestion for the UI',
      'App crashes with an error on timeout',
      'General inquiry about the service',
    ];

    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      classify(
        subjects[i % subjects.length],
        'Some relevant description text for classification.',
      );
    }
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });

  test('classify() result is consistent across repeated calls with same input', () => {
    const subject = 'Invoice payment refund';
    const description = 'I was charged twice on my credit card and need a refund.';

    const results = Array.from({ length: 10 }, () => classify(subject, description));
    const categories = results.map((r) => r.category);
    const priorities = results.map((r) => r.priority);
    const confidences = results.map((r) => r.confidence);

    expect(new Set(categories).size).toBe(1);
    expect(new Set(priorities).size).toBe(1);
    expect(new Set(confidences).size).toBe(1);
  });

  test('bulk auto-classify of 50 imported tickets completes in under 3000 ms', async () => {
    const content = fixture('sample_tickets.csv');
    const start = Date.now();
    const res = await request(app)
      .post('/tickets/import?autoClassify=true')
      .send({ format: 'csv', content });
    const elapsed = Date.now() - start;

    expect(res.status).toBe(201);
    expect(res.body.successful).toBe(50);
    expect(elapsed).toBeLessThan(3000);
  });
});
