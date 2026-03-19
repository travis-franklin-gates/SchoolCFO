-- Add configurable financial assumptions as JSONB column on the schools table.
-- Each school can override any subset; the application falls back to defaults for missing keys.

alter table schools
  add column if not exists financial_assumptions jsonb
  default '{
    "benefits_load_pct": 30,
    "fica_rate_pct": 7.65,
    "personnel_healthy_min_pct": 72,
    "personnel_healthy_max_pct": 78,
    "personnel_concern_pct": 80,
    "salary_escalator_pct": 2.5,
    "cola_rate_pct": 3.0,
    "operations_escalator_pct": 2.0,
    "aafte_pct": 95,
    "authorizer_fee_pct": 3.0,
    "cash_healthy_days": 60,
    "cash_watch_days": 45,
    "cash_concern_days": 30,
    "cash_crisis_days": 15,
    "interest_rate_pct": 2.0
  }'::jsonb;
