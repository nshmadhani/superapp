create extension if not exists "pgcrypto";

create table users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table wallets (
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

create table plans (
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

create table plan_confirms (
  confirm_id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  plan_hash text not null,
  consumed_at timestamptz,
  expires_at timestamptz not null
);

create table venue_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  venue text not null,
  backing_wallet_id uuid references wallets(id),
  ciphertext text not null,
  created_at timestamptz not null default now()
);
