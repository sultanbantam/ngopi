create extension if not exists pgcrypto;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  plan_type text not null check (plan_type in ('free', 'tier1', 'output', 'premium')),
  status text not null check (status in ('active', 'expired', 'canceled', 'trial')),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  payment_provider text check (payment_provider in ('midtrans', 'stripe')),
  provider_subscription_id text,
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  amount numeric(10,2) not null,
  currency text not null,
  plan_type text not null check (plan_type in ('free', 'tier1', 'output', 'premium')),
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  payment_provider text check (payment_provider in ('midtrans', 'stripe')),
  provider_payment_id text unique,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  status text not null check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  scheduled_at timestamptz not null,
  duration_minutes int default 60,
  amount numeric(10,2) not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid,
  referee_email text not null,
  status text check (status in ('pending', 'converted', 'expired')) default 'pending',
  referral_code text unique not null,
  reward_amount numeric(10,2) default 10000,
  converted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  referral_code text,
  position bigserial,
  created_at timestamptz default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz default now(),
  unique(provider, provider_event_id)
);

create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id, status, created_at desc);
create index if not exists payments_user_created_idx on public.payments(user_id, created_at desc);
create index if not exists referrals_code_idx on public.referrals(referral_code);
create index if not exists waitlist_email_idx on public.waitlist(email);
