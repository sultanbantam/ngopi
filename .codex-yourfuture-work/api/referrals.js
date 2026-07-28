const { method, readJson, send } = require('./_lib/http');
const db = require('./_lib/supabase');

function makeCode(seed) { return ('YF' + String(seed || Math.random()).replace(/[^a-z0-9]/gi, '').slice(0, 10)).toUpperCase(); }

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try {
    const body = req.method === 'POST' ? await readJson(req) : {};
    const url = new URL(req.url, 'https://www.yourfuture.fun');
    const userId = body.user_id || url.searchParams.get('user_id') || 'anonymous';
    const email = body.email || url.searchParams.get('email') || '';
    const code = body.referral_code || makeCode(userId + email);
    let stats = { pending: 0, converted: 0, reward_amount: 0 };
    if (db.isConfigured() && userId !== 'anonymous') {
      const rows = await db.select('referrals', 'referrer_id=eq.' + encodeURIComponent(userId));
      stats = rows.reduce((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        if (row.status === 'converted') acc.reward_amount += Number(row.reward_amount || 0);
        return acc;
      }, stats);
    }
    return send(res, 200, { ok: true, referral_code: code, share_url: 'https://www.yourfuture.fun/?ref=' + encodeURIComponent(code), stats });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'referral_failed' });
  }
};
