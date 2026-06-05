'use strict';

/**
 * test_integration.test.js
 * End-to-end lifecycle tests, bulk import, concurrency, error handler paths.
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { store } = require('../src/store');
const logger = require('../src/logger');

const app = createApp();

const FIXTURES = path.join(__dirname, 'fixtures');

function fixture(name) {
  return fs.readFileSync(path.join(FIXTURES, name), 'utf8');
}

const validBody = () => ({
  customer_id: 'CUST-INT-1',
  customer_email: 'integration@example.com',
  customer_name: 'Integration User',
  subject: 'Integration test subject',
  description: 'A description that is long enough to satisfy all validation rules.',
});

beforeEach(() => {
  store.clear();
  logger.clear();
});

// ---------------------------------------------------------------------------
// Task 5: Full lifecycle — create → read → update → resolve → delete
// ---------------------------------------------------------------------------

describe('Full ticket lifecycle', () => {
  test('create → read → update → resolve → delete', async () => {
    // 1. Create
    const createRes = await request(app).post('/tickets').send(validBody());
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;
    expect(id).toBeDefined();
    expect(createRes.body.status).toBe('new');

    // 2. Read
    const readRes = await request(app).get(`/tickets/${id}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.id).toBe(id);

    // 3. Update subject
    const updateRes = await request(app)
      .put(`/tickets/${id}`)
      .send({ subject: 'Updated integration subject' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.subject).toBe('Updated integration subject');
    expect(updateRes.body.updated_at).not.toBe(createRes.body.updated_at);

    // 4. Resolve
    const resolveRes = await request(app)
      .put(`/tickets/${id}`)
      .send({ status: 'resolved' });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.status).toBe('resolved');
    expect(resolveRes.body.resolved_at).not.toBeNull();

    // 5. Delete
    const deleteRes = await request(app).delete(`/tickets/${id}`);
    expect(deleteRes.status).toBe(204);

    // Verify gone
    const goneRes = await request(app).get(`/tickets/${id}`);
    expect(goneRes.status).toBe(404);
  });

  test('classification persists after update', async () => {
    const createRes = await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        subject: 'Invoice payment issue billing',
        description: 'I need a refund on my subscription payment.',
      });
    const id = createRes.body.id;

    await request(app).post(`/tickets/${id}/auto-classify`).send({});

    const updateRes = await request(app)
      .put(`/tickets/${id}`)
      .send({ subject: 'Updated subject' });
    expect(updateRes.status).toBe(200);
    // classification object should still be present
    expect(updateRes.body.classification).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST /tickets/import — bulk import
// ---------------------------------------------------------------------------

describe('POST /tickets/import', () => {
  test('imports CSV and returns correct summary', async () => {
    const content = fixture('sample_tickets.csv');
    const res = await request(app)
      .post('/tickets/import')
      .send({ format: 'csv', content });
    expect(res.status).toBe(201);
    expect(res.body.format).toBe('csv');
    expect(res.body.total).toBe(50);
    expect(res.body.successful).toBe(50);
    expect(res.body.failed).toBe(0);
    expect(Array.isArray(res.body.imported)).toBe(true);
    expect(res.body.imported).toHaveLength(50);
  });

  test('imports JSON and returns correct summary', async () => {
    const content = fixture('sample_tickets.json');
    const res = await request(app)
      .post('/tickets/import')
      .send({ format: 'json', content });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(20);
    expect(res.body.successful).toBe(20);
    expect(res.body.failed).toBe(0);
  });

  test('imports XML and returns correct summary', async () => {
    const content = fixture('sample_tickets.xml');
    const res = await request(app)
      .post('/tickets/import')
      .send({ format: 'xml', content });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(30);
    expect(res.body.successful).toBe(30);
    expect(res.body.failed).toBe(0);
  });

  test('bulk import with ?autoClassify=true classifies all tickets', async () => {
    const content = fixture('sample_tickets.json');
    const res = await request(app)
      .post('/tickets/import?autoClassify=true')
      .send({ format: 'json', content });
    expect(res.status).toBe(201);
    expect(res.body.auto_classified).toBe(true);
    expect(res.body.successful).toBe(20);

    // Verify at least some imported tickets have a classification in the store
    const listRes = await request(app).get('/tickets?limit=100');
    expect(listRes.status).toBe(200);
    const classified = listRes.body.tickets.filter((t) => t.classification !== null);
    expect(classified.length).toBeGreaterThan(0);
  });

  test('returns 400 for unsupported format', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .send({ format: 'xlsx', content: 'some data' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for malformed XML content', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .send({ format: 'xml', content: fixture('malformed.xml') });
    expect(res.status).toBe(400);
  });

  test('returns 400 for malformed JSON content', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .send({ format: 'json', content: fixture('malformed.json') });
    expect(res.status).toBe(400);
  });

  test('returns summary with failed entries for invalid enum values', async () => {
    const content = fixture('invalid_enum.xml');
    const res = await request(app)
      .post('/tickets/import')
      .send({ format: 'xml', content });
    expect(res.status).toBe(201);
    expect(res.body.failed).toBeGreaterThan(0);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('imported tickets appear in GET /tickets list', async () => {
    const content = fixture('sample_tickets.xml');
    await request(app).post('/tickets/import').send({ format: 'xml', content });

    const listRes = await request(app).get('/tickets?limit=100');
    expect(listRes.status).toBe(200);
    expect(listRes.body.pagination.total).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Concurrency — 20+ simultaneous POST /tickets
// ---------------------------------------------------------------------------

describe('Concurrent ticket creation', () => {
  test('20 concurrent POST /tickets all return 201', async () => {
    const requests = Array.from({ length: 20 }, (_, i) =>
      request(app)
        .post('/tickets')
        .send({
          customer_id: `CUST-CONC-${i}`,
          customer_email: `conc${i}@example.com`,
          customer_name: `Concurrent User ${i}`,
          subject: `Concurrent ticket number ${i}`,
          description:
            'A description long enough to satisfy the minimum length validation.',
        }),
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map((r) => r.status);
    expect(statuses.every((s) => s === 201)).toBe(true);

    // All 20 should be in the store
    const listRes = await request(app).get('/tickets?limit=100');
    expect(listRes.body.pagination.total).toBe(20);
  });

  test('concurrent POSTs all receive unique ids', async () => {
    const requests = Array.from({ length: 20 }, (_, i) =>
      request(app)
        .post('/tickets')
        .send({
          customer_id: `CUST-ID-${i}`,
          customer_email: `uid${i}@example.com`,
          customer_name: `UID User ${i}`,
          subject: `Unique id test ticket ${i}`,
          description:
            'A description long enough to satisfy the minimum length validation.',
        }),
    );
    const responses = await Promise.all(requests);
    const ids = responses.map((r) => r.body.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Combined filtering
// ---------------------------------------------------------------------------

describe('Combined category + priority filtering', () => {
  test('filters by both category and priority', async () => {
    // Create tickets with various categories and priorities
    await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        customer_email: 'a@example.com',
        category: 'bug_report',
        priority: 'urgent',
      });
    await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        customer_email: 'b@example.com',
        category: 'bug_report',
        priority: 'low',
      });
    await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        customer_email: 'c@example.com',
        category: 'billing_question',
        priority: 'urgent',
      });

    const res = await request(app).get('/tickets?category=bug_report&priority=urgent');
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.tickets[0].category).toBe('bug_report');
    expect(res.body.tickets[0].priority).toBe('urgent');
  });

  test('filters by status and category together', async () => {
    await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        customer_email: 'x@example.com',
        category: 'technical_issue',
        status: 'resolved',
      });
    await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        customer_email: 'y@example.com',
        category: 'technical_issue',
        status: 'new',
      });
    await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        customer_email: 'z@example.com',
        category: 'billing_question',
        status: 'resolved',
      });

    const res = await request(app).get(
      '/tickets?category=technical_issue&status=resolved',
    );
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
    expect(res.body.tickets[0].category).toBe('technical_issue');
    expect(res.body.tickets[0].status).toBe('resolved');
  });
});

// ---------------------------------------------------------------------------
// Error handler paths — 404 not-found and malformed JSON body
// ---------------------------------------------------------------------------

describe('Error handler: 404 for unknown routes', () => {
  test('GET to an unknown path returns 404 JSON with error field', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  test('POST to an unknown path returns 404 JSON', async () => {
    const res = await request(app).post('/unknown/endpoint');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  test('DELETE to an unknown path returns 404 JSON', async () => {
    const res = await request(app).delete('/totally/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('Error handler: malformed JSON body', () => {
  test('POST with malformed JSON body returns 400', async () => {
    const res = await request(app)
      .post('/tickets')
      .set('Content-Type', 'application/json')
      .send('{bad json :::}');
    expect(res.status).toBe(400);
  });

  test('PUT with malformed JSON body returns 400', async () => {
    // First create a valid ticket
    const createRes = await request(app).post('/tickets').send(validBody());
    const id = createRes.body.id;

    const res = await request(app)
      .put(`/tickets/${id}`)
      .set('Content-Type', 'application/json')
      .send('{bad json :::}');
    expect(res.status).toBe(400);
  });
});
