alter table invite_tokens add column mode text not null default 'single_use';
alter table invite_tokens add column max_uses integer;
alter table invite_tokens add column used_count integer not null default 0;
alter table invite_tokens add column session_policy text not null default 'fixed_ttl';
alter table invite_tokens add column session_ttl_seconds integer;

update invite_tokens
set used_count = case
  when consumed_at is null then 0
  else 1
end
where used_count = 0;
