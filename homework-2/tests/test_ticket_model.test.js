'use strict';

/**
 * test_ticket_model.test.js
 * Unit tests for the ticket model helpers and validation logic.
 */

const {
  createTicket,
  applyUpdate,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  SOURCES,
  DEVICE_TYPES,
  DEFAULTS,
} = require('../src/models/ticket');

const {
  validateTicketInput,
  validateField,
  validateMetadata,
  isNonEmptyString,
  isValidEmail,
} = require('../src/validation/validator');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimum valid ticket input. */
const minimalInput = () => ({
  customer_id: 'CUST-1',
  customer_email: 'test@example.com',
  customer_name: 'Test User',
  subject: 'Some subject',
  description: 'A description that is long enough to pass validation.',
});

// ---------------------------------------------------------------------------
// createTicket
// ---------------------------------------------------------------------------

describe('createTicket', () => {
  test('creates a ticket with a UUID id', () => {
    const ticket = createTicket(minimalInput());
    expect(ticket.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test('sets created_at and updated_at to ISO strings', () => {
    const before = Date.now();
    const ticket = createTicket(minimalInput());
    const after = Date.now();
    const createdMs = new Date(ticket.created_at).getTime();
    const updatedMs = new Date(ticket.updated_at).getTime();
    expect(createdMs).toBeGreaterThanOrEqual(before);
    expect(createdMs).toBeLessThanOrEqual(after);
    expect(createdMs).toBe(updatedMs);
  });

  test('applies default category, priority, and status when omitted', () => {
    const ticket = createTicket(minimalInput());
    expect(ticket.category).toBe(DEFAULTS.category);
    expect(ticket.priority).toBe(DEFAULTS.priority);
    expect(ticket.status).toBe(DEFAULTS.status);
  });

  test('uses provided category, priority, and status', () => {
    const input = {
      ...minimalInput(),
      category: 'bug_report',
      priority: 'urgent',
      status: 'in_progress',
    };
    const ticket = createTicket(input);
    expect(ticket.category).toBe('bug_report');
    expect(ticket.priority).toBe('urgent');
    expect(ticket.status).toBe('in_progress');
  });

  test('initialises resolved_at to null and assigned_to to null when not provided', () => {
    const ticket = createTicket(minimalInput());
    expect(ticket.resolved_at).toBeNull();
    expect(ticket.assigned_to).toBeNull();
  });

  test('copies tags array from input and defaults to []', () => {
    const ticketWithTags = createTicket({
      ...minimalInput(),
      tags: ['vip', 'escalated'],
    });
    expect(ticketWithTags.tags).toEqual(['vip', 'escalated']);
    // mutation of the original array must not affect the ticket
    const originalTags = ['a'];
    const ticketFromArray = createTicket({ ...minimalInput(), tags: originalTags });
    originalTags.push('b');
    expect(ticketFromArray.tags).toEqual(['a']);

    const ticketNoTags = createTicket(minimalInput());
    expect(ticketNoTags.tags).toEqual([]);
  });

  test('builds metadata with defaults when metadata is absent', () => {
    const ticket = createTicket(minimalInput());
    expect(ticket.metadata.source).toBe('api');
    expect(ticket.metadata.device_type).toBe('desktop');
    expect(ticket.metadata.browser).toBeNull();
  });

  test('sets classification to null on creation', () => {
    const ticket = createTicket(minimalInput());
    expect(ticket.classification).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyUpdate
// ---------------------------------------------------------------------------

describe('applyUpdate', () => {
  let base;
  beforeEach(() => {
    base = createTicket(minimalInput());
  });

  test('updates subject and description', () => {
    const updated = applyUpdate(base, {
      subject: 'Updated subject',
      description: 'Updated description text, long enough for validation.',
    });
    expect(updated.subject).toBe('Updated subject');
    expect(updated.description).toBe(
      'Updated description text, long enough for validation.',
    );
  });

  test('refreshes updated_at on every call', (done) => {
    const original = base.updated_at;
    // Force a minimal time gap
    setTimeout(() => {
      const updated = applyUpdate(base, { subject: 'New subject' });
      expect(updated.updated_at).not.toBe(original);
      done();
    }, 5);
  });

  test('stamps resolved_at when status changes to resolved', () => {
    const updated = applyUpdate(base, { status: 'resolved' });
    expect(updated.status).toBe('resolved');
    expect(updated.resolved_at).not.toBeNull();
    expect(typeof updated.resolved_at).toBe('string');
  });

  test('stamps resolved_at when status changes to closed', () => {
    const updated = applyUpdate(base, { status: 'closed' });
    expect(updated.resolved_at).not.toBeNull();
  });

  test('clears resolved_at when status moves away from resolved/closed', () => {
    const resolved = applyUpdate(base, { status: 'resolved' });
    const reopened = applyUpdate(resolved, { status: 'in_progress' });
    expect(reopened.resolved_at).toBeNull();
  });

  test('does not overwrite resolved_at if ticket was already resolved', () => {
    const first = applyUpdate(base, { status: 'resolved' });
    const firstTs = first.resolved_at;
    const second = applyUpdate(first, { status: 'closed' });
    expect(second.resolved_at).toBe(firstTs);
  });

  test('merges metadata rather than replacing it', () => {
    const withMeta = createTicket({
      ...minimalInput(),
      metadata: { source: 'chat', browser: 'Firefox', device_type: 'mobile' },
    });
    const updated = applyUpdate(withMeta, { metadata: { browser: 'Chrome' } });
    expect(updated.metadata.source).toBe('chat');
    expect(updated.metadata.browser).toBe('Chrome');
    expect(updated.metadata.device_type).toBe('mobile');
  });

  test('replaces tags array when provided', () => {
    const withTags = createTicket({ ...minimalInput(), tags: ['old'] });
    const updated = applyUpdate(withTags, { tags: ['new1', 'new2'] });
    expect(updated.tags).toEqual(['new1', 'new2']);
  });

  test('keeps existing tags when patch.tags is not an array', () => {
    const withTags = createTicket({ ...minimalInput(), tags: ['keep'] });
    const updated = applyUpdate(withTags, { tags: 'not-an-array' });
    expect(updated.tags).toEqual(['keep']);
  });
});

// ---------------------------------------------------------------------------
// validateTicketInput
// ---------------------------------------------------------------------------

describe('validateTicketInput', () => {
  test('returns empty errors for a fully valid ticket', () => {
    const errors = validateTicketInput(minimalInput());
    expect(errors).toHaveLength(0);
  });

  test('returns error for missing required fields', () => {
    const errors = validateTicketInput({});
    const fields = errors.map((e) => e.field);
    expect(fields).toContain('customer_id');
    expect(fields).toContain('customer_email');
    expect(fields).toContain('customer_name');
    expect(fields).toContain('subject');
    expect(fields).toContain('description');
  });

  test('returns error for invalid email', () => {
    const errors = validateTicketInput({
      ...minimalInput(),
      customer_email: 'not-an-email',
    });
    expect(errors.some((e) => e.field === 'customer_email')).toBe(true);
  });

  test('returns error when subject is empty string', () => {
    const errors = validateTicketInput({ ...minimalInput(), subject: '' });
    expect(errors.some((e) => e.field === 'subject')).toBe(true);
  });

  test('returns error when description is shorter than DESCRIPTION_MIN', () => {
    const errors = validateTicketInput({ ...minimalInput(), description: 'short' });
    expect(errors.some((e) => e.field === 'description')).toBe(true);
  });

  test('returns error when description exceeds DESCRIPTION_MAX', () => {
    const errors = validateTicketInput({
      ...minimalInput(),
      description: 'x'.repeat(2001),
    });
    expect(errors.some((e) => e.field === 'description')).toBe(true);
  });

  test('returns error for invalid category enum', () => {
    const errors = validateTicketInput({ ...minimalInput(), category: 'not_valid' });
    expect(errors.some((e) => e.field === 'category')).toBe(true);
  });

  test('returns error for invalid priority enum', () => {
    const errors = validateTicketInput({ ...minimalInput(), priority: 'super_urgent' });
    expect(errors.some((e) => e.field === 'priority')).toBe(true);
  });

  test('returns error for invalid status enum', () => {
    const errors = validateTicketInput({ ...minimalInput(), status: 'pending' });
    expect(errors.some((e) => e.field === 'status')).toBe(true);
  });

  test('returns error when tags is not an array', () => {
    const errors = validateTicketInput({ ...minimalInput(), tags: 'tag1,tag2' });
    expect(errors.some((e) => e.field === 'tags')).toBe(true);
  });

  test('validates metadata.source and metadata.device_type enums', () => {
    const errors = validateTicketInput({
      ...minimalInput(),
      metadata: { source: 'fax', device_type: 'smartwatch' },
    });
    expect(errors.some((e) => e.field === 'metadata.source')).toBe(true);
    expect(errors.some((e) => e.field === 'metadata.device_type')).toBe(true);
  });

  test('returns error when metadata is not an object', () => {
    const errors = validateTicketInput({ ...minimalInput(), metadata: 'not an object' });
    expect(errors.some((e) => e.field === 'metadata')).toBe(true);
  });

  test('partial mode skips absent required fields', () => {
    const errors = validateTicketInput({}, { partial: true });
    expect(errors).toHaveLength(0);
  });

  test('partial mode still validates present but invalid fields', () => {
    const errors = validateTicketInput({ customer_email: 'bad' }, { partial: true });
    expect(errors.some((e) => e.field === 'customer_email')).toBe(true);
  });

  test('returns body error when input is not an object', () => {
    const errors = validateTicketInput(null);
    expect(errors.some((e) => e.field === 'body')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateField — edge cases
// ---------------------------------------------------------------------------

describe('validateField', () => {
  test('accepts valid category values', () => {
    for (const cat of CATEGORIES) {
      expect(validateField('category', cat)).toBeNull();
    }
  });

  test('accepts valid priority values', () => {
    for (const p of PRIORITIES) {
      expect(validateField('priority', p)).toBeNull();
    }
  });

  test('accepts valid status values', () => {
    for (const s of STATUSES) {
      expect(validateField('status', s)).toBeNull();
    }
  });

  test('rejects tags field when not an array', () => {
    expect(validateField('tags', 'string')).not.toBeNull();
    expect(validateField('tags', 42)).not.toBeNull();
  });

  test('accepts tags field when an array', () => {
    expect(validateField('tags', [])).toBeNull();
    expect(validateField('tags', ['a', 'b'])).toBeNull();
  });

  test('default case: rejects empty string', () => {
    expect(validateField('customer_name', '')).not.toBeNull();
  });

  test('default case: accepts non-empty string', () => {
    expect(validateField('customer_name', 'Alice')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateMetadata
// ---------------------------------------------------------------------------

describe('validateMetadata', () => {
  test('returns empty errors when metadata is undefined', () => {
    expect(validateMetadata(undefined)).toEqual([]);
  });

  test('returns empty errors when metadata is null', () => {
    expect(validateMetadata(null)).toEqual([]);
  });

  test('returns error when metadata is an array', () => {
    const errors = validateMetadata([]);
    expect(errors.some((e) => e.field === 'metadata')).toBe(true);
  });

  test('accepts valid source and device_type', () => {
    for (const source of SOURCES) {
      expect(validateMetadata({ source })).toEqual([]);
    }
    for (const device_type of DEVICE_TYPES) {
      expect(validateMetadata({ device_type })).toEqual([]);
    }
  });
});
