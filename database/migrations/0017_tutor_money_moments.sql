-- 0017_tutor_money_moments.sql — Oracle v1: Money Moments (situation-driven
-- micro-lessons, Little Language Lessons' Tiny Lesson pattern made §1.9-safe).
--
-- The kid picks from a CURATED, locale-aware situation taxonomy (closed set —
-- no kid free text ever reaches a third-party API); packs are generated
-- OFFLINE by Forge per situation×tier×locale, pass validation + the judge,
-- land as status='review', and a human publishes. "On demand" at runtime is
-- really "served from this pre-gated pool" — zero ungated AI in front of a
-- child, zero latency.
--
-- Service-role only, like lesson_documents: RLS enabled with NO client
-- policies — Core brokers reads (locale/tier resolution + published filter),
-- and only Forge writes.

create table if not exists tutor_situations (
  id          text primary key,
  icon        text not null,
  title       jsonb not null default '{}'::jsonb,
  description jsonb not null default '{}'::jsonb,
  tiers       jsonb not null default '[]'::jsonb,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table tutor_situations enable row level security;

create table if not exists tutor_packs (
  id           uuid primary key default gen_random_uuid(),
  situation_id text not null references tutor_situations (id) on delete cascade,
  tier         text not null,
  locale       text not null,
  pack         jsonb not null,
  status       text not null default 'review',
  created_at   timestamptz not null default now(),
  unique (situation_id, tier, locale)
);

do $$ begin
  alter table tutor_packs add constraint tutor_packs_status_check
    check (status in ('review', 'published', 'archived'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table tutor_packs add constraint tutor_packs_locale_check
    check (locale in ('en-US', 'es-MX', 'pt-BR'));
exception when duplicate_object then null; end $$;

alter table tutor_packs enable row level security;

create index if not exists tutor_packs_situation_idx on tutor_packs (situation_id, tier, locale);
