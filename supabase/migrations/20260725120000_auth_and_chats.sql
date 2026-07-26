-- Turnkey-linked identity on users
alter table users
  add column if not exists turnkey_user_id text,
  add column if not exists turnkey_suborg_id text,
  add column if not exists email text;

create unique index if not exists users_turnkey_suborg_id_uidx
  on users (turnkey_suborg_id)
  where turnkey_suborg_id is not null;

create unique index if not exists users_turnkey_user_id_uidx
  on users (turnkey_user_id)
  where turnkey_user_id is not null;

-- Chat sessions (ChatGPT-style history)
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

grant all on table chats to postgres, service_role;
grant all on table chat_messages to postgres, service_role;
grant select on table chats to anon, authenticated;
grant select on table chat_messages to anon, authenticated;
