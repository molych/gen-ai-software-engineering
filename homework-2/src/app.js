'use strict';

/**
 * Express application factory. Exports a configured app (without calling
 * listen) so tests can drive it with supertest; src/server.js does the
 * actual listening.
 */

const express = require('express');
const ticketsRouter = require('./routes/tickets');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(express.json({ limit: '5mb' }));

  // Liveness probe.
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'customer-support-system' });
  });

  app.use('/tickets', ticketsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
