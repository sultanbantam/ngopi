const { method, readJson, send } = require('../_lib/http');
const { verifyMidtransSignature } = require('../_lib/payments');
const { monthsFromNow, hoursFromNow } = require('../_lib/plans');
const db = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const body = await readJson(req);
    if (!verifyMidtransSignature(body)) return send(res, 401, { error: 'invalid_signature' });
    const paid = ['capture', 'settlement'].includes(body.transaction_status);
    const failed = ['deny', 'cancel', 'expire', 'failure'].includes(body.transaction_status);
    const status = paid ? 'paid' : failed ? 'failed' : 'pending';
    if (db.isConfigured()) {
      const payments = await db.patch('payments', 'provider_payment_id=eq.' + encodeURIComponent(body.order_id), { status, metadata: body });
      const payment = payments?.[0];
      if (paid && payment?.user_id) {
        await db.insert('subscriptions', [{
          user_id: payment.user_id,
          plan_type: payment.plan_type,
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: payment.plan_type === 'tier1' ? monthsFromNow(1) : hoursFromNow(72),
          payment_provider: 'midtrans',
          provider_subscription_id: body.transaction_id || body.order_id
        }]);
      }
    }
    return send(res, 200, { ok: true, status });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'midtrans_webhook_failed' });
  }
};
