const PLANS = {
  free: { id: 'free', label: 'Free', amount: 0, currency: 'IDR', mode: 'free', interval: null },
  tier1: { id: 'tier1', label: 'Tier 1 Monthly', amount: 50000, currency: 'IDR', mode: 'subscription', interval: 'month' },
  output: { id: 'output', label: 'Output Download', amount: 30000, currency: 'IDR', mode: 'payment', interval: null },
  premium: { id: 'premium', label: 'Premium Consultation', amount: 500000, currency: 'IDR', mode: 'payment', interval: null }
};

const FEATURE_ACCESS = {
  free: { bmc_blocks: 2, export: false, save_canvas: false, ai_chat: false, live_consult: false },
  tier1: { bmc_blocks: 9, export: true, save_canvas: true, ai_chat: true, live_consult: false },
  output: { bmc_blocks: 9, export: true, save_canvas: false, ai_chat: false, live_consult: false },
  premium: { bmc_blocks: 9, export: true, save_canvas: true, ai_chat: true, live_consult: true }
};

function getPlan(planType) { return PLANS[planType] || null; }
function getAccess(planType) { return FEATURE_ACCESS[planType] || FEATURE_ACCESS.free; }
function canAccessFeature(planType, feature) { return Boolean(getAccess(planType)[feature]); }
function monthsFromNow(months) { const date = new Date(); date.setMonth(date.getMonth() + months); return date.toISOString(); }
function hoursFromNow(hours) { return new Date(Date.now() + hours * 3600000).toISOString(); }

module.exports = { PLANS, FEATURE_ACCESS, getPlan, getAccess, canAccessFeature, monthsFromNow, hoursFromNow };
