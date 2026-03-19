-- Multi-year projection framework.
-- Stores Year 1-5 projections per school per scenario (Base Case, etc.).
-- Calculation engine is a future feature — this is the data foundation.

create table if not exists multi_year_projections (
  id uuid default gen_random_uuid() primary key,
  school_id uuid not null references schools(id) on delete cascade,
  projection_name text not null default 'Base Case',
  year_number int not null,
  fiscal_year text,                    -- e.g. "2026-27"
  projected_enrollment int,
  total_revenue decimal,
  total_expenses decimal,
  net_position decimal,
  beginning_cash decimal,
  ending_cash decimal,
  reserve_days int,
  revenue_detail jsonb,                -- per-line revenue breakdown
  expense_detail jsonb,                -- per-category expense breakdown
  staffing_detail jsonb,               -- position-level staffing plan
  assumptions_snapshot jsonb,          -- snapshot of financial_assumptions at generation time
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id, projection_name, year_number)
);

alter table multi_year_projections enable row level security;

create policy "multi_year_projections_own" on multi_year_projections
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

create index if not exists idx_multi_year_projections_school
  on multi_year_projections (school_id, projection_name);
