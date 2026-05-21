'use strict';

/** Express error-handling middleware: a 404 fallback and a central
 * error handler that maps thrown errors onto clean JSON responses. */

/** 404 handler for unmatched routes. */
function notFound(req, res, _next) {
  res.status(404).json({
    error: 'Not found',
    message: `No route for ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Central error handler. Honors an `err.status` (e.g. ImportError → 400,
 * malformed JSON body → 400) and falls back to 500 for anything unexpected.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  let error = 'Internal server error';
  if (err.name === 'ImportError') error = 'Import failed';
  else if (err.type === 'entity.parse.failed') error = 'Malformed JSON body';
  else if (status === 400) error = 'Bad request';
  else if (status === 404) error = 'Not found';

  if (status >= 500) console.error('[error]', err);

  res.status(status).json({ error, message: err.message });
}

module.exports = { notFound, errorHandler };
