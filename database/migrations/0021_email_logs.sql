-- 0021_email_logs.sql — transactional email audit trail.
--
-- Courier (email-server) writes one row per dispatched message via PostgREST
-- with the service role (email-server/src/db/emailLogsRepo.ts). It replaces an
-- in-process 1000-entry ring buffer that was wiped by every redeploy and every
-- restart, which is why the admin dashboard used to render an empty table.
-- The buffer survives only as the dev/test fallback when SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY are unset.
--
-- TWO WRITERS reach this table, and the second one is the reason it exists:
--   1. POST /api/v1/send — mail Courier dispatches on our behalf.
--   2. POST /api/v1/logs — mail captured by the Haraka plugin
--      (haraka/plugins/log_delivery.js) on hook_queue_ok. GoTrue's auth mail
--      (confirmation / recovery / magic-link / invite / email-change) is
--      submitted over SMTP :587 and NEVER touches the HTTP API, so without
--      that plugin essentially none of the platform's real mail is recorded.
--      Those rows carry template_type='auth' and status='relayed'.
--
-- message_id is the SMTP/provider Message-ID, i.e. the value to correlate with
-- Amazon SES logs. user_id is FK-constrained to auth.users, so the writer must
-- send NULL rather than a non-UUID or PostgREST rejects the whole row and the
-- log line is silently lost.
--
-- Service-role-only posture like 0017/0018: RLS enabled, ZERO client policies.
-- Core reads this table through /api/v1/admin/emails (service role); the
-- browser never touches Vault directly.

create table if not exists email_logs (
  id            uuid primary key default gen_random_uuid(),
  message_id    text,                         -- nodemailer/ses message-id
  to_address    text not null,
  subject       text not null,
  template_type text not null default 'transactional',
  locale        text,
  user_id       uuid references auth.users(id) on delete set null,
  status        text not null default 'queued',
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

alter table email_logs enable row level security;

-- email-server writes via service role (the only writer).
-- Core reads via service role for the admin dashboard.
-- No client policies — browsers never query this table directly.

create index if not exists idx_email_logs_created_at on email_logs (created_at desc);
create index if not exists idx_email_logs_status    on email_logs (status);
create index if not exists idx_email_logs_to        on email_logs (to_address);
