-- Persist agent runs so they survive server restarts (list/get/stop).
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
