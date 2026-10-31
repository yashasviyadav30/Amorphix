-- Review: comments pinned to rooms, approvals of a design version, and notifications.

alter table projects drop constraint if exists projects_status_check;
alter table projects add constraint projects_status_check
  check (status in ('interview', 'designing', 'ready', 'review', 'approved', 'building', 'done'));

create table if not exists comments (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  version int,                              -- the design version it was written on
  room_id text,                             -- the room it is pinned to; null for the whole design
  room_name text,
  level int,
  parent_id bigint references comments (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 2000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_project on comments (project_id, created_at);

create table if not exists approvals (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  version int not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  decision text not null check (decision in ('approved', 'changes')),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists approvals_project on approvals (project_id, created_at desc);

create table if not exists events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,   -- who is told
  project_id uuid references projects (id) on delete cascade,
  kind text not null,                       -- comment, review, approved, changes, joined
  data jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists events_user on events (user_id, read, created_at desc);

alter table comments enable row level security;
alter table approvals enable row level security;
alter table events enable row level security;
