'use strict';

/**
 * Rule-based ticket classification: derive a category and priority from the
 * subject + description text using keyword tables, with a confidence score,
 * human-readable reasoning, and the list of keywords that triggered the match.
 *
 * Rules mirror homework-2/CLAUDE.md (TASKS.md Task 2) verbatim.
 */

// Category keyword tables — ordered; ties break toward the earlier category.
const CATEGORY_KEYWORDS = {
  account_access: [
    'login',
    'log in',
    'log-in',
    'sign in',
    'sign-in',
    'password',
    'passwd',
    '2fa',
    'two-factor',
    'two factor',
    'authentication',
    'locked out',
    "can't access",
    'cannot access',
    'access denied',
    'reset my account',
  ],
  technical_issue: [
    'error',
    'crash',
    'crashed',
    'not working',
    "doesn't work",
    'does not work',
    'broken',
    'fails',
    'failure',
    'freeze',
    'frozen',
    'timeout',
    'exception',
    'slow',
  ],
  billing_question: [
    'billing',
    'payment',
    'invoice',
    'refund',
    'charge',
    'charged',
    'overcharged',
    'subscription',
    'pricing',
    'credit card',
  ],
  feature_request: [
    'feature request',
    'feature',
    'enhancement',
    'would be nice',
    'please add',
    'improvement',
    'i wish',
    'it would help',
  ],
  bug_report: [
    'bug',
    'defect',
    'steps to reproduce',
    'reproduce',
    'reproduction',
    'regression',
    'glitch',
    'unexpected behavior',
  ],
};

// Priority keyword tables — checked urgent → high → low; medium is the default.
const PRIORITY_KEYWORDS = {
  urgent: ["can't access", 'cannot access', 'critical', 'production down', 'security'],
  high: ['important', 'blocking', 'asap'],
  low: ['minor', 'cosmetic', 'suggestion'],
};

const PRIORITY_ORDER = ['urgent', 'high', 'low'];

/** Find every keyword from `list` present in `text`. */
function matchKeywords(text, list) {
  return list.filter((kw) => text.includes(kw));
}

/**
 * Score each category by how many of its keywords appear in the text.
 * @returns {{category: string, score: number, keywords: string[]}}
 */
function scoreCategory(text) {
  let best = { category: 'other', score: 0, keywords: [] };
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matched = matchKeywords(text, keywords);
    if (matched.length > best.score) {
      best = { category, score: matched.length, keywords: matched };
    }
  }
  return best;
}

/**
 * Pick a priority by keyword precedence.
 * @returns {{priority: string, keywords: string[]}}
 */
function scorePriority(text) {
  for (const level of PRIORITY_ORDER) {
    const matched = matchKeywords(text, PRIORITY_KEYWORDS[level]);
    if (matched.length > 0) return { priority: level, keywords: matched };
  }
  return { priority: 'medium', keywords: [] };
}

/** Map a category keyword-hit count to a 0–1 confidence score. */
function categoryConfidence(score) {
  if (score === 0) return 0.3;
  return Math.min(0.55 + 0.12 * score, 0.97);
}

/**
 * Classify a ticket's free text.
 * @param {string} subject
 * @param {string} description
 * @returns {{category: string, priority: string, confidence: number,
 *   reasoning: string, keywords: string[]}}
 */
function classify(subject = '', description = '') {
  const text = `${subject} ${description}`.toLowerCase();

  const cat = scoreCategory(text);
  const pri = scorePriority(text);
  const confidence = Number(categoryConfidence(cat.score).toFixed(2));
  const keywords = [...new Set([...cat.keywords, ...pri.keywords])];

  const reasoning =
    cat.score === 0
      ? `No category keywords matched; defaulted to "other". ` +
        `Priority "${pri.priority}" ${
          pri.keywords.length
            ? `from keyword(s): ${pri.keywords.join(', ')}.`
            : 'by default (no priority keywords matched).'
        }`
      : `Category "${cat.category}" from ${cat.score} keyword match(es): ` +
        `${cat.keywords.join(', ')}. Priority "${pri.priority}" ${
          pri.keywords.length
            ? `from keyword(s): ${pri.keywords.join(', ')}.`
            : 'by default (no priority keywords matched).'
        }`;

  return { category: cat.category, priority: pri.priority, confidence, reasoning, keywords };
}

module.exports = {
  CATEGORY_KEYWORDS,
  PRIORITY_KEYWORDS,
  classify,
  scoreCategory,
  scorePriority,
};
