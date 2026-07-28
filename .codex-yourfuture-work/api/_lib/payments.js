const crypto = require('crypto');
const { getPlan } = require('./plans');

function siteUrl() { return (process.env.PUBLIC_SITE_URL || 'https://www.yourfuture.fun').replace(/\/+$/, ''); }
function isMidtransProd() { return String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true'; }
function midtransBase() { return isMidtransProd() ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com'; }

async function createMidtransCheckout({ orderId, planType, email, userId, referralCode }) {
  const plan = getPlan(planType);
  if (!process.env.MIDTRANS_SERVER_KEY) {
    const error = new Error('midtrans_not_configured'); error.statusCode = 503; throw error;
  }
  const auth = Buffer.from(process.env.MIDTRANS_SERVER_KEY + ':').toString('base64');
  const body = {
    transaction_details: { order_id: orderId, gross_amount: plan.amount },
    customer_details: { email: email || undefined },
    item_details: [{ id: plan.id, price: plan.amount, quantity: 1, name: plan.label }],
    credit_card: { secure: true },
    callbacks: {
      finish: siteUrl() + '/?checkout=success&plan=' + encodeURIComponent(plan.id),
      error: siteUrl() + '/?checkout=failed&plan=' + encodeURIComponent(plan.id),
      pending: siteUrl() + '/?checkout=pending&plan=' + encodeURIComponent(plan.id)
    },
    custom_field1: userId || 'anonymous',
    custom_field2: planType,
    custom_field3: referralCode || ''
  };
  const response = await fetch(midtransBase() + '/snap/v1/transactions', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error_messages?.join(', ') || 'midtrans_checkout_failed');
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }
  return { provider: 'midtrans', provider_payment_id: orderId, checkout_url: data.redirect_url, token: data.token };
}

async function createStripeCheckout({ orderId, planType, email, userId, referralCode }) {
  const plan = getPlan(planType);
  if (!process.env.STRIPE_SECRET_KEY) {
    const error = new Error('stripe_not_configured'); error.statusCode = 503; throw error;
  }
  const params = new URLSearchParams();
  params.set('mode', plan.mode === 'subscription' ? 'subscription' : 'payment');
  params.set('success_url', siteUrl() + '/?checkout=success&plan=' + encodeURIComponent(plan.id) + '&session_id={CHECKOUT_SESSION_ID}');
  params.set('cancel_url', siteUrl() + '/?checkout=cancelled&plan=' + encodeURIComponent(plan.id));
  params.set('client_reference_id', userId || 'anonymous');
  if (email) params.set('customer_email', email);
  params.set('metadata[order_id]', orderId);
  params.set('metadata[user_id]', userId || 'anonymous');
  params.set('metadata[plan_type]', planType);
  if (referralCode) params.set('metadata[referral_code]', referralCode);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', (planType === 'output' ? 'usd' : 'idr'));
  params.set('line_items[0][price_data][product_data][name]', plan.label);
  const amount = planType === 'output' ? 700 : plan.amount;
  params.set('line_items[0][price_data][unit_amount]', String(amount * 100));
  if (plan.mode === 'subscription') params.set('line_items[0][price_data][recurring][interval]', plan.interval || 'month');

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'stripe_checkout_failed');
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }
  return { provider: 'stripe', provider_payment_id: data.id, checkout_url: data.url };
}

function verifyMidtransSignature(body) {
  if (!process.env.MIDTRANS_SERVER_KEY) return false;
  const raw = String(body.order_id || '') + String(body.status_code || '') + String(body.gross_amount || '') + process.env.MIDTRANS_SERVER_KEY;
  const expected = crypto.createHash('sha512').update(raw).digest('hex');
  return expected === body.signature_key;
}

function verifyStripeSignature(rawBody, signatureHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(',').map((part) => part.split('=')));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(timestamp + '.' + rawBody).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); }
  catch { return false; }
}

module.exports = { createMidtransCheckout, createStripeCheckout, verifyMidtransSignature, verifyStripeSignature };
