-- Homeowners and business owners are one role, "owner": the kind of space (a home or a business) lives on the project.
update profiles set role = 'owner' where role = 'business';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('owner', 'architect', 'builder'));
