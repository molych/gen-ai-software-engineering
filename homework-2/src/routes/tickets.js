'use strict';

/**
 * Ticket REST endpoints (TASKS.md Tasks 1 & 2).
 *
 *   POST   /tickets                   create a ticket (?autoClassify=true)
 *   POST   /tickets/import            bulk import CSV / JSON / XML
 *   GET    /tickets                   list with filtering + pagination
 *   GET    /tickets/:id               fetch one ticket
 *   PUT    /tickets/:id               update a ticket
 *   DELETE /tickets/:id               delete a ticket
 *   POST   /tickets/:id/auto-classify classify (or manually override)
 */

const express = require('express');
const { store } = require('../store');
const { createTicket, applyUpdate } = require('../models/ticket');
const { validateTicketInput, validateField } = require('../validation/validator');
const { classify } = require('../classification/classifier');
const { logDecision } = require('../logger');
const { importTickets, detectFormat } = require('../importers');

const router = express.Router();

/** True when the request asks for auto-classification on write. */
function wantsAutoClassify(req) {
  return (
    req.query.autoClassify === 'true' ||
    req.query.auto_classify === 'true' ||
    (req.body && req.body.autoClassify === true)
  );
}

/** Stamp a classification result onto a ticket, returning the updated ticket. */
function applyClassification(ticket, result, method) {
  const updated = applyUpdate(ticket, {
    category: result.category,
    priority: result.priority,
  });
  updated.classification = {
    method,
    confidence: result.confidence ?? null,
    reasoning: result.reasoning,
    keywords: result.keywords || [],
    classified_at: new Date().toISOString(),
  };
  return updated;
}

/** Send the standard validation-failure response. */
function sendValidationError(res, details) {
  return res.status(400).json({ error: 'Validation failed', details });
}

/** Send the standard 404 response for a missing ticket. */
function sendNotFound(res, id) {
  return res
    .status(404)
    .json({ error: 'Not found', message: `Ticket ${id} does not exist` });
}

// POST /tickets — create a single ticket.
router.post('/', (req, res) => {
  const errors = validateTicketInput(req.body || {});
  if (errors.length > 0) return sendValidationError(res, errors);

  let ticket = createTicket(req.body);
  if (wantsAutoClassify(req)) {
    const result = classify(ticket.subject, ticket.description);
    ticket = applyClassification(ticket, result, 'auto');
    logDecision({
      ticket_id: ticket.id,
      method: 'auto',
      category: result.category,
      priority: result.priority,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });
  }
  store.create(ticket);
  return res.status(201).json(ticket);
});

// POST /tickets/import — bulk import from CSV / JSON / XML.
router.post('/import', (req, res, next) => {
  try {
    const body = req.body || {};
    const format = body.format || detectFormat(body.filename || '');
    const raw =
      typeof body.content === 'string' ? body.content : JSON.stringify(body.content);

    const summary = importTickets(raw, format);
    const autoClassify = wantsAutoClassify(req);
    const imported = [];

    for (let ticket of summary.tickets) {
      if (autoClassify) {
        const result = classify(ticket.subject, ticket.description);
        ticket = applyClassification(ticket, result, 'auto');
        logDecision({
          ticket_id: ticket.id,
          method: 'auto',
          category: result.category,
          priority: result.priority,
          confidence: result.confidence,
          reasoning: result.reasoning,
        });
      }
      store.create(ticket);
      imported.push(ticket.id);
    }

    return res.status(201).json({
      format: summary.format,
      total: summary.total,
      successful: summary.successful,
      failed: summary.failed,
      errors: summary.errors,
      auto_classified: autoClassify,
      imported,
    });
  } catch (err) {
    return next(err); // ImportError → 400 via errorHandler
  }
});

// GET /tickets — list with filtering + pagination.
router.get('/', (req, res) => {
  const result = store.query(req.query);
  return res.status(200).json({
    tickets: result.tickets,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.pages,
    },
  });
});

// GET /tickets/:id — fetch one ticket.
router.get('/:id', (req, res) => {
  const ticket = store.get(req.params.id);
  if (!ticket) return sendNotFound(res, req.params.id);
  return res.status(200).json(ticket);
});

// PUT /tickets/:id — update a ticket.
router.put('/:id', (req, res) => {
  const ticket = store.get(req.params.id);
  if (!ticket) return sendNotFound(res, req.params.id);

  const errors = validateTicketInput(req.body || {}, { partial: true });
  if (errors.length > 0) return sendValidationError(res, errors);

  const updated = applyUpdate(ticket, req.body);
  store.update(updated);
  return res.status(200).json(updated);
});

// DELETE /tickets/:id — delete a ticket.
router.delete('/:id', (req, res) => {
  const removed = store.remove(req.params.id);
  if (!removed) return sendNotFound(res, req.params.id);
  return res.status(204).send();
});

// POST /tickets/:id/auto-classify — classify, or apply a manual override.
router.post('/:id/auto-classify', (req, res) => {
  const ticket = store.get(req.params.id);
  if (!ticket) return sendNotFound(res, req.params.id);

  const body = req.body || {};
  const isManual = body.category !== undefined || body.priority !== undefined;
  let result;
  let method;

  if (isManual) {
    const overrideErrors = [];
    if (body.category !== undefined) {
      const e = validateField('category', body.category);
      if (e) overrideErrors.push(e);
    }
    if (body.priority !== undefined) {
      const e = validateField('priority', body.priority);
      if (e) overrideErrors.push(e);
    }
    if (overrideErrors.length > 0) return sendValidationError(res, overrideErrors);

    method = 'manual';
    result = {
      category: body.category ?? ticket.category,
      priority: body.priority ?? ticket.priority,
      confidence: 1,
      reasoning: 'Manual override applied by an operator.',
      keywords: [],
    };
  } else {
    method = 'auto';
    result = classify(ticket.subject, ticket.description);
  }

  const updated = applyClassification(ticket, result, method);
  store.update(updated);
  logDecision({
    ticket_id: updated.id,
    method,
    category: result.category,
    priority: result.priority,
    confidence: result.confidence,
    reasoning: result.reasoning,
  });

  return res.status(200).json({
    ticket_id: updated.id,
    method,
    classification: result,
    ticket: updated,
  });
});

module.exports = router;
