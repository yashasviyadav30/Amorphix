-- A project is one space being designed: a home, hotel, office, café, shop or studio.
-- Anyone can start one without logging in; owner_id is set when they sign in to save or share.
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  mode text not null default 'owner' check (mode in ('owner', 'pro')),
  space_type text check (space_type in ('house', 'apartment', 'office', 'cafe', 'hotel', 'shop', 'studio')),
  title text,
  status text not null default 'interview' check (status in ('interview', 'designing', 'ready')),
  site jsonb not null default '{}',        -- shell size, floors, location, units
  interview jsonb not null default '{}',   -- what the user told the interviewer, by section
  taste_signals jsonb not null default '[]', -- Qloo entities the user named: id, name, layer
  taste jsonb,                             -- the computed style profile
  brief jsonb,
  program jsonb,                           -- rooms the design needs (layout engine input)
  chosen_option int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every saved layout, so any change can be undone and compared.
create table if not exists project_versions (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  version int not null,
  layout jsonb not null,
  note text,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

-- Which project an agent session works on. Set by the server when a session starts,
-- so a tool never trusts a project id typed by the model or the user.
create table if not exists agent_sessions (
  session_id text primary key,
  project_id uuid not null references projects (id) on delete cascade,
  agent text not null,
  created_at timestamptz not null default now()
);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists projects_touch on projects;
create trigger projects_touch before update on projects for each row execute function touch_updated_at();

-- The server reaches these tables with the service role. Row level security blocks direct client access
-- until the share and login policies land.
alter table projects enable row level security;
alter table project_versions enable row level security;
alter table agent_sessions enable row level security;
