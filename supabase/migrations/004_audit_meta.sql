-- ── Audit Meta ────────────────────────────────────────────────────────────────
-- Tracks when audit agents last ran and readiness assessment results.

alter table schools
  add column if not exists audit_agents_last_run timestamptz,
  add column if not exists audit_readiness_score int,
  add column if not exists audit_readiness_grade text;
