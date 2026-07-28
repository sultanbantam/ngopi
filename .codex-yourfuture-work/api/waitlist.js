const { method, readJson, send } = require('./_lib/http');
const db = require('./_lib/supabase');
const { sendLifecycleEmail } = require('./_lib/email');

function referralCode(email) {
  return 'YF' + Buffer.from(String(email).toLowerCase()).toString('base64url').slice(0, 8).toUpperCase();
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'invalid_email' });
    const code = referralCode(email);
    let row = { email, referral_code: body.referral_code || code };
    if (db.isConfigured()) {
      const inserted = await db.insert('waitlist', [row], { prefer: 'resolution=merge-duplicates,return=representation' });
      row = inserted?.[0] || row;
    }
    await sendLifecycleEmail({ to: email, subject: 'Mulai Buat BMC Pertamamu', html: '<p>Terima kasih sudah bergabung di YourFuture. Link referral kamu: https://www.yourfuture.fun/?ref=' + encodeURIComponent(row.referral_code || code) + '</p>' });
    return send(res, 200, { ok: true, entry: row, share_url: 'https://www.yourfuture.fun/?ref=' + encodeURIComponent(row.referral_code || code) });
  } catch (error) {
    return send(res, error.statusCode || 500, { error: error.message || 'waitlist_failed' });
  }
};
