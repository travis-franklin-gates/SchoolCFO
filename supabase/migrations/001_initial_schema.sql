-- ── SchoolCFO Initial Schema ──────────────────────────────────────────────────

-- Schools table: one row per user (one school per account)
create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  authorizer text not null default 'Washington State Charter School Commission',
  grade_config text not null default 'K-5',
  current_ftes numeric(8,2) not null default 0,
  prior_year_ftes numeric(8,2) not null default 0,
  next_board_meeting date,
  next_finance_committee date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- Monthly snapshots: one row per (school, month_key)
create table if not exists monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  month_key text not null,           -- "2026-02"
  label text not null,               -- "February 2026"
  uploaded_at timestamptz not null default now(),
  filename text not null default '',
  row_count integer not null default 0,
  budget_categories jsonb not null default '[]',
  financial_summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, month_key)
);

-- Grants: both categorical (WA) and other/philanthropic
create table if not exists grants (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  grant_type text not null check (grant_type in ('categorical', 'other')),
  name text not null,
  funder text,                       -- for 'other' type only
  award_amount numeric(14,2) not null default 0,
  spent_to_date numeric(14,2) not null default 0,
  restrictions text,                 -- GrantStatus for 'categorical', OtherGrantRestrictions for 'other'
  start_date date,                   -- for 'other' grants
  end_date date,                     -- for 'other' grants
  notes text,                        -- for 'other' grants
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Board packets: one per (school, month_key)
create table if not exists board_packets (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  month_key text not null,           -- "2026-02"
  month_label text not null,         -- "February 2026"
  status text not null default 'draft' check (status in ('not-started', 'draft', 'finalized')),
  generated_at date,
  finalized_at timestamptz,
  content jsonb,                     -- BoardPacketContent: { financialNarrative, varianceExplanations[], cashFlowNotes }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, month_key)
);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table schools enable row level security;
alter table monthly_snapshots enable row level security;
alter table grants enable row level security;
alter table board_packets enable row level security;

-- Schools: users can only access their own school
create policy "schools_own" on schools
  for all using (user_id = auth.uid());

-- Monthly snapshots: via school ownership
create policy "snapshots_own" on monthly_snapshots
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

-- Grants: via school ownership
create policy "grants_own" on grants
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

-- Board packets: via school ownership
create policy "board_packets_own" on board_packets
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

-- ── Updated-at trigger ────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger schools_updated_at before update on schools
  for each row execute function set_updated_at();

create trigger snapshots_updated_at before update on monthly_snapshots
  for each row execute function set_updated_at();

create trigger grants_updated_at before update on grants
  for each row execute function set_updated_at();

create trigger board_packets_updated_at before update on board_packets
  for each row execute function set_updated_at();
