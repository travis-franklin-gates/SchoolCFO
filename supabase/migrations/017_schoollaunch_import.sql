-- SchoolLaunch import tracking fields on the schools table.
-- Lets the AI know the school transitioned from planning.

alter table schools
  add column if not exists imported_from_schoollaunch boolean not null default false,
  add column if not exists schoollaunch_import_date timestamptz;
