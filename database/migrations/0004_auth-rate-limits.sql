create table if not exists auth_rate_limits (
  scope text not null,
  subject text not null,
  attempts integer not null,
  window_started_at integer not null,
  blocked_until integer,
  updated_at integer not null,
  primary key (scope, subject)
);

create index if not exists idx_auth_rate_limits_blocked_until
  on auth_rate_limits (blocked_until);
