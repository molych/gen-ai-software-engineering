'use strict';

/** CSV ticket importer. Tags use a ';'-separated cell; metadata uses
 * `metadata_*` columns. Empty optional cells become undefined so model
 * defaults apply. */

const { parse } = require('csv-parse/sync');
const { ImportError } = require('./importError');

const OPTIONAL_FIELDS = ['category', 'priority', 'status', 'assigned_to'];

/** Empty string → undefined; otherwise the trimmed value. */
function blankToUndefined(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Convert one parsed CSV row into a canonical ticket-input object. */
function normalizeRow(row) {
  const record = {
    customer_id: row.customer_id,
    customer_email: row.customer_email,
    customer_name: row.customer_name,
    subject: row.subject,
    description: row.description,
  };

  for (const field of OPTIONAL_FIELDS) {
    const value = blankToUndefined(row[field]);
    if (value !== undefined) record[field] = value;
  }

  if (row.tags !== undefined && String(row.tags).trim() !== '') {
    record.tags = String(row.tags)
      .split(';')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const metadata = {};
  if (blankToUndefined(row.metadata_source)) {
    metadata.source = blankToUndefined(row.metadata_source);
  }
  if (blankToUndefined(row.metadata_browser)) {
    metadata.browser = blankToUndefined(row.metadata_browser);
  }
  if (blankToUndefined(row.metadata_device_type)) {
    metadata.device_type = blankToUndefined(row.metadata_device_type);
  }
  if (Object.keys(metadata).length > 0) record.metadata = metadata;

  return record;
}

/**
 * Parse CSV content into canonical ticket-input records.
 * @param {string} content raw CSV text
 * @returns {object[]}
 * @throws {ImportError} on malformed CSV
 */
function parseCsv(content) {
  let rows;
  try {
    rows = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch (err) {
    throw new ImportError(`Malformed CSV: ${err.message}`);
  }
  if (rows.length === 0) {
    throw new ImportError('CSV file contains no data rows.');
  }
  return rows.map(normalizeRow);
}

module.exports = { parseCsv, normalizeRow };
