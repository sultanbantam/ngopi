const { method, readJson, send } = require('./_lib/http');
const { getAccess } = require('./_lib/plans');
const db = require('./_lib/supabase');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST'])) return;
  try {
    const body = req.method === 'POST' ? await readJson(req) : {};
    const userId = body.user_id || 'anonymous';
    const planType = body.plan_type || 'free';
    let billing = [];
    let admin = { waitlist: 0, paid: 0, pending: 0, mrr: 0, active_subscribers: 0 };
    if (db.isConfigured()) {
      if (userId !== 'anonymous') billing = await db.select('payments', 'user_id=eq.' + encodeURIComponent(userId) + '&order=created_at.desc&limit=12');
      const payments = await db.select('payments', 'select=status,amount,plan_type&limit=1000');
      admin = payments.reduce((acc, item) => {
        if (item.status === 'paid') { acc.paid += 1; if (item.plan_type === 'tier1') acc.mrr += Number(item.amount || 0); }
        if (item.status === 'pending') acc.pending += 1;
        return acc;
      }, admin);
      const subs = await db.select('subscriptions', 'select=status&status=in.(active,trial)&limit=1000');
      admin.active_subscribers = subs.length;
      const waitlist = await db.select('waitlist', 'select=id&limit=1000');
      admin.waitlist = waitlist.length;
    }
    return send(res, 200, { ok: true, plan_type: planType, access: getAccess(planType), billing, admin });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'dashboard_failed' });
  }
};
