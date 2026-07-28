const { method, readJson, send } = require('./_lib/http');
const { getPlan, monthsFromNow, hoursFromNow } = require('./_lib/plans');
const db = require('./_lib/supabase');
const { createMidtransCheckout, createStripeCheckout } = require('./_lib/payments');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const body = await readJson(req);
    const plan = getPlan(body.plan_type);
    if (!plan || plan.id === 'free') return send(res, 400, { error: 'invalid_plan' });
    const provider = body.provider === 'stripe' ? 'stripe' : 'midtrans';
    const orderId = 'yf-' + plan.id + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const userId = body.user_id || null;
    const email = body.email || null;
    const referralCode = body.referral_code || null;

    if (db.isConfigured()) {
      await db.insert('payments', [{
        user_id: userId,
        amount: provider === 'stripe' && plan.id === 'output' ? 7 : plan.amount,
        currency: provider === 'stripe' && plan.id === 'output' ? 'USD' : plan.currency,
        plan_type: plan.id,
        status: 'pending',
        payment_provider: provider,
        provider_payment_id: orderId,
        metadata: { email, referral_code: referralCode, invoice: body.invoice || {}, source: 'checkout' }
      }]);
    }

    const checkout = provider === 'stripe'
      ? await createStripeCheckout({ orderId, planType: plan.id, email, userId, referralCode })
      : await createMidtransCheckout({ orderId, planType: plan.id, email, userId, referralCode });

    return send(res, 200, { ok: true, order_id: orderId, plan, checkout });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'checkout_failed', details: error.details || null });
  }
};
