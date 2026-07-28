async function sendLifecycleEmail({ to, subject, html }) {
  if (!to) return { skipped: 'missing_recipient' };
  if (process.env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || 'YourFuture <hello@yourfuture.fun>', to, subject, html })
    });
    return response.json().catch(() => ({}));
  }
  if (process.env.BREVO_API_KEY) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { email: process.env.EMAIL_FROM_ADDRESS || 'hello@yourfuture.fun', name: 'YourFuture' }, to: [{ email: to }], subject, htmlContent: html })
    });
    return response.json().catch(() => ({}));
  }
  return { skipped: 'email_not_configured' };
}

module.exports = { sendLifecycleEmail };
