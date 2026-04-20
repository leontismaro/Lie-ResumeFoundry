alter table invite_tokens add column next_path text not null default '/';
alter table invite_tokens add column disabled_at integer;
alter table invite_tokens add column disabled_reason text;
alter table invite_tokens add column created_by text;
alter table invite_tokens add column updated_at integer not null default 0;

update invite_tokens
set
  next_path = '/',
  updated_at = created_at
where next_path = '/'
   or updated_at = 0;

create index if not exists idx_invite_tokens_disabled_at
  on invite_tokens (disabled_at);
