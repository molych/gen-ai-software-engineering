'use strict';

/** JSON ticket importer. Accepts either a bare array of tickets or an
 * object of the form `{ "tickets": [...] }`. */

const { ImportError } = require('./importError');

/**
 * Parse JSON content into canonical ticket-input records.
 * @param {string} content raw JSON text
 * @returns {object[]}
 * @throws {ImportError} on malformed JSON or an unexpected shape
 */
function parseJson(content) {
  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    throw new ImportError(`Malformed JSON: ${err.message}`);
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      throw new ImportError('JSON file contains an empty ticket array.');
    }
    return data;
  }

  if (data && typeof data === 'object' && Array.isArray(data.tickets)) {
    if (data.tickets.length === 0) {
      throw new ImportError('JSON file contains an empty ticket array.');
    }
    return data.tickets;
  }

  throw new ImportError(
    'JSON import expects an array of tickets or an object with a "tickets" array.',
  );
}

module.exports = { parseJson };
