-- Accounts: one profile per signed-in user, with the role they chose at sign-up and their plan.
create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'business', 'architect', 'builder')),
  name text not null,
  company text,                 -- studio or company name (architects, builders, businesses)
  logo_url text,
  city text,
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  crew_size int check (crew_size between 1 and 10000),
  trades text[] not null default '{}',
  plan text not null default 'free' check (plan in ('free', 'owner', 'pro', 'build')),
  plan_until timestamptz,
  paypal_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch before update on profiles for each row execute function touch_updated_at();
alter table profiles enable row level security;

create index if not exists projects_owner_id on projects (owner_id);

-- Studio and company logos, shown on client links and the PDF pack.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
