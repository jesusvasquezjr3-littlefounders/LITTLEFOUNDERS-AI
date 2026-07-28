-- 0021_email_logs.sql — transactional email audit trail.
-- email-server (Courier) writes one row per dispatched email so the admin
-- dashboard has a Resend-style delivery history. GoTrue-initiated auth mail
-- (which goes straight to Haraka over SMTP, bypassing the Courier HTTP API)
-- is NOT captured here — only emails that flow through POST /api/v1/send.
--
-- Service-role-only posture like 0017/0018: RLS enabled, ZERO client policies.
-- Core reads this table through /api/v1/admin/emails (service role); email-server
-- writes via service-role API key. The browser never touches Vault directly.

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
