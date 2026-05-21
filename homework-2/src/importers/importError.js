'use strict';

/**
 * Raised when an import file cannot be parsed (malformed content, wrong
 * shape, unsupported format). Carries an HTTP-friendly 400 status so the
 * route layer can surface it without crashing.
 */
class ImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportError';
    this.status = 400;
  }
}

module.exports = { ImportError };
