'use strict';

/**
 * Ticket model — enum definitions, defaults, and factory/update helpers.
 * Enums are closed sets; validation lives in src/validation/validator.js.
 */

const { v4: uuidv4 } = require('uuid');

const CATEGORIES = [
  'account_access',
  'technical_issue',
  'billing_question',
  'feature_request',
  'bug_report',
  'other',
];

const PRIORITIES = ['urgent', 'high', 'medium', 'low'];

const STATUSES = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed'];

const SOURCES = ['web_form', 'email', 'api', 'chat', 'phone'];

const DEVICE_TYPES = ['desktop', 'mobile', 'tablet'];

const SUBJECT_MIN = 1;
const SUBJECT_MAX = 200;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 2000;

const DEFAULTS = {
  category: 'other',
  priority: 'medium',
  status: 'new',
};

/** Build the metadata sub-object, applying defaults for missing keys. */
function buildMetadata(metadata = {}) {
  return {
    source: metadata.source || 'api',
    browser: metadata.browser || null,
    device_type: metadata.device_type || 'desktop',
  };
}

/**
 * Create a fully-formed ticket from raw input.
 * Assumes the input has already passed validation.
 * @param {object} input raw ticket fields
 * @returns {object} a new ticket
 */
function createTicket(input = {}) {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    customer_id: input.customer_id,
    customer_email: input.customer_email,
    customer_name: input.customer_name,
    subject: input.subject,
    description: input.description,
    category: input.category || DEFAULTS.category,
    priority: input.priority || DEFAULTS.priority,
    status: input.status || DEFAULTS.status,
    created_at: now,
    updated_at: now,
    resolved_at: null,
    assigned_to: input.assigned_to || null,
    tags: Array.isArray(input.tags) ? [...input.tags] : [],
    metadata: buildMetadata(input.metadata),
    classification: null,
  };
}

/** Fields a client is allowed to change through PUT /tickets/:id. */
const UPDATABLE_FIELDS = [
  'customer_id',
  'customer_email',
  'customer_name',
  'subject',
  'description',
  'category',
  'priority',
  'status',
  'assigned_to',
  'tags',
  'metadata',
];

/**
 * Apply a partial update to an existing ticket, returning a new object.
 * Refreshes updated_at, and stamps/clears resolved_at on status changes.
 * @param {object} ticket the existing ticket
 * @param {object} patch fields to change
 * @returns {object} the updated ticket
 */
function applyUpdate(ticket, patch = {}) {
  const updated = { ...ticket };
  for (const field of UPDATABLE_FIELDS) {
    if (patch[field] === undefined) continue;
    if (field === 'metadata') {
      updated.metadata = buildMetadata({ ...ticket.metadata, ...patch.metadata });
    } else if (field === 'tags') {
      updated.tags = Array.isArray(patch.tags) ? [...patch.tags] : ticket.tags;
    } else {
      updated[field] = patch[field];
    }
  }
  if (patch.status !== undefined && patch.status !== ticket.status) {
    updated.resolved_at =
      patch.status === 'resolved' || patch.status === 'closed'
        ? ticket.resolved_at || new Date().toISOString()
        : null;
  }
  updated.updated_at = new Date().toISOString();
  return updated;
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  SOURCES,
  DEVICE_TYPES,
  SUBJECT_MIN,
  SUBJECT_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
  DEFAULTS,
  UPDATABLE_FIELDS,
  createTicket,
  applyUpdate,
};
