-- ==============================================================================
-- NovaPulse AI — Production Database Schema & Row Level Security (RLS)
-- ==============================================================================
-- INSTRUCTIONS:
-- 1. In Supabase Dashboard, open SQL Editor (Left sidebar > SQL Editor).
-- 2. Click "+ New query" (or select all with Ctrl+A and delete existing text).
-- 3. Paste this ENTIRE file into the editor.
-- 4. Click the green "Run" button (or press Ctrl + Enter).
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. USER PROFILES & SUBSCRIPTIONS
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  plan_tier text not null default 'free' check (plan_tier in ('free', 'growth', 'enterprise')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'annual')),
  subscription_status text not null default 'active' check (subscription_status in ('active', 'past_due', 'canceled')),
  razorpay_payment_id text,
  razorpay_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. MONITORED SERVICES
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  endpoint text,
  environment text not null default 'production' check (environment in ('production', 'staging', 'development')),
  status text not null default 'healthy' check (status in ('healthy', 'degraded', 'down')),
  latency_ms numeric(10, 2) check (latency_ms is null or latency_ms >= 0),
  uptime_pct numeric(5, 2) not null default 99.98 check (uptime_pct between 0 and 100),
  created_at timestamptz not null default now()
);

-- 4. ALERTS & INCIDENTS
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  title text not null check (char_length(title) between 1 and 240),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  status text not null default 'active' check (status in ('active', 'acknowledged', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- 5. TELEMETRY SPANS & TRACES
create table if not exists public.telemetry_traces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trace_id text not null,
  service_name text not null,
  endpoint text not null,
  method text not null default 'GET',
  status_code integer not null default 200,
  duration_ms numeric(10, 2) not null check (duration_ms >= 0),
  payload_preview jsonb,
  created_at timestamptz not null default now()
);

-- 6. API KEYS & INGESTION TOKENS
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null default 'np_live_',
  key_preview text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- 7. ENTERPRISE DEMO REQUESTS (Sales / CRM capture)
create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  work_email text not null,
  team_size text,
  cloud_provider text,
  use_case text,
  created_at timestamptz not null default now()
);

-- 8. PERFORMANCE INDEXES
create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists services_owner_created_idx on public.services (owner_id, created_at desc);
create index if not exists alerts_owner_created_idx on public.alerts (owner_id, status, created_at desc);
create index if not exists traces_owner_created_idx on public.telemetry_traces (owner_id, created_at desc);
create index if not exists api_keys_owner_created_idx on public.api_keys (owner_id, created_at desc);
create index if not exists demo_requests_created_idx on public.demo_requests (created_at desc);

-- 9. ROW LEVEL SECURITY (RLS) ACTIVATION
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.alerts enable row level security;
alter table public.telemetry_traces enable row level security;
alter table public.api_keys enable row level security;
alter table public.demo_requests enable row level security;

-- 10. CLEAN UP PRIOR POLICIES (Idempotent execution)
drop policy if exists "users can read own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "users manage own services" on public.services;
drop policy if exists "users manage own alerts" on public.alerts;
drop policy if exists "users manage own traces" on public.telemetry_traces;
drop policy if exists "users manage own api keys" on public.api_keys;
drop policy if exists "anyone can insert demo requests" on public.demo_requests;

-- 11. GRANT PERMISSIONS
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.services, public.alerts, public.telemetry_traces, public.api_keys to anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.services, public.alerts, public.telemetry_traces, public.api_keys to authenticated;
grant insert on public.demo_requests to anon, authenticated;

-- 12. SECURE RLS POLICIES (Users only see/edit their own data; anonymous sees 0 rows)
create policy "users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users manage own services"
  on public.services for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "users manage own alerts"
  on public.alerts for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "users manage own traces"
  on public.telemetry_traces for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "users manage own api keys"
  on public.api_keys for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "anyone can insert demo requests"
  on public.demo_requests for insert
  to anon, authenticated
  with check (true);

-- 13. AUTOMATIC USER ONBOARDING TRIGGER
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $fn$
declare
  auth_email text;
  auth_name text;
  srv_api_id uuid;
begin
  auth_email := coalesce(new.email, '');
  auth_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(auth_email, '@', 1));

  -- Create user profile
  insert into public.profiles (id, email, full_name, plan_tier)
  values (new.id, auth_email, auth_name, 'free')
  on conflict (id) do nothing;

  -- Create initial starter services for immediate productivity
  insert into public.services (owner_id, name, endpoint, environment, status, latency_ms, uptime_pct)
  values (new.id, 'API Gateway', 'https://api.novapulse.internal/v1', 'production', 'healthy', 18.4, 99.99)
  returning id into srv_api_id;

  insert into public.services (owner_id, name, endpoint, environment, status, latency_ms, uptime_pct)
  values (new.id, 'Auth & Session Service', 'https://auth.novapulse.internal', 'production', 'healthy', 24.1, 99.95);

  insert into public.services (owner_id, name, endpoint, environment, status, latency_ms, uptime_pct)
  values (new.id, 'Payment Processing Webhook', 'https://pay.novapulse.internal/razorpay', 'production', 'healthy', 45.8, 99.90);

  -- Create starter alert
  insert into public.alerts (owner_id, service_id, title, severity, status)
  values (new.id, srv_api_id, 'High latency detected on /v1/telemetry during burst traffic', 'warning', 'active');

  -- Create starter API key
  insert into public.api_keys (owner_id, name, key_prefix, key_preview)
  values (new.id, 'Default Telemetry Key', 'np_live_', 'np_live_••••••••••••9a7b');

  -- Create starter trace span
  insert into public.telemetry_traces (owner_id, trace_id, service_name, endpoint, method, status_code, duration_ms, payload_preview)
  values (
    new.id,
    'tr_' || substr(md5(random()::text), 1, 16),
    'API Gateway',
    '/v1/telemetry/spans',
    'POST',
    200,
    18.4,
    '{"service":"api-gateway","span_count":4,"protocol":"otlp/http"}'::jsonb
  );

  return new;
end;
$fn$;

-- Re-bind trigger cleanly
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 14. BACKFILL EXISTING USERS
-- Ensure users who registered before this trigger was added are initialized
insert into public.profiles (id, email, full_name, plan_tier)
select 
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data->>'full_name', split_part(coalesce(email, 'user'), '@', 1)),
  'free'
from auth.users
on conflict (id) do nothing;
