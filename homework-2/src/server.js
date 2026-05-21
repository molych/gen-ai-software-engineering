'use strict';

/** Process entry point — start the HTTP server. */

const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Customer Support System API listening on http://localhost:${PORT}`);
});
