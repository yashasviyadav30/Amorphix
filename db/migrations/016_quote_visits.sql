-- The builder's own price, fees tied to the site's phases, and the architect on site.
--   quotes: the builder's quote for the build, answered by whoever approves the design (the client, or the owner).
--           An accepted quote is the site's budget instead of Amorphix's estimate.
--   milestones.phase: the site phase a fee is due on ("structure"), so finishing it reminds the builder to bill.
--   site_visits: an architect's (or any pro's) visit to the site, with what they saw.
--   site_phases.signed_off_*: a stage checked and signed off by the designer.

create table if not exists quotes (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  builder_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  weeks int check (weeks between 1 and 520),
  note text check (char_length(note) <= 2000),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists quotes_project on quotes (project_id, created_at desc);
alter table quotes enable row level security;

alter table milestones add column if not exists phase text check (char_length(phase) <= 40);

create table if not exists site_visits (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null,
  visited_on date not null default current_date,
  note text not null check (char_length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists site_visits_project on site_visits (project_id, visited_on desc);
alter table site_visits enable row level security;

alter table site_phases add column if not exists signed_off_at timestamptz;
alter table site_phases add column if not exists signed_off_by text check (char_length(signed_off_by) <= 120);
alter table site_phases add column if not exists signed_off_note text check (char_length(signed_off_note) <= 1000);
