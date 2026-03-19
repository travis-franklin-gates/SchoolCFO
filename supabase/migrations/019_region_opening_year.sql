-- Add region and opening_year columns for onboarding.
-- operating_year is calculated from opening_year at runtime.

alter table schools
  add column if not exists region text,
  add column if not exists opening_year text;

-- Ensure operating_year exists (from migration 013, but applying defensively)
alter table schools
  add column if not exists operating_year integer not null default 3;
