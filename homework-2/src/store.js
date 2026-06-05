'use strict';

/**
 * In-memory ticket store: a Map keyed by ticket id, plus filtered querying
 * with pagination. No database — state lives for the process lifetime.
 */

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

class TicketStore {
  constructor() {
    /** @type {Map<string, object>} */
    this._tickets = new Map();
  }

  /** Insert a ticket. Returns the stored ticket. */
  create(ticket) {
    this._tickets.set(ticket.id, ticket);
    return ticket;
  }

  /** Look up a ticket by id, or undefined. */
  get(id) {
    return this._tickets.get(id);
  }

  /** Replace a stored ticket (used after applyUpdate). */
  update(ticket) {
    if (!this._tickets.has(ticket.id)) return undefined;
    this._tickets.set(ticket.id, ticket);
    return ticket;
  }

  /** Remove a ticket by id. Returns true if it existed. */
  remove(id) {
    return this._tickets.delete(id);
  }

  /** All tickets as an array (insertion order). */
  all() {
    return [...this._tickets.values()];
  }

  /** Number of stored tickets. */
  size() {
    return this._tickets.size;
  }

  /** Drop every ticket — used by tests for isolation. */
  clear() {
    this._tickets.clear();
  }

  /**
   * Query tickets with optional filters and pagination.
   * Supported filters: category, priority, status, customer_id, assigned_to,
   * source, tag, created_from, created_to, search, page, limit.
   * @param {object} [filters]
   * @returns {{tickets: object[], total: number, page: number, limit: number, pages: number}}
   */
  query(filters = {}) {
    let results = this.all();

    const equals = (key, prop) => {
      if (filters[key] !== undefined && filters[key] !== '') {
        results = results.filter((t) => t[prop] === filters[key]);
      }
    };

    equals('category', 'category');
    equals('priority', 'priority');
    equals('status', 'status');
    equals('customer_id', 'customer_id');
    equals('assigned_to', 'assigned_to');

    if (filters.source) {
      results = results.filter((t) => t.metadata.source === filters.source);
    }

    if (filters.tag) {
      results = results.filter((t) => t.tags.includes(filters.tag));
    }

    if (filters.created_from) {
      const from = new Date(filters.created_from).getTime();
      if (!Number.isNaN(from)) {
        results = results.filter(
          (t) => new Date(t.created_at).getTime() >= from,
        );
      }
    }

    if (filters.created_to) {
      const to = new Date(filters.created_to).getTime();
      if (!Number.isNaN(to)) {
        results = results.filter((t) => new Date(t.created_at).getTime() <= to);
      }
    }

    if (filters.search) {
      const needle = String(filters.search).toLowerCase();
      results = results.filter(
        (t) =>
          t.subject.toLowerCase().includes(needle) ||
          t.description.toLowerCase().includes(needle),
      );
    }

    const total = results.length;
    const limit = clampLimit(filters.limit);
    const page = clampPage(filters.page);
    const start = (page - 1) * limit;
    const tickets = results.slice(start, start + limit);

    return {
      tickets,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}

/** Coerce a limit query param into [1, MAX_LIMIT], defaulting sensibly. */
function clampLimit(raw) {
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 1) return DEFAULT_LIMIT;
  return Math.min(value, MAX_LIMIT);
}

/** Coerce a page query param into [1, ∞), defaulting to 1. */
function clampPage(raw) {
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 1) return 1;
  return value;
}

// A single shared store instance backs the running app.
const store = new TicketStore();

module.exports = { TicketStore, store, DEFAULT_LIMIT, MAX_LIMIT };
