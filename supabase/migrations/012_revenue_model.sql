-- Add student demographic fields used by the V8 revenue model.
-- These drive per-pupil revenue calculations for SPED, Title I, IDEA, LAP, TBIP, HiCap.

alter table schools
  add column if not exists headcount integer default 0,
  add column if not exists sped_pct numeric(5,2) default 0,
  add column if not exists frl_pct numeric(5,2) default 0,
  add column if not exists ell_pct numeric(5,2) default 0,
  add column if not exists hicap_pct numeric(5,2) default 0,
  add column if not exists iep_pct numeric(5,2) default 0;

-- Update financial_assumptions default to include per-pupil rate keys.
-- Existing rows keep their current JSONB; new rows get the expanded default.
-- The application-level mergeAssumptions() handles missing keys at runtime.
