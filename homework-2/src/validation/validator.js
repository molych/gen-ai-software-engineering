'use strict';

/**
 * Ticket field validation. Every validator returns a list of
 * { field, message } errors — an empty list means the input is valid.
 */

const {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  SOURCES,
  DEVICE_TYPES,
  SUBJECT_MIN,
  SUBJECT_MAX,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
} = require('../models/ticket');

// Pragmatic RFC-5322-ish email check — good enough for ticket intake.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Required, non-empty string fields on a ticket. */
const REQUIRED_STRING_FIELDS = [
  'customer_id',
  'customer_email',
  'customer_name',
  'subject',
  'description',
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value);
}

/** Validate a single field; returns an error object or null. */
function validateField(field, value) {
  switch (field) {
    case 'customer_email':
      return isValidEmail(value)
        ? null
        : { field, message: 'customer_email must be a valid email address' };
    case 'subject':
      if (!isNonEmptyString(value)) {
        return { field, message: 'subject is required' };
      }
      return value.length >= SUBJECT_MIN && value.length <= SUBJECT_MAX
        ? null
        : {
            field,
            message: `subject must be ${SUBJECT_MIN}-${SUBJECT_MAX} characters`,
          };
    case 'description':
      if (!isNonEmptyString(value)) {
        return { field, message: 'description is required' };
      }
      return value.length >= DESCRIPTION_MIN && value.length <= DESCRIPTION_MAX
        ? null
        : {
            field,
            message: `description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters`,
          };
    case 'category':
      return CATEGORIES.includes(value)
        ? null
        : { field, message: `category must be one of: ${CATEGORIES.join(', ')}` };
    case 'priority':
      return PRIORITIES.includes(value)
        ? null
        : { field, message: `priority must be one of: ${PRIORITIES.join(', ')}` };
    case 'status':
      return STATUSES.includes(value)
        ? null
        : { field, message: `status must be one of: ${STATUSES.join(', ')}` };
    case 'tags':
      return Array.isArray(value)
        ? null
        : { field, message: 'tags must be an array' };
    default:
      return isNonEmptyString(value)
        ? null
        : { field, message: `${field} is required` };
  }
}

/** Validate the optional metadata sub-object. */
function validateMetadata(metadata) {
  const errors = [];
  if (metadata === undefined || metadata === null) return errors;
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    return [{ field: 'metadata', message: 'metadata must be an object' }];
  }
  if (metadata.source !== undefined && !SOURCES.includes(metadata.source)) {
    errors.push({
      field: 'metadata.source',
      message: `source must be one of: ${SOURCES.join(', ')}`,
    });
  }
  if (
    metadata.device_type !== undefined &&
    !DEVICE_TYPES.includes(metadata.device_type)
  ) {
    errors.push({
      field: 'metadata.device_type',
      message: `device_type must be one of: ${DEVICE_TYPES.join(', ')}`,
    });
  }
  return errors;
}

/**
 * Validate raw ticket input.
 * @param {object} input the raw fields
 * @param {{ partial?: boolean }} [options] partial=true skips required-field
 *   checks for absent fields (used by PUT updates)
 * @returns {Array<{field: string, message: string}>} validation errors
 */
function validateTicketInput(input, options = {}) {
  const partial = options.partial === true;
  const errors = [];

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return [{ field: 'body', message: 'request body must be a JSON object' }];
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    const present = input[field] !== undefined && input[field] !== null;
    if (!present) {
      if (!partial) errors.push({ field, message: `${field} is required` });
      continue;
    }
    const error = validateField(field, input[field]);
    if (error) errors.push(error);
  }

  for (const field of ['category', 'priority', 'status', 'tags']) {
    if (input[field] === undefined || input[field] === null) continue;
    const error = validateField(field, input[field]);
    if (error) errors.push(error);
  }

  errors.push(...validateMetadata(input.metadata));
  return errors;
}

module.exports = {
  EMAIL_RE,
  REQUIRED_STRING_FIELDS,
  isNonEmptyString,
  isValidEmail,
  validateField,
  validateMetadata,
  validateTicketInput,
};
