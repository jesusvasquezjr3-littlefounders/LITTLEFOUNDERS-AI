-- 0021_email_logs.sql — transactional email audit trail.
--
-- NOT YET WIRED. This migration creates the destination schema only; as of
-- this commit NOTHING reads or writes it. Courier's delivery history is an
-- in-process ring buffer (email-server/src/services/emailLog.ts, 1000 entries)
-- which Core proxies through /api/v1/admin/emails/{logs,summary} — so the
-- admin dashboard's history is lost on every redeploy or restart of
-- email-server. This table is the durable replacement; the follow-up work is
-- to make Courier write here on dispatch and Core read here instead of the
-- buffer.
--
-- Even once wired, GoTrue-initiated auth mail (confirmation / recovery /
-- magic-link / invite / email-change) will NOT appear: it goes straight to
-- Haraka over SMTP and never touches the Courier HTTP API. Only mail that
-- flows through POST /api/v1/send can be captured.
--
-- Service-role-only posture like 0017/0018: RLS enabled, ZERO client policies.
-- Core will read this table through /api/v1/admin/emails (service role) and
-- email-server will write via service-role key. The browser never touches
-- Vault directly.

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
