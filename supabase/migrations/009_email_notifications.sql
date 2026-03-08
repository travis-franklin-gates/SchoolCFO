-- ── Email Notification Support ──────────────────────────────────────────────

-- Track whether an email has been sent for each agent finding
alter table agent_findings
  add column if not exists email_sent boolean not null default false;

-- Track last daily digest sent per school
alter table schools
  add column if not exists last_digest_sent timestamptz;

-- Allow 'notification_prefs' as a context_type in school_context
alter table school_context
  drop constraint if exists school_context_context_type_check;

alter table school_context
  add constraint school_context_context_type_check
  check (context_type in ('guided', 'freeform', 'event_flag', 'notification_prefs'));
