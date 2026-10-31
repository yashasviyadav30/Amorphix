-- An owner can run their own building site, without a builder on Amorphix.
alter table projects add column if not exists self_build boolean not null default false;
