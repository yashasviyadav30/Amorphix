-- Projects started without login belong to the browser's signed guest id until the user signs in.
alter table projects add column if not exists guest_id uuid;
create index if not exists projects_guest_id on projects (guest_id);
