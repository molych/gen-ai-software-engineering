'use strict';

/**
 * test_categorization.test.js
 * Tests for the rule-based classifier and the auto-classify endpoint.
 */

const request = require('supertest');
const { createApp } = require('../src/app');
const { store } = require('../src/store');
const logger = require('../src/logger');
const {
  classify,
  scoreCategory,
  scorePriority,
  CATEGORY_KEYWORDS,
  PRIORITY_KEYWORDS,
} = require('../src/classification/classifier');

const app = createApp();

const validBody = () => ({
  customer_id: 'CUST-CAT-1',
  customer_email: 'cat@example.com',
  customer_name: 'Cat User',
  subject: 'Test subject',
  description: 'A description that is long enough to satisfy validation rules.',
});

beforeEach(() => {
  store.clear();
  logger.clear();
});

// ---------------------------------------------------------------------------
// classify() — all 6 categories
// ---------------------------------------------------------------------------

describe('classify: account_access category', () => {
  test('detects account_access from login keyword', () => {
    const result = classify('Cannot login to account', 'I cannot log in to my account.');
    expect(result.category).toBe('account_access');
  });

  test('detects account_access from password keyword', () => {
    const result = classify('Password reset needed', 'I need to reset my password.');
    expect(result.category).toBe('account_access');
  });

  test('detects account_access from 2fa keyword', () => {
    const result = classify('2FA problem', 'My 2fa authentication is not working.');
    expect(result.category).toBe('account_access');
  });
});

describe('classify: technical_issue category', () => {
  test('detects technical_issue from error keyword', () => {
    const result = classify(
      'Application error',
      'There is a timeout error when loading the app.',
    );
    expect(result.category).toBe('technical_issue');
  });

  test('detects technical_issue from crash keyword', () => {
    const result = classify('App crashed', 'The application crashed and is frozen.');
    expect(result.category).toBe('technical_issue');
  });
});

describe('classify: billing_question category', () => {
  test('detects billing_question from payment keyword', () => {
    const result = classify('Payment issue', 'I was charged twice on my invoice.');
    expect(result.category).toBe('billing_question');
  });

  test('detects billing_question from refund keyword', () => {
    const result = classify('Refund request', 'I need a refund on my subscription.');
    expect(result.category).toBe('billing_question');
  });
});

describe('classify: feature_request category', () => {
  test('detects feature_request from enhancement keyword', () => {
    const result = classify(
      'Enhancement suggestion',
      'It would be nice to have an enhancement for export.',
    );
    expect(result.category).toBe('feature_request');
  });

  test('detects feature_request from feature keyword', () => {
    const result = classify('New feature request', 'Please add a dark mode feature.');
    expect(result.category).toBe('feature_request');
  });
});

describe('classify: bug_report category', () => {
  test('detects bug_report from bug keyword', () => {
    const result = classify('Bug in dashboard', 'There is a bug causing a regression.');
    expect(result.category).toBe('bug_report');
  });

  test('detects bug_report from reproduce keyword', () => {
    const result = classify(
      'Defect report',
      'Steps to reproduce: click the button. Glitch occurs.',
    );
    expect(result.category).toBe('bug_report');
  });
});

describe('classify: other category (no keyword match)', () => {
  test('falls back to other when no category keywords match', () => {
    const result = classify('General inquiry', 'I just wanted to say hello to the team.');
    expect(result.category).toBe('other');
  });

  test('confidence is 0.3 when no keywords matched', () => {
    const result = classify('Hello', 'Just saying hello.');
    expect(result.confidence).toBe(0.3);
  });
});

// ---------------------------------------------------------------------------
// classify() — every priority tier
// ---------------------------------------------------------------------------

describe('classify: priority tiers', () => {
  test('assigns urgent priority from critical keyword', () => {
    const result = classify(
      'Critical outage',
      'This is critical production down right now.',
    );
    expect(result.priority).toBe('urgent');
  });

  test('assigns urgent priority from security keyword', () => {
    const result = classify(
      'Security breach',
      'There is a security vulnerability discovered.',
    );
    expect(result.priority).toBe('urgent');
  });

  test('assigns urgent priority from production down phrase', () => {
    const result = classify(
      'Production down',
      'The production down environment is not responding.',
    );
    expect(result.priority).toBe('urgent');
  });

  test('assigns high priority from blocking keyword', () => {
    const result = classify(
      'Blocking issue',
      'This is blocking my work and is important.',
    );
    expect(result.priority).toBe('high');
  });

  test('assigns high priority from asap keyword', () => {
    const result = classify('Need fix asap', 'Please fix this asap it is important.');
    expect(result.priority).toBe('high');
  });

  test('assigns low priority from minor keyword', () => {
    const result = classify(
      'Minor cosmetic issue',
      'This is a minor cosmetic problem only.',
    );
    expect(result.priority).toBe('low');
  });

  test('assigns low priority from suggestion keyword', () => {
    const result = classify('Suggestion only', 'Just a suggestion, not urgent at all.');
    expect(result.priority).toBe('low');
  });

  test('assigns medium priority by default when no priority keywords match', () => {
    const result = classify('A general inquiry', 'Nothing special about this ticket.');
    expect(result.priority).toBe('medium');
  });

  test('urgent takes precedence over high (first match wins)', () => {
    const result = classify(
      'Critical blocking issue',
      'This is critical and blocking my work.',
    );
    expect(result.priority).toBe('urgent');
  });
});

// ---------------------------------------------------------------------------
// classify() — output shape
// ---------------------------------------------------------------------------

describe('classify: output shape', () => {
  test('confidence is between 0 and 1 inclusive', () => {
    const subjects = [
      'Cannot login',
      'Payment refund request',
      'Bug in dashboard steps to reproduce',
      'Hello world',
    ];
    for (const subject of subjects) {
      const result = classify(subject, 'Some relevant description text.');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  test('result includes reasoning string', () => {
    const result = classify('Cannot login', 'I cannot log in to my account.');
    expect(typeof result.reasoning).toBe('string');
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  test('result includes keywords array', () => {
    const result = classify('Cannot login', 'I cannot log in to my account.');
    expect(Array.isArray(result.keywords)).toBe(true);
  });

  test('keywords array contains matched terms', () => {
    const result = classify('login issue', 'I cannot log in to my account.');
    expect(result.keywords.length).toBeGreaterThan(0);
  });

  test('keywords array is empty when no keywords match', () => {
    const result = classify('Hello world', 'Just saying hello, no special terms.');
    expect(result.keywords).toEqual([]);
  });

  test('reasoning mentions other when no category matched', () => {
    const result = classify('Hello', 'Just saying hello.');
    expect(result.reasoning).toContain('other');
  });

  test('reasoning mentions the matched category', () => {
    const result = classify(
      'Payment issue',
      'I was charged twice on my credit card invoice.',
    );
    expect(result.reasoning).toContain('billing_question');
  });

  test('confidence increases with more keyword matches', () => {
    const few = classify('login problem', 'I cannot log in.');
    const many = classify(
      'login password 2fa',
      'I cannot log in, my password reset failed, 2fa broken, locked out.',
    );
    expect(many.confidence).toBeGreaterThanOrEqual(few.confidence);
  });
});

// ---------------------------------------------------------------------------
// scoreCategory / scorePriority unit tests
// ---------------------------------------------------------------------------

describe('scoreCategory', () => {
  test('returns other with score 0 when no keywords match', () => {
    const result = scoreCategory('absolutely nothing relevant here');
    expect(result.category).toBe('other');
    expect(result.score).toBe(0);
    expect(result.keywords).toEqual([]);
  });

  test('returns correct category for a clear text match', () => {
    const result = scoreCategory('invoice refund billing payment');
    expect(result.category).toBe('billing_question');
    expect(result.score).toBeGreaterThan(0);
  });
});

describe('scorePriority', () => {
  test('returns medium with empty keywords when no priority terms match', () => {
    const result = scorePriority('nothing special in this text');
    expect(result.priority).toBe('medium');
    expect(result.keywords).toEqual([]);
  });

  test('returns urgent for critical text', () => {
    const result = scorePriority('this is critical and production down');
    expect(result.priority).toBe('urgent');
    expect(result.keywords.length).toBeGreaterThan(0);
  });

  test('returns high for blocking text', () => {
    const result = scorePriority('this is blocking my work');
    expect(result.priority).toBe('high');
  });

  test('returns low for minor text', () => {
    const result = scorePriority('this is a minor cosmetic suggestion');
    expect(result.priority).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// POST /tickets/:id/auto-classify — manual override via API
// ---------------------------------------------------------------------------

describe('POST /tickets/:id/auto-classify via API', () => {
  test('auto-classifies ticket with billing subject', async () => {
    const res1 = await request(app)
      .post('/tickets')
      .send({
        ...validBody(),
        subject: 'Invoice payment refund problem',
        description:
          'I was charged twice on my credit card and need a refund on my billing.',
      });
    const id = res1.body.id;

    const res2 = await request(app).post(`/tickets/${id}/auto-classify`).send({});
    expect(res2.status).toBe(200);
    expect(res2.body.classification.category).toBe('billing_question');
    expect(res2.body.classification.confidence).toBeGreaterThan(0);
    expect(typeof res2.body.classification.reasoning).toBe('string');
  });

  test('manual override sets method to manual and confidence to 1', async () => {
    const res1 = await request(app).post('/tickets').send(validBody());
    const id = res1.body.id;

    const res2 = await request(app)
      .post(`/tickets/${id}/auto-classify`)
      .send({ category: 'feature_request', priority: 'low' });
    expect(res2.status).toBe(200);
    expect(res2.body.method).toBe('manual');
    expect(res2.body.classification.confidence).toBe(1);
    expect(res2.body.ticket.category).toBe('feature_request');
    expect(res2.body.ticket.priority).toBe('low');
  });

  test('manual override with category only uses existing ticket priority', async () => {
    const res1 = await request(app)
      .post('/tickets')
      .send({ ...validBody(), priority: 'urgent' });
    const id = res1.body.id;

    const res2 = await request(app)
      .post(`/tickets/${id}/auto-classify`)
      .send({ category: 'bug_report' });
    expect(res2.status).toBe(200);
    expect(res2.body.ticket.category).toBe('bug_report');
    expect(res2.body.ticket.priority).toBe('urgent');
  });

  test('returns 400 for invalid manual override category', async () => {
    const res1 = await request(app).post('/tickets').send(validBody());
    const id = res1.body.id;

    const res2 = await request(app)
      .post(`/tickets/${id}/auto-classify`)
      .send({ category: 'totally_invalid' });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toBe('Validation failed');
  });

  test('returns 400 for invalid manual override priority', async () => {
    const res1 = await request(app).post('/tickets').send(validBody());
    const id = res1.body.id;

    const res2 = await request(app)
      .post(`/tickets/${id}/auto-classify`)
      .send({ priority: 'super_urgent' });
    expect(res2.status).toBe(400);
  });

  test('returns 404 for non-existent ticket', async () => {
    const res = await request(app).post('/tickets/no-such-ticket/auto-classify').send({});
    expect(res.status).toBe(404);
  });
});
