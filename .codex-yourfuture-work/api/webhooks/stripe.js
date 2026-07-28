const { method, readRaw, send } = require('../_lib/http');
const { verifyStripeSignature } = require('../_lib/payments');
const { monthsFromNow, hoursFromNow } = require('../_lib/plans');
const db = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const raw = await readRaw(req);
    if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) return send(res, 401, { error: 'invalid_signature' });
    const event = JSON.parse(raw);
    const object = event.data?.object || {};
    if (event.type === 'checkout.session.completed') {
      const meta = object.metadata || {};
      if (db.isConfigured()) {
        await db.patch('payments', 'provider_payment_id=eq.' + encodeURIComponent(object.id), { status: 'paid', metadata: object });
        if (meta.user_id && meta.user_id !== 'anonymous') {
          await db.insert('subscriptions', [{
            user_id: meta.user_id,
            plan_type: meta.plan_type || 'output',
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: meta.plan_type === 'tier1' ? monthsFromNow(1) : hoursFromNow(72),
            payment_provider: 'stripe',
            provider_subscription_id: object.subscription || object.payment_intent || object.id
          }]);
        }
      }
    }
    if (event.type === 'invoice.payment_failed' && db.isConfigured()) {
      await db.patch('payments', 'provider_payment_id=eq.' + encodeURIComponent(object.id), { status: 'failed', metadata: object });
    }
    return send(res, 200, { received: true });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'stripe_webhook_failed' });
  }
};
