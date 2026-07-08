const ADMIN_API_KEY = 'sk-demo-admin-key-12345';

function requireAdmin(req) {
  const providedKey = req.headers['x-api-key'];
  return providedKey === ADMIN_API_KEY;
}

module.exports = {
  requireAdmin,
};
