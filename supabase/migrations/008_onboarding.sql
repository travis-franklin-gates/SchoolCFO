-- Add onboarding_completed flag to schools table
alter table schools
  add column if not exists onboarding_completed boolean not null default false;
