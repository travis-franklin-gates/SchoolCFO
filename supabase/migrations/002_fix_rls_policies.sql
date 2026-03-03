-- ── Fix RLS policies: ensure FOR ALL (SELECT + INSERT + UPDATE + DELETE) ──────
--
-- The initial migration created one policy per table using FOR ALL, but if
-- those policies were applied to the database as SELECT-only (e.g. via the
-- Supabase dashboard), UPDATE and DELETE operations will be silently blocked.
--
-- This migration is safe to run regardless: DROP IF EXISTS handles the case
-- where the policy already exists correctly as FOR ALL.

-- grants
drop policy if exists "grants_own" on grants;
create policy "grants_own" on grants
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

-- monthly_snapshots
drop policy if exists "snapshots_own" on monthly_snapshots;
create policy "snapshots_own" on monthly_snapshots
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

-- board_packets
drop policy if exists "board_packets_own" on board_packets;
create policy "board_packets_own" on board_packets
  for all using (
    school_id in (select id from schools where user_id = auth.uid())
  );

-- schools (included for completeness)
drop policy if exists "schools_own" on schools;
create policy "schools_own" on schools
  for all using (user_id = auth.uid());

-- ── Verification query ────────────────────────────────────────────────────────
-- Run this after applying the migration to confirm every policy shows cmd = ALL:
--
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename;
