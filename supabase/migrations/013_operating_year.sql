-- Add operating_year field for FPF stage determination.
-- Year 1-2 = Stage 1, Year 3+ = Stage 2.
-- Default to 3 (Stage 2) for existing schools.

alter table schools
  add column if not exists operating_year integer not null default 3;
