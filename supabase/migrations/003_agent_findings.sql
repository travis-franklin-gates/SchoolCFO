-- ── Agent Findings ──────────────────────────────────────────────────────────
-- Specialist agents write structured findings here. The Coordinator reads
-- active findings to synthesize responses across all AI surfaces.

create table if not exists agent_findings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  agent_name text not null,           -- 'budget_analyst' | 'cash_sentinel' | 'grants_officer' | 'board_prep'
  finding_type text not null,         -- 'variance' | 'cash_risk' | 'grant_underspend' | 'grant_overspend' | 'braiding_opportunity' | 'board_action_required'
  severity text not null check (severity in ('info', 'watch', 'concern', 'action')),
  title text not null,
  summary text not null,
  detail jsonb not null default '{}',
  expires_at date,                    -- null = no expiration (auto-cleaned after 30 days by convention)
  created_at timestamptz not null default now()
);

-- RLS
alter table agent_findings enable row level security;

create policy "agent_findings_own" on agent_findings
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

-- Index for fast lookup by school + recency
create index if not exists idx_agent_findings_school_created
  on agent_findings (school_id, created_at desc);
