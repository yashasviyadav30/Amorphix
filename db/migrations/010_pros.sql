-- Finding a pro: pros are listed for new clients (they can switch it off), say a few words and a fee range, and
-- clients send them requests to join a project.

alter table profiles add column if not exists listed boolean not null default true;
alter table profiles add column if not exists about text check (char_length(about) <= 400);
alter table profiles add column if not exists fee_note text check (char_length(fee_note) <= 120);

create table if not exists pro_requests (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  pro_id uuid not null references auth.users (id) on delete cascade,
  from_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('architect', 'builder')),
  message text check (char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  unique (project_id, pro_id)
);
create index if not exists pro_requests_pro on pro_requests (pro_id, status);
alter table pro_requests enable row level security;
