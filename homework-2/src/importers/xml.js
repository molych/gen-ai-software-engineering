'use strict';

/** XML ticket importer. Expects `<tickets><ticket>…</ticket></tickets>`,
 * with `<tags><tag>…</tag></tags>` and a nested `<metadata>` element. */

const { XMLParser, XMLValidator } = require('fast-xml-parser');
const { ImportError } = require('./importError');

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // keep every value a string for predictable validation
  trimValues: true,
});

/** Empty/whitespace string → undefined; otherwise the value. */
function blankToUndefined(value) {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  return str === '' ? undefined : str;
}

/** Normalize the `<tags>` element into a string array. */
function normalizeTags(tagsNode) {
  if (!tagsNode || typeof tagsNode !== 'object') return [];
  const tag = tagsNode.tag;
  if (tag === undefined || tag === null) return [];
  const list = Array.isArray(tag) ? tag : [tag];
  return list.map((t) => String(t).trim()).filter(Boolean);
}

/** Convert one parsed `<ticket>` node into a canonical ticket-input object. */
function normalizeTicket(node) {
  const record = {
    customer_id: node.customer_id,
    customer_email: node.customer_email,
    customer_name: node.customer_name,
    subject: node.subject,
    description: node.description,
  };

  for (const field of ['category', 'priority', 'status', 'assigned_to']) {
    const value = blankToUndefined(node[field]);
    if (value !== undefined) record[field] = value;
  }

  if (node.tags !== undefined) record.tags = normalizeTags(node.tags);

  if (node.metadata && typeof node.metadata === 'object') {
    const metadata = {};
    for (const key of ['source', 'browser', 'device_type']) {
      const value = blankToUndefined(node.metadata[key]);
      if (value !== undefined) metadata[key] = value;
    }
    if (Object.keys(metadata).length > 0) record.metadata = metadata;
  }

  return record;
}

/**
 * Parse XML content into canonical ticket-input records.
 * @param {string} content raw XML text
 * @returns {object[]}
 * @throws {ImportError} on malformed XML or an unexpected shape
 */
function parseXml(content) {
  // XMLParser is lenient; validate well-formedness first so unclosed/
  // mismatched tags are rejected instead of silently mis-parsed.
  const valid = XMLValidator.validate(content);
  if (valid !== true) {
    const detail = valid && valid.err ? valid.err.msg : 'invalid XML document';
    throw new ImportError(`Malformed XML: ${detail}`);
  }

  let doc;
  try {
    doc = parser.parse(content);
  } catch (err) {
    throw new ImportError(`Malformed XML: ${err.message}`);
  }

  const ticketsNode = doc && doc.tickets ? doc.tickets.ticket : undefined;
  if (ticketsNode === undefined) {
    throw new ImportError(
      'XML import expects a <tickets> root containing <ticket> elements.',
    );
  }

  const nodes = Array.isArray(ticketsNode) ? ticketsNode : [ticketsNode];
  if (nodes.length === 0) {
    throw new ImportError('XML file contains no <ticket> elements.');
  }
  return nodes.map(normalizeTicket);
}

module.exports = { parseXml, normalizeTicket, normalizeTags };
