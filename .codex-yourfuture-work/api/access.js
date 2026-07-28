const { method, readJson, send } = require('./_lib/http');
const { getAccess } = require('./_lib/plans');
const db = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try {
    const body = req.method === 'POST' ? await readJson(req) : {};
    const url = new URL(req.url, 'https://www.yourfuture.fun');
    const userId = body.user_id || url.searchParams.get('user_id');
    let subscription = null;
    if (db.isConfigured() && userId) {
      const rows = await db.select('subscriptions', 'user_id=eq.' + encodeURIComponent(userId) + '&status=in.(active,trial)&order=created_at.desc&limit=1');
      subscription = rows && rows[0] ? rows[0] : null;
    }
    const planType = subscription?.plan_type || body.plan_type || 'free';
    return send(res, 200, { ok: true, plan_type: planType, subscription, access: getAccess(planType) });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'access_failed', access: getAccess('free'), plan_type: 'free' });
  }
};
