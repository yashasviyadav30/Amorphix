-- Role spaces: projects unlock per project (or through a pro's plan), remember when the guided tour was done,
-- and can name the person they were designed for. Pros get a trial.

alter table projects add column if not exists unlocked_at timestamptz;
alter table projects add column if not exists toured_at timestamptz;
alter table projects add column if not exists designed_for text;

-- Everything made before per-project unlocking stays open, and finished designs skip the tour.
update projects set unlocked_at = now() where unlocked_at is null;
update projects set toured_at = now() where toured_at is null and chosen_option is not null;

alter table profiles add column if not exists trial_until timestamptz;
alter table profiles add column if not exists demo boolean not null default false;
