'use strict';

/**
 * Lightweight in-memory decision log. Every auto-classification and every
 * manual override is recorded here so the system keeps an audit trail
 * (TASKS.md Task 2: "Log all decisions").
 */

/** @type {object[]} */
const decisions = [];

// Silence console output during tests; log to stdout otherwise.
const QUIET = process.env.NODE_ENV === 'test';

/**
 * Record a classification decision.
 * @param {object} entry
 * @param {string} entry.ticket_id
 * @param {'auto'|'manual'} entry.method
 * @param {string} entry.category
 * @param {string} entry.priority
 * @param {number} [entry.confidence]
 * @param {string} [entry.reasoning]
 * @returns {object} the stored entry (with a timestamp)
 */
function logDecision(entry) {
  const record = { ...entry, timestamp: new Date().toISOString() };
  decisions.push(record);
  if (!QUIET) {
    console.log(
      `[classify] ${record.method} ticket=${record.ticket_id} ` +
        `category=${record.category} priority=${record.priority} ` +
        `confidence=${record.confidence ?? 'n/a'}`,
    );
  }
  return record;
}

/**
 * Read decisions, optionally filtered to one ticket.
 * @param {string} [ticketId]
 * @returns {object[]}
 */
function getDecisions(ticketId) {
  if (!ticketId) return [...decisions];
  return decisions.filter((d) => d.ticket_id === ticketId);
}

/** Clear the log — used by tests for isolation. */
function clear() {
  decisions.length = 0;
}

module.exports = { logDecision, getDecisions, clear };
