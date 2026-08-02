-- Durable portfolio view cache (shared across serverless isolates).
-- Keys: address:<normalized> | user:<userId>:all

create table if not exists portfolio_cache (
  cache_key text primary key,
  user_id uuid references users (id) on delete cascade,
  address text,
  view_json jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists portfolio_cache_expires_idx
  on portfolio_cache (expires_at);

create index if not exists portfolio_cache_address_idx
  on portfolio_cache (address)
  where address is not null;

grant all on table portfolio_cache to postgres, service_role;
grant select on table portfolio_cache to anon, authenticated;
