function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.PUBLIC_SITE_ORIGIN || 'https://www.yourfuture.fun');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature, X-Admin-Key');
}

function send(res, status, body) {
  setCors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const raw = await readRaw(req);
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { const error = new Error('invalid_json'); error.statusCode = 400; throw error; }
}

function readRaw(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function method(req, res, allowed) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return false; }
  if (!allowed.includes(req.method)) { send(res, 405, { error: 'method_not_allowed' }); return false; }
  return true;
}

module.exports = { method, readJson, readRaw, send, setCors };
