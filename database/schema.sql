create table if not exists invite_tokens (
  id text primary key,
  token_hash text not null unique,
  mode text not null default 'single_use',
  max_uses integer,
  used_count integer not null default 0,
  expires_at integer not null,
  consumed_at integer,
  created_at integer not null,
  note text,
  session_policy text not null default 'fixed_ttl',
  session_ttl_seconds integer,
  check (mode in ('single_use', 'reusable_until_expire', 'limited_uses')),
  check (session_policy in ('fixed_ttl', 'cap_to_invite_expiry'))
);

create index if not exists idx_invite_tokens_expires_at
  on invite_tokens (expires_at);

create index if not exists idx_invite_tokens_consumed_at
  on invite_tokens (consumed_at);

create index if not exists idx_invite_tokens_mode
  on invite_tokens (mode);

create table if not exists sessions (
  id text primary key,
  invite_id text not null,
  expires_at integer not null,
  revoked_at integer,
  created_at integer not null,
  foreign key (invite_id) references invite_tokens(id)
);

create index if not exists idx_sessions_invite_id
  on sessions (invite_id);

create index if not exists idx_sessions_expires_at
  on sessions (expires_at);

create index if not exists idx_sessions_revoked_at
  on sessions (revoked_at);
