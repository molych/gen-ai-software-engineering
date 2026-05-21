'use strict';

/**
 * test_ticket_api.test.js
 * Integration-style tests for every REST endpoint via supertest.
 */

const request = require('supertest');
const { createApp } = require('../src/app');
const { store } = require('../src/store');
const logger = require('../src/logger');

const app = createApp();

/** Minimum valid ticket body. */
const validBody = () => ({
  customer_id: 'CUST-API-1',
  customer_email: 'api@example.com',
  customer_name: 'API User',
  subject: 'Test subject',
  description: 'A description that is long enough to satisfy validation rules.',
});

beforeEach(() => {
  store.clear();
  logger.clear();
});

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// POST /tickets
// ---------------------------------------------------------------------------

describe('POST /tickets', () => {
  test('creates a ticket and returns 201 with the ticket object', async () => {
    const res = await request(app).post('/tickets').send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.customer_email).toBe('api@example.com');
    expect(res.body.status).toBe('new');
  });

  test('returns 400 with validation details for missing required fields', async () => {
    const res = await request(app).post('/tickets').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  test('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/tickets')
      .send({ ...validBody(), customer_email: 'bad-email' });
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'customer_email')).toBe(true);
  });

  test('auto-classifies when ?autoClassify=true is provided', async () => {
    const body = {
      ...validBody(),
      subject: 'Cannot login to my account',
      description: 'I cannot log in to my account and it is critical production down.',
    };
    const res = await request(app).post('/tickets?autoClassify=true').send(body);
    expect(res.status).toBe(201);
    expect(res.body.classification).not.toBeNull();
    expect(res.body.classification.method).toBe('auto');
    expect(res.body.category).toBeDefined();
  });

  test('does not auto-classify when flag is absent', async () => {
    const res = await request(app).post('/tickets').send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.classification).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GET /tickets
// ---------------------------------------------------------------------------

describe('GET /tickets', () => {
  test('returns empty list when no tickets exist', async () => {
    const res = await request(app).get('/tickets');
    expect(res.status).toBe(200);
    expect(res.body.tickets).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  test('returns paginated tickets list', async () => {
    // Create 3 tickets
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/tickets')
        .send({
          ...validBody(),
          customer_id: `CUST-${i}`,
          customer_email: `user${i}@example.com`,
        });
    }
    const res = await request(app).get('/tickets');
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
  });

  test('filters by category', async () => {
    await request(app)
      .post('/tickets')
      .send({ ...validBody(), category: 'bug_report' });
    await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        customer_email: 'b@example.com',
        category: 'billing_question',
      });

    const res = await request(app).get('/tickets?category=bug_report');
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t) => t.category === 'bug_report')).toBe(true);
  });

  test('filters by priority', async () => {
    await request(app)
      .post('/tickets')
      .send({ ...validBody(), priority: 'urgent' });
    await request(app)
      .post('/tickets')
      .send({ ...validBody(), customer_email: 'b@example.com', priority: 'low' });

    const res = await request(app).get('/tickets?priority=urgent');
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t) => t.priority === 'urgent')).toBe(true);
  });

  test('filters by status', async () => {
    await request(app)
      .post('/tickets')
      .send({ ...validBody(), status: 'in_progress' });
    await request(app)
      .post('/tickets')
      .send({ ...validBody(), customer_email: 'b@example.com', status: 'new' });

    const res = await request(app).get('/tickets?status=in_progress');
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t) => t.status === 'in_progress')).toBe(true);
  });

  test('filters by source (metadata.source)', async () => {
    await request(app)
      .post('/tickets')
      .send({ ...validBody(), metadata: { source: 'chat' } });
    await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        customer_email: 'b@example.com',
        metadata: { source: 'email' },
      });

    const res = await request(app).get('/tickets?source=chat');
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t) => t.metadata.source === 'chat')).toBe(true);
  });

  test('filters by tag', async () => {
    await request(app)
      .post('/tickets')
      .send({ ...validBody(), tags: ['vip'] });
    await request(app)
      .post('/tickets')
      .send({ ...validBody(), customer_email: 'b@example.com', tags: ['standard'] });

    const res = await request(app).get('/tickets?tag=vip');
    expect(res.status).toBe(200);
    expect(res.body.tickets.every((t) => t.tags.includes('vip'))).toBe(true);
  });

  test('searches subject and description', async () => {
    await request(app)
      .post('/tickets')
      .send({ ...validBody(), subject: 'Unique needle term' });
    await request(app)
      .post('/tickets')
      .send({ ...validBody(), customer_email: 'b@example.com', subject: 'Other ticket' });

    const res = await request(app).get('/tickets?search=needle');
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(1);
  });

  test('respects page and limit pagination params', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/tickets')
        .send({
          ...validBody(),
          customer_id: `CUST-${i}`,
          customer_email: `u${i}@example.com`,
        });
    }
    const res = await request(app).get('/tickets?page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(2);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /tickets/:id
// ---------------------------------------------------------------------------

describe('GET /tickets/:id', () => {
  test('returns a ticket by id', async () => {
    const created = await request(app).post('/tickets').send(validBody());
    const id = created.body.id;

    const res = await request(app).get(`/tickets/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).get('/tickets/nonexistent-id-123');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

// ---------------------------------------------------------------------------
// PUT /tickets/:id
// ---------------------------------------------------------------------------

describe('PUT /tickets/:id', () => {
  test('updates a ticket and returns the updated object', async () => {
    const created = await request(app).post('/tickets').send(validBody());
    const id = created.body.id;

    const res = await request(app)
      .put(`/tickets/${id}`)
      .send({ subject: 'Updated subject' });
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Updated subject');
    expect(res.body.id).toBe(id);
  });

  test('returns 404 when updating a non-existent ticket', async () => {
    const res = await request(app)
      .put('/tickets/no-such-id')
      .send({ subject: 'Updated subject' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for validation errors in the update body', async () => {
    const created = await request(app).post('/tickets').send(validBody());
    const id = created.body.id;

    const res = await request(app)
      .put(`/tickets/${id}`)
      .send({ category: 'invalid_category' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

// ---------------------------------------------------------------------------
// DELETE /tickets/:id
// ---------------------------------------------------------------------------

describe('DELETE /tickets/:id', () => {
  test('deletes a ticket and returns 204', async () => {
    const created = await request(app).post('/tickets').send(validBody());
    const id = created.body.id;

    const res = await request(app).delete(`/tickets/${id}`);
    expect(res.status).toBe(204);

    const check = await request(app).get(`/tickets/${id}`);
    expect(check.status).toBe(404);
  });

  test('returns 404 when deleting a non-existent ticket', async () => {
    const res = await request(app).delete('/tickets/ghost-ticket');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /tickets/:id/auto-classify
// ---------------------------------------------------------------------------

describe('POST /tickets/:id/auto-classify', () => {
  test('auto-classifies an existing ticket', async () => {
    const created = await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        subject: 'Cannot login to my account',
        description: 'I cannot log in and this is a security issue.',
      });
    const id = created.body.id;

    const res = await request(app).post(`/tickets/${id}/auto-classify`).send({});
    expect(res.status).toBe(200);
    expect(res.body.classification).toBeDefined();
    expect(res.body.ticket.classification).not.toBeNull();
  });

  test('applies a manual override when category/priority provided', async () => {
    const created = await request(app).post('/tickets').send(validBody());
    const id = created.body.id;

    const res = await request(app)
      .post(`/tickets/${id}/auto-classify`)
      .send({ category: 'billing_question', priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body.method).toBe('manual');
    expect(res.body.ticket.category).toBe('billing_question');
    expect(res.body.ticket.priority).toBe('high');
    expect(res.body.classification.confidence).toBe(1);
  });

  test('returns 400 for invalid override category', async () => {
    const created = await request(app).post('/tickets').send(validBody());
    const id = created.body.id;

    const res = await request(app)
      .post(`/tickets/${id}/auto-classify`)
      .send({ category: 'not_valid' });
    expect(res.status).toBe(400);
  });

  test('returns 404 for unknown ticket', async () => {
    const res = await request(app).post('/tickets/ghost/auto-classify').send({});
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Unknown routes
// ---------------------------------------------------------------------------

describe('Unknown routes', () => {
  test('returns 404 for unmatched routes', async () => {
    const res = await request(app).get('/no-such-route');
    expect(res.status).toBe(404);
  });
});
