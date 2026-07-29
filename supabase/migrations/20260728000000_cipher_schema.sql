-- Cipher schema (single combined migration)
-- Source: former 20260725100000…20260727170000 migrations

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  turnkey_user_id text,
  turnkey_suborg_id text,
  email text
);

create unique index if not exists users_turnkey_suborg_id_uidx
  on users (turnkey_suborg_id)
  where turnkey_suborg_id is not null;

create unique index if not exists users_turnkey_user_id_uidx
  on users (turnkey_user_id)
  where turnkey_user_id is not null;

create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  address text not null,
  chain_family text not null check (chain_family in ('evm', 'solana')),
  source text not null check (source in ('external', 'turnkey')),
  turnkey_wallet_id text,
  label text,
  created_at timestamptz not null default now(),
  unique (user_id, address, chain_family)
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wallet_id uuid not null references wallets(id),
  plan_json jsonb not null,
  plan_hash text not null,
  status text not null default 'draft'
    check (status in ('draft', 'awaiting_confirm', 'confirmed', 'executed', 'failed', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists plan_confirms (
  confirm_id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  plan_hash text not null,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  approved_at timestamptz
);

create table if not exists venue_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  venue text not null,
  backing_wallet_id uuid references wallets(id),
  ciphertext text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Chats
-- ---------------------------------------------------------------------------

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_user_id_updated_at_idx
  on chats (user_id, updated_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_chat_id_created_at_idx
  on chat_messages (chat_id, created_at asc);

-- ---------------------------------------------------------------------------
-- Agent wallets + runs
-- ---------------------------------------------------------------------------

create table if not exists agent_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  agent_run_id text not null,
  address text not null,
  chain_family text not null default 'evm'
    check (chain_family in ('evm', 'solana')),
  label text,
  private_key_ciphertext text not null,
  status text not null default 'active'
    check (status in ('active', 'destroyed')),
  created_at timestamptz not null default now(),
  destroyed_at timestamptz,
  unique (user_id, agent_run_id)
);

create index if not exists agent_wallets_user_id_idx on agent_wallets (user_id);
create index if not exists agent_wallets_address_idx on agent_wallets (address);

create table if not exists agent_runs (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  type text not null default 'general',
  goal text not null,
  policy jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'needs_confirm', 'succeeded', 'failed', 'cancelled')),
  steps jsonb not null default '[]'::jsonb,
  artifact jsonb,
  source text check (source is null or source in ('live', 'fallback')),
  wallet jsonb,
  sandbox_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists agent_runs_user_id_created_idx
  on agent_runs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant select on all tables in schema public to anon, authenticated;

grant all on all sequences in schema public to postgres, service_role;

alter default privileges in schema public
  grant all on tables to postgres, service_role;

alter default privileges in schema public
  grant select on tables to anon, authenticated;

grant all on table chats to postgres, service_role;
grant all on table chat_messages to postgres, service_role;
grant select on table chats to anon, authenticated;
grant select on table chat_messages to anon, authenticated;
