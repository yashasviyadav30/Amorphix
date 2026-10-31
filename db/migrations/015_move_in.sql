-- Moving in: when the build is finished, a walkthrough with a snag list (what still needs fixing), the handover pack
-- (warranty and notes), the client's acceptance, and afterwards a review of each pro on the project.

alter table projects add column if not exists handed_over_at timestamptz;   -- the client accepted the handover
alter table projects add column if not exists warranty_months int check (warranty_months between 0 and 240);
alter table projects add column if not exists handover_note text check (char_length(handover_note) <= 4000);

create table if not exists snags (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  room text check (char_length(room) <= 60),
  note text not null check (char_length(note) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'fixed', 'closed')),
  created_by uuid references auth.users (id) on delete set null,
  author_name text not null,
  created_at timestamptz not null default now(),
  fixed_at timestamptz,
  closed_at timestamptz
);
create index if not exists snags_project on snags (project_id, created_at);

create table if not exists reviews (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  pro_id uuid not null references auth.users (id) on delete cascade,
  by_id uuid not null references auth.users (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  text text check (char_length(text) <= 1000),
  created_at timestamptz not null default now(),
  unique (project_id, pro_id, by_id)
);
create index if not exists reviews_pro on reviews (pro_id);

alter table snags enable row level security;
alter table reviews enable row level security;
