-- Agent cache table for change-detection-based caching.
-- Agents only re-run when underlying data changes (detected via data_hash).

create table if not exists agent_cache (
  id uuid default gen_random_uuid() primary key,
  school_id uuid not null references schools(id) on delete cascade,
  agent_name text not null,
  data_hash text not null,
  status text,
  summary text,
  full_analysis text,
  recommendations jsonb,
  cached_at timestamptz not null default now(),
  unique(school_id, agent_name)
);

alter table agent_cache enable row level security;

create policy "agent_cache_own" on agent_cache
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

create index if not exists idx_agent_cache_school
  on agent_cache (school_id);

-- Add data_hash column to schools for tracking when data changes
alter table schools
  add column if not exists agent_data_hash text;
