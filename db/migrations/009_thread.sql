-- The project thread: one chat for everyone on a project (and a team-only channel for the pros), with the
-- project's own events posted in it. It replaces the comments table, which was never used.

drop table if exists comments;

create table if not exists messages (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  channel text not null default 'all' check (channel in ('all', 'team')),
  kind text not null default 'message' check (kind in ('message', 'event')),
  author_id uuid references auth.users (id) on delete set null,   -- null for Amorphix's own events
  author_name text not null,
  body text not null check (char_length(body) between 1 and 4000),
  room_id text,                             -- the room it is about, if any
  room_name text,
  level int,
  version int,                              -- the design version it refers to
  data jsonb not null default '{}',         -- event details (type, decision, note, ...)
  attachments jsonb not null default '[]',  -- [{ path, name, type, size }] in the thread bucket
  created_at timestamptz not null default now()
);
create index if not exists messages_project on messages (project_id, channel, created_at);

-- How far each person has read each channel, for unread counts.
create table if not exists thread_reads (
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null default 'all',
  read_at timestamptz not null default now(),
  primary key (project_id, user_id, channel)
);

alter table messages enable row level security;
alter table thread_reads enable row level security;

-- Photos and files people share in a thread. Private: shown through short-lived signed links.
insert into storage.buckets (id, name, public, file_size_limit)
values ('thread', 'thread', false, 10485760)
on conflict (id) do nothing;
