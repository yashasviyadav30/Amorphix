-- Private server-side cache of Qloo responses. Qloo allows private caching with no time limit.
-- Only the server (service role) reads and writes it; row level security blocks everyone else.
create table if not exists qloo_cache (
  key text primary key,          -- sha256 of path + sorted query params
  path text not null,
  body jsonb not null,
  created_at timestamptz not null default now()
);

alter table qloo_cache enable row level security;
