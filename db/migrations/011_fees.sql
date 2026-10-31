-- Fees between a pro and their client, tracked by milestone: planned, billed, paid (the client says so), received
-- (the pro confirms). No money moves through Amorphix; it keeps the record on the project.
create table if not exists milestones (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'INR' check (char_length(currency) = 3),
  status text not null default 'planned' check (status in ('planned', 'billed', 'claimed', 'received')),
  position int not null default 0,
  created_by uuid not null references auth.users (id) on delete cascade,
  billed_at timestamptz,
  claimed_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists milestones_project on milestones (project_id, position);
alter table milestones enable row level security;
