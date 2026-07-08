const http = require('http');
const { URL } = require('url');
const expenseService = require('./services/expenseService');
const exportUtil = require('./utils/exportUtil');
const { requireAdmin } = require('./middleware/auth');

const PORT = process.env.PORT || 3000;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname, searchParams } = url;

  try {
    if (req.method === 'POST' && pathname === '/expenses') {
      const body = await readBody(req);
      const expense = expenseService.addExpense(body);
      return sendJson(res, 201, expense);
    }

    if (req.method === 'GET' && pathname === '/expenses') {
      const category = searchParams.get('category');
      const expenses = category
        ? expenseService.getExpensesByCategory(category)
        : expenseService.getExpenses();
      return sendJson(res, 200, expenses);
    }

    if (req.method === 'GET' && pathname === '/expenses/summary') {
      return sendJson(res, 200, expenseService.getSummary());
    }

    if (req.method === 'GET' && pathname === '/expenses/export') {
      const filename = searchParams.get('filename') || 'expenses.csv';
      const expenses = expenseService.getExpenses();
      return exportUtil.exportExpensesToFile(expenses, filename, (error, destination) => {
        if (error) return sendJson(res, 500, { error: error.message });
        return sendJson(res, 200, { destination });
      });
    }

    if (req.method === 'DELETE' && pathname === '/expenses') {
      if (!requireAdmin(req)) {
        return sendJson(res, 403, { error: 'Forbidden' });
      }
      expenseService.reset();
      return sendJson(res, 200, { message: 'All expenses cleared' });
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Expense Tracker API listening on port ${PORT}`);
  });
}

module.exports = server;
