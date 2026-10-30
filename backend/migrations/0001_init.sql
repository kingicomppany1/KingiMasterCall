-- KingiMaster Sales Team calling schema (Postgres / Supabase)
-- call_logs is written ONLY by the Africa's Talking webhook handler in the FastAPI backend.

create extension if not exists pgcrypto;

create type user_role as enum ('sales_agent', 'admin');
create type call_outcome as enum (
  'no_answer', 'wrong_number', 'call_back', 'interested',
  'not_interested', 'meeting_booked', 'deal_closed'
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  role user_role not null default 'sales_agent',
  active boolean not null default true,
  daily_cap_ngn numeric(12,2) not null default 1500,
  monthly_cap_ngn numeric(12,2) not null default 35000,
  created_at timestamptz not null default now()
);

-- Auto-create a profile for every new auth user (default role: sales_agent)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create table contacts (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  company_key text generated always as (lower(btrim(company))) stored,
  name text,
  title text,
  phone text not null default '',
  switchboard text not null default '',
  linkedin text,
  email text,
  -- outreach link: 'yes' stops the email sequence
  status text not null default 'new'
    check (status in ('new','contacted','callback','yes','no','bad_number')),
  email_sequence_active boolean not null default true,
  callback_at timestamptz,
  call_attempts int not null default 0,
  last_called_at timestamptz,
  import_batch text,
  created_at timestamptz not null default now(),
  unique (company_key, phone)
);
create index contacts_company_key_idx on contacts (company_key);

-- One agent per company: company_key is the primary key
create table company_assignments (
  company_key text primary key,
  agent_id uuid not null references profiles(id) on delete cascade,
  assigned_at timestamptz not null default now()
);
create index company_assignments_agent_idx on company_assignments (agent_id);

-- A session is created by OUR server before a call. The browser only ever passes
-- the session id to Africa's Talking; the number to dial is looked up here.
create table call_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references profiles(id),
  contact_id uuid not null references contacts(id),
  dialed_number text not null,
  provider_session_id text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 minutes'
);

create table call_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references call_sessions(id),
  provider_session_id text not null unique,
  agent_id uuid not null references profiles(id),
  contact_id uuid references contacts(id),
  number text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_sec int not null default 0,
  answered boolean not null default false,
  cost_ngn numeric(10,4) not null default 0,
  hangup_cause text,
  state text,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index call_logs_agent_started_idx on call_logs (agent_id, started_at desc);

create table call_outcomes (
  call_log_id uuid primary key references call_logs(id) on delete cascade,
  agent_id uuid not null references profiles(id),
  outcome call_outcome not null,
  callback_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (outcome <> 'call_back' or callback_at is not null)
);

-- Lock down PostgREST: RLS on with NO policies means the Supabase anon/authenticated
-- keys can read nothing. Only the FastAPI backend (direct Postgres connection) touches data.
alter table profiles enable row level security;
alter table contacts enable row level security;
alter table company_assignments enable row level security;
alter table call_sessions enable row level security;
alter table call_logs enable row level security;
alter table call_outcomes enable row level security;
