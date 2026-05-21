'use strict';

/**
 * Multi-format import dispatcher. Parses CSV / JSON / XML content, validates
 * each record, builds tickets for the valid ones, and returns a bulk summary
 * (TASKS.md Task 1).
 */

const { parseCsv } = require('./csv');
const { parseJson } = require('./json');
const { parseXml } = require('./xml');
const { ImportError } = require('./importError');
const { validateTicketInput } = require('../validation/validator');
const { createTicket } = require('../models/ticket');

const PARSERS = { csv: parseCsv, json: parseJson, xml: parseXml };
const SUPPORTED_FORMATS = Object.keys(PARSERS);

/**
 * Guess the import format from a filename extension.
 * @param {string} filename
 * @returns {string|null} one of SUPPORTED_FORMATS, or null
 */
function detectFormat(filename = '') {
  const ext = String(filename).toLowerCase().split('.').pop();
  return SUPPORTED_FORMATS.includes(ext) ? ext : null;
}

/**
 * Parse, validate, and build tickets from raw file content.
 * @param {string} content raw file text
 * @param {string} format 'csv' | 'json' | 'xml'
 * @returns {{format: string, total: number, successful: number, failed: number,
 *   errors: Array<{index: number, errors: object[]}>, tickets: object[]}}
 * @throws {ImportError} when the format is unsupported or the file is malformed
 */
function importTickets(content, format) {
  const fmt = String(format || '').toLowerCase();
  if (!SUPPORTED_FORMATS.includes(fmt)) {
    throw new ImportError(
      `Unsupported import format "${format}". Use one of: ${SUPPORTED_FORMATS.join(', ')}.`,
    );
  }
  if (typeof content !== 'string' || content.trim() === '') {
    throw new ImportError('Import content is empty.');
  }

  // Parser throws ImportError on malformed input — handled gracefully upstream.
  const records = PARSERS[fmt](content);

  const summary = {
    format: fmt,
    total: records.length,
    successful: 0,
    failed: 0,
    errors: [],
    tickets: [],
  };

  records.forEach((record, index) => {
    const errors = validateTicketInput(record);
    if (errors.length > 0) {
      summary.failed += 1;
      summary.errors.push({ index, errors });
    } else {
      summary.tickets.push(createTicket(record));
      summary.successful += 1;
    }
  });

  return summary;
}

module.exports = {
  importTickets,
  detectFormat,
  SUPPORTED_FORMATS,
  ImportError,
};
