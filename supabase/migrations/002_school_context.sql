-- ── School Context ────────────────────────────────────────────────────────────
-- Stores guided prompt answers, free-form notes, and event flags.
-- All three context_type values share the same table for simplicity.

create table if not exists school_context (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  context_type text not null check (context_type in ('guided', 'freeform', 'event_flag')),
  key text not null,              -- guided prompt key, note title, or flag identifier
  value jsonb not null default '{}',
  expires_at date,                -- null = no expiration
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table school_context enable row level security;

create policy "school_context_own" on school_context
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

-- Updated-at trigger
create trigger school_context_updated_at before update on school_context
  for each row execute function set_updated_at();

-- ── Audit Prep Checklists ────────────────────────────────────────────────────
-- Stores per-school audit checklist state (checked items, review timestamps).

create table if not exists audit_checklists (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  category text not null,         -- e.g. 'time_effort', 'cash_management', 'cedars', 'board_governance'
  checked_items jsonb not null default '[]',  -- array of checked item keys
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, category)
);

alter table audit_checklists enable row level security;

create policy "audit_checklists_own" on audit_checklists
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

create trigger audit_checklists_updated_at before update on audit_checklists
  for each row execute function set_updated_at();
