-- Ephemeral agent wallets: encrypted private keys for reclaim-on-destroy.
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
