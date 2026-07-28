const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isConfigured() { return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY); }

async function supabaseFetch(path, options = {}) {
  if (!isConfigured()) {
    const error = new Error('supabase_not_configured');
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(SUPABASE_URL + '/rest/v1' + path, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || 'supabase_error');
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function insert(table, rows, options = {}) {
  return supabaseFetch('/' + table, { method: 'POST', body: JSON.stringify(rows), prefer: options.prefer || 'return=representation' });
}

function select(table, query) {
  return supabaseFetch('/' + table + '?' + query, { method: 'GET', prefer: '' });
}

function patch(table, query, values) {
  return supabaseFetch('/' + table + '?' + query, { method: 'PATCH', body: JSON.stringify(values), prefer: 'return=representation' });
}

module.exports = { isConfigured, insert, select, patch, supabaseFetch };
