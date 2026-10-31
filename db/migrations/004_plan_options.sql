-- The three plan options the wizard shows. The chosen one is also saved as version 1.
alter table projects add column if not exists options jsonb;
