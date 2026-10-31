-- The building site: phases and tasks, the builder's crew and who was on site each day, materials and their
-- orders, and photo updates for the client.

create table if not exists site_phases (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  key text not null,                         -- the timeline phase it came from (structure, services, ...)
  name text not null check (char_length(name) between 1 and 80),
  note text,
  position int not null default 0,
  start_date date not null,
  end_date date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'done')),
  pct int not null default 0 check (pct between 0 and 100)
);
create index if not exists site_phases_project on site_phases (project_id, position);

-- The builder's people, kept across all their sites.
create table if not exists crew (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  trade text check (char_length(trade) <= 40),
  phone text check (char_length(phone) <= 30),
  day_rate numeric(12, 2) not null default 0 check (day_rate >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists crew_owner on crew (owner_id);

create table if not exists site_crew (
  project_id uuid not null references projects (id) on delete cascade,
  crew_id bigint not null references crew (id) on delete cascade,
  primary key (project_id, crew_id)
);

create table if not exists site_tasks (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  phase_id bigint references site_phases (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  crew_id bigint references crew (id) on delete set null,
  due date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists site_tasks_project on site_tasks (project_id);

create table if not exists attendance (
  project_id uuid not null references projects (id) on delete cascade,
  crew_id bigint not null references crew (id) on delete cascade,
  day date not null,
  present boolean not null default true,
  hours numeric(4, 1) not null default 8 check (hours between 0 and 24),
  primary key (project_id, crew_id, day)
);

create table if not exists materials (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  unit text not null default 'units',
  phase text,                                -- the phase key it is used in
  needed numeric(12, 2) not null default 0 check (needed >= 0),
  ordered numeric(12, 2) not null default 0 check (ordered >= 0),
  delivered numeric(12, 2) not null default 0 check (delivered >= 0),
  used numeric(12, 2) not null default 0 check (used >= 0),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0)
);
create index if not exists materials_project on materials (project_id);

create table if not exists material_orders (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  material_id bigint not null references materials (id) on delete cascade,
  qty numeric(12, 2) not null check (qty > 0),
  supplier text check (char_length(supplier) <= 80),
  cost numeric(14, 2) not null default 0 check (cost >= 0),
  eta date,
  status text not null default 'ordered' check (status in ('ordered', 'delivered')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists material_orders_project on material_orders (project_id);

create table if not exists site_updates (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  phase_id bigint references site_phases (id) on delete set null,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  note text not null check (char_length(note) between 1 and 2000),
  pct int check (pct between 0 and 100),
  photos jsonb not null default '[]',        -- [{ path, name, type, size }] in the thread bucket
  created_at timestamptz not null default now()
);
create index if not exists site_updates_project on site_updates (project_id, created_at desc);

alter table site_phases enable row level security;
alter table crew enable row level security;
alter table site_crew enable row level security;
alter table site_tasks enable row level security;
alter table attendance enable row level security;
alter table materials enable row level security;
alter table material_orders enable row level security;
alter table site_updates enable row level security;
