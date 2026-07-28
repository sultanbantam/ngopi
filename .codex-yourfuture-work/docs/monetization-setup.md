# YourFuture Monetization & Marketing Engine

Implemented as Vercel Serverless API routes plus Supabase tables for subscriptions, payments, consultations, referrals, waitlist, and webhook events.

## Required Vercel Environment Variables

- PUBLIC_SITE_URL=https://www.yourfuture.fun
- PUBLIC_SITE_ORIGIN=https://www.yourfuture.fun
- SUPABASE_URL=your Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY=service role key, server only
- MIDTRANS_SERVER_KEY=Midtrans server key
- MIDTRANS_IS_PRODUCTION=false for sandbox, true for live
- STRIPE_SECRET_KEY=Stripe secret key
- STRIPE_WEBHOOK_SECRET=Stripe webhook signing secret
- RESEND_API_KEY or BREVO_API_KEY for lifecycle email
- EMAIL_FROM=YourFuture <hello@yourfuture.fun>

## Webhook URLs

- Midtrans: https://www.yourfuture.fun/api/webhooks/midtrans
- Stripe: https://www.yourfuture.fun/api/webhooks/stripe

## Database

Run the SQL file in Supabase SQL Editor:

supabase/migrations/202607160001_monetization_marketing.sql

## Current Behavior

- Free users can see only the first 2 BMC blocks. Blocks 3-9 show an upgrade lock.
- Tier 1 unlocks 9 blocks, AI chat, save canvas, and export.
- Output unlocks full BMC export as a one-time purchase.
- Premium is prepared for consultation booking access.
- Checkout gracefully reports missing payment env vars instead of exposing secrets in frontend.
