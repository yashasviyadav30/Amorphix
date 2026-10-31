-- People on a project besides its owner, and the invite links that add them.
create table if not exists project_members (
  project_id uuid not null references projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('architect', 'client', 'builder', 'viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user on project_members (user_id);

create table if not exists invites (
  token text primary key,                 -- 32 random bytes, hex
  project_id uuid not null references projects (id) on delete cascade,
  role text not null check (role in ('architect', 'client', 'builder', 'viewer')),
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists invites_project on invites (project_id);

alter table project_members enable row level security;
alter table invites enable row level security;
