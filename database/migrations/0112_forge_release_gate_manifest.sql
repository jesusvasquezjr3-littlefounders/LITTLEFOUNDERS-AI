-- 0112_forge_release_gate_manifest.sql — S05.4c: every Forge release gate is
-- part of the one release preflight Core and the local publish command share.
-- @phase: contract
-- @after-release: the S05.4c Forge verify:course (per-gate attestation plus
-- content watermark) and the S05.4c Core (maps VERIFICATION_INCOMPLETE). It
-- narrows what unlocks a release: every course must be verified again before
-- its next release. Nothing is removed. Apply by hand, never by auto-apply.
--
-- Product G.2: no path to child-visible content may be exempt from the gates.
-- Before this migration release_course (0031) never read the attestation's
-- `checks`, so a pre-gate-11 Forge or a hand-written row unlocked a release.
--
-- 1. `forge_release_gates`: the required release checks, seeded from
--    coursegen/src/release/gateManifest.ts (parity: agent/tools/
--    check-forge-release-gate-parity.mjs). A new gate is a new migration row.
-- 2. `forge_release_verification_refusal`: the verification half of the
--    preflight, shared with release_lesson. VERIFICATION_REQUIRED unless the
--    attestation is fresh and carries the current content watermark;
--    VERIFICATION_INCOMPLETE unless every required id has "ok": true and no
--    entry failed.
-- 3. `verified_at` is stamped with the database clock (operator clocks lie).
-- 4. `forge_release_content_watermark`: latest document change or v2
--    activation. verify:course captures it BEFORE reading, so a change made
--    while it runs cannot ride on its attestation.

create table if not exists public.forge_release_gates (
  gate_id text primary key check (gate_id ~ '^forge\.[a-z0-9][a-z0-9.-]{2,80}$'),
  gate_number smallint check (gate_number between 1 and 99),
  spec_refs text[] not null default '{}',
  description text not null check (length(description) between 3 and 200),
  added_at timestamptz not null default now()
);

alter table public.forge_release_gates enable row level security;
-- Service role only (no policy): release requirements are operational
-- metadata, read by the SECURITY DEFINER release_course function.

insert into public.forge_release_gates (gate_id, gate_number, spec_refs, description) values
  ('forge.catalog.loads', null, array['G.2'], 'Catalog loads with no errors'),
  ('forge.catalog.progression', null, array['G.2'], 'Pedagogical progression has no errors'),
  ('forge.catalog.concept-cap', null, array['B.17'], 'Every lesson declares its new concepts within the age ceiling'),
  ('forge.catalog.mentor-misjudgment', null, array['B.11'], 'The course meets the mentor-misjudgment episode minimum'),
  ('forge.catalog.regional-adaptation', null, array['B.16'], 'Every lesson with market context declares its market scenarios'),
  ('forge.catalog.tone', null, array['B.14'], 'Catalog titles, descriptions and tips pass the Law 2 tone gate'),
  ('forge.catalog.copy-budget', null, array['OD-13'], 'Catalog titles, descriptions and tips meet the Copy Budget'),
  ('forge.gate.01.contract', 1, array['AppC-S2.8'], 'Gate 1: lesson contract'),
  ('forge.gate.02.age-vocabulary', 2, array['AppC-S2.8'], 'Gate 2: age-tier vocabulary'),
  ('forge.gate.03.currency-facts', 3, array['AppC-S2.8'], 'Gate 3: currency facts'),
  ('forge.gate.04.arithmetic', 4, array['AppC-S2.8'], 'Gate 4: arithmetic re-execution'),
  ('forge.gate.05.rationale-canon', 5, array['AppC-S2.8'], 'Gate 5: rationale and character canon'),
  ('forge.gate.06.anti-genericity', 6, array['AppC-S2.8'], 'Gate 6: anti-genericity'),
  ('forge.gate.07.generation-quality', 7, array['AppC-S2.8'], 'Gate 7: generation quality'),
  ('forge.gate.08.clarity', 8, array['AppC-S2.8'], 'Gate 8: clarity and visual-first'),
  ('forge.gate.09.readability', 9, array['AppC-S2.8'], 'Gate 9: readability band'),
  ('forge.gate.11.redundancy', 11, array['B.18'], 'Gate 11: on-screen text versus narration'),
  ('forge.gate.12.tone', 12, array['B.14'], 'Gate 12: Law 2 tone'),
  ('forge.gate.13.copy-budget', 13, array['OD-13'], 'Gate 13: Copy Budget'),
  ('forge.gate.14.concept-cap', 14, array['B.17'], 'Gate 14: concept cap'),
  ('forge.gate.15.mentor-misjudgment', 15, array['B.11'], 'Gate 15: mentor misjudgment episode'),
  ('forge.gate.16.regional-adaptation', 16, array['B.16'], 'Gate 16: regional adaptation'),
  ('forge.release.lessons-complete', null, array['G.2'], 'Every blueprint produced a release-ready lesson'),
  ('forge.release.locales-complete', null, array['G.2'], 'Every release-ready lesson has all three locales'),
  ('forge.release.illustration-style', null, array['G.2'], 'Every document uses the current illustration style'),
  ('forge.release.visual-coverage', null, array['G.2'], 'Every planned visual target has an approved illustration'),
  ('forge.release.distinct-scenes', null, array['G.2'], 'No scene illustration is reused across lessons'),
  ('forge.release.orphan-progress', null, array['G.2'], 'No orphaned lesson carries learner progress'),
  ('forge.release.currency-locale', null, array['B.16'], 'No foreign currency word leaked across locales'),
  ('forge.release.topic-titles', null, array['B.16'], 'Topic titles are present and localized in all three locales'),
  ('forge.release.v2-content', null, array['B.14', 'B.16', 'B.17', 'OD-13'], 'Every activated v2 document passes the Forge content gates')
on conflict (gate_id) do update
  set gate_number = excluded.gate_number,
      spec_refs = excluded.spec_refs,
      description = excluded.description;

create or replace function public.stamp_course_release_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.verified_at := now();
  return new;
end;
$$;

revoke all on function public.stamp_course_release_verification() from public, anon, authenticated;

drop trigger if exists course_release_verifications_stamp on public.course_release_verifications;
create trigger course_release_verifications_stamp
  before insert or update on public.course_release_verifications
  for each row execute function public.stamp_course_release_verification();

-- 4. The content watermark: what verify:course verified, captured before it
-- reads. Service role only; `release_course` and `release_lesson` compute the
-- same value through forge_release_verification_refusal.
alter table public.course_release_verifications
  add column if not exists content_watermark timestamptz;

create or replace function public.forge_release_content_watermark(
  p_course_id uuid
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  -- greatest() ignores nulls: a course with no v2 pointers keeps its latest
  -- document change, and a course with neither returns null.
  select greatest(
    (
      select max(d.updated_at)
      from public.lesson_documents d
      join public.lessons l on l.id = d.lesson_id
      join public.topics t on t.id = l.topic_id
      join public.sagas s on s.id = t.saga_id
      join public.adventures a on a.id = s.adventure_id
      where a.course_id = p_course_id
    ),
    -- Activating a v2 document version changes what a learner is served just
    -- like a v1 document update does, so it also needs a fresh verification.
    (
      select max(p.activated_at)
      from public.lesson_document_version_current p
      join public.lessons l on l.id = p.lesson_id
      join public.topics t on t.id = l.topic_id
      join public.sagas s on s.id = t.saga_id
      join public.adventures a on a.id = s.adventure_id
      where a.course_id = p_course_id
    )
  );
$$;

revoke all on function public.forge_release_content_watermark(uuid) from public, anon, authenticated;
grant execute on function public.forge_release_content_watermark(uuid) to service_role;

-- The verification half of the release preflight, shared by release_course
-- (this file) and release_lesson (the release-only publication migration).
-- Returns no row when the course's Forge verification is complete, or one
-- (code, message) refusal row. Callers hold row locks on the content first.
create or replace function public.forge_release_verification_refusal(
  p_course_id uuid
)
returns table (
  code text,
  message text
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_last_change timestamptz;
  v_verified_at timestamptz;
  v_watermark timestamptz;
  v_checks jsonb;
  v_missing_gates integer := 0;
  v_failed_checks integer := 0;
begin
  -- The latest document change or v2 activation of the course.
  v_last_change := public.forge_release_content_watermark(p_course_id);

  select v.verified_at, v.checks, v.content_watermark into v_verified_at, v_checks, v_watermark
  from public.course_release_verifications v
  where v.course_id = p_course_id;

  if v_verified_at is null or (v_last_change is not null and v_verified_at < v_last_change) then
    return query select 'VERIFICATION_REQUIRED'::text,
      'Run Forge verify:course successfully after the latest document change before release.'::text;
    return;
  end if;

  -- The attestation covers exactly the content verify:course read: the
  -- watermark it captured before reading must still be the current one. A
  -- change that landed while it was running (or an attestation with no
  -- watermark) needs a new verification.
  if v_watermark is distinct from v_last_change then
    return query select 'VERIFICATION_REQUIRED'::text,
      'The course changed while Forge verify:course was running. Run it again before release.'::text;
    return;
  end if;

  -- S05.4c (Product G.2, Appendix C Stage 2): the attestation must name every
  -- Forge release gate this database requires, each with ok = true, and carry
  -- no failed or malformed entry. An attestation written by a Forge that
  -- predates a gate, or a hand-written row that does not attest every gate,
  -- cannot unlock a release. (A service-role holder who forges a complete
  -- attestation is outside what the database can tell apart; that trust
  -- boundary is the service-role key itself.)
  if v_checks is null or jsonb_typeof(v_checks) <> 'array' then
    v_checks := '[]'::jsonb;
  end if;

  select count(*)::integer into v_failed_checks
  from jsonb_array_elements(v_checks) as e(item)
  where jsonb_typeof(e.item) <> 'object'
     or (e.item -> 'ok') is distinct from 'true'::jsonb;

  select count(*)::integer into v_missing_gates
  from public.forge_release_gates r
  where not exists (
    select 1
    from jsonb_array_elements(v_checks) as e(item)
    where jsonb_typeof(e.item) = 'object'
      and e.item ->> 'gate' = r.gate_id
      and (e.item -> 'ok') = 'true'::jsonb
  );

  if v_failed_checks > 0 or v_missing_gates > 0 then
    return query select 'VERIFICATION_INCOMPLETE'::text,
      format('The Forge verification does not attest every required release gate (%s missing, %s failed). Run the current Forge verify:course again.',
             v_missing_gates, v_failed_checks);
    return;
  end if;
end;
$$;

revoke all on function public.forge_release_verification_refusal(uuid) from public, anon, authenticated;

-- release_course: 0031 with the shared verification preflight (freshness,
-- v2 activations and every required Forge gate) and v2 pointers locked and
-- recounted like documents.
create or replace function public.release_course(
  p_course_id uuid
)
returns table (
  ok boolean,
  code text,
  message text,
  adventures_published integer,
  sagas_published integer,
  topics_published integer,
  lessons_published integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_status text;
  v_adventures integer := 0;
  v_sagas integer := 0;
  v_topics integer := 0;
  v_lessons integer := 0;
  v_documents integer := 0;
  v_ineligible_lessons integer := 0;
  v_incomplete_locale_lessons integer := 0;
  v_last_document_update timestamptz;
  v_v2_pointers integer := 0;
  v_last_v2_activation timestamptz;
  v_refusal_code text;
  v_refusal_message text;
  v_adventures_after integer := 0;
  v_adventures_unpublished integer := 0;
  v_sagas_after integer := 0;
  v_sagas_unpublished integer := 0;
  v_topics_after integer := 0;
  v_topics_unpublished integer := 0;
  v_lessons_after integer := 0;
  v_lessons_unpublished integer := 0;
  v_documents_after integer := 0;
  v_last_document_update_after timestamptz;
  v_v2_pointers_after integer := 0;
  v_last_v2_activation_after timestamptz;
begin
  select c.status
    into v_course_status
  from public.courses c
  where c.id = p_course_id
  for update;

  if not found then
    return query select false, 'NOT_FOUND', 'Course does not exist.', 0, 0, 0, 0;
    return;
  end if;

  if v_course_status = 'archived' then
    return query select false, 'ARCHIVED', 'An archived course must be restored to draft before release.', 0, 0, 0, 0;
    return;
  end if;

  -- Row locks, qualified publishing UPDATEs and the recount are 0031's
  -- concurrency design (see its comments); v2 pointers are now locked too.
  perform 1 from public.adventures a where a.course_id = p_course_id for update;
  perform 1
  from public.sagas s
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id
  for update of s;
  perform 1
  from public.topics t
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id
  for update of t;
  perform 1
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id
  for update of l;
  perform 1
  from public.lesson_documents d
  join public.lessons l on l.id = d.lesson_id
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id
  for update of d;
  perform 1
  from public.lesson_document_version_current p
  join public.lessons l on l.id = p.lesson_id
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id
  for update of p;

  select count(*)::integer into v_adventures
  from public.adventures a
  where a.course_id = p_course_id;

  select count(*)::integer into v_sagas
  from public.sagas s
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  select count(*)::integer into v_topics
  from public.topics t
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  select count(*)::integer into v_lessons
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  select count(*)::integer into v_documents
  from public.lesson_documents d
  join public.lessons l on l.id = d.lesson_id
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  if v_adventures = 0 or v_sagas = 0 or v_topics = 0 or v_lessons = 0 then
    return query select false, 'INCOMPLETE_HIERARCHY', 'A releasable course needs at least one adventure, saga, topic, and lesson.', 0, 0, 0, 0;
    return;
  end if;

  select count(*)::integer into v_ineligible_lessons
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id
    and l.status not in ('review', 'published');

  if v_ineligible_lessons > 0 then
    return query select false, 'LESSONS_NOT_REVIEWABLE', 'Every lesson must be in review or already published before release.', 0, 0, 0, 0;
    return;
  end if;

  select count(*)::integer into v_incomplete_locale_lessons
  from (
    select l.id
    from public.lessons l
    join public.topics t on t.id = l.topic_id
    join public.sagas s on s.id = t.saga_id
    join public.adventures a on a.id = s.adventure_id
    left join public.lesson_documents d on d.lesson_id = l.id
    where a.course_id = p_course_id
    group by l.id
    having count(*) filter (where d.locale in ('en-US', 'es-MX', 'pt-BR')) <> 3
  ) as incomplete_lessons;

  if v_incomplete_locale_lessons > 0 then
    return query select false, 'INCOMPLETE_LOCALES', 'Every lesson needs exactly one document for en-US, es-MX, and pt-BR before release.', 0, 0, 0, 0;
    return;
  end if;

  select max(d.updated_at) into v_last_document_update
  from public.lesson_documents d
  join public.lessons l on l.id = d.lesson_id
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  select count(*)::integer, max(p.activated_at)
    into v_v2_pointers, v_last_v2_activation
  from public.lesson_document_version_current p
  join public.lessons l on l.id = p.lesson_id
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  -- One verification preflight, shared with release_lesson: fresh after the
  -- latest document change or v2 activation, and attesting every required
  -- Forge release gate (S05.4c).
  select r.code, r.message into v_refusal_code, v_refusal_message
  from public.forge_release_verification_refusal(p_course_id) as r;

  if v_refusal_code is not null then
    return query select false, v_refusal_code, v_refusal_message, 0, 0, 0, 0;
    return;
  end if;

  -- Publish only preflight-qualified rows (0031).
  update public.lessons l
  set status = 'published'
  from public.topics t, public.sagas s, public.adventures a
  where l.topic_id = t.id
    and t.saga_id = s.id
    and s.adventure_id = a.id
    and a.course_id = p_course_id
    and l.status = 'review'
    and (
      select count(*) filter (where d.locale in ('en-US', 'es-MX', 'pt-BR'))
      from public.lesson_documents d
      where d.lesson_id = l.id
    ) = 3;
  get diagnostics lessons_published = row_count;

  update public.topics t
  set status = 'published'
  from public.sagas s, public.adventures a
  where t.saga_id = s.id
    and s.adventure_id = a.id
    and a.course_id = p_course_id
    and t.status <> 'published'
    and not exists (
      select 1 from public.lessons l
      where l.topic_id = t.id
        and l.status <> 'published'
    );
  get diagnostics topics_published = row_count;

  update public.sagas s
  set status = 'published'
  from public.adventures a
  where s.adventure_id = a.id
    and a.course_id = p_course_id
    and s.status <> 'published'
    and not exists (
      select 1 from public.topics t
      where t.saga_id = s.id
        and t.status <> 'published'
    );
  get diagnostics sagas_published = row_count;

  update public.adventures a
  set status = 'published'
  where a.course_id = p_course_id
    and a.status <> 'published'
    and not exists (
      select 1 from public.sagas s
      where s.adventure_id = a.id
        and s.status <> 'published'
    );
  get diagnostics adventures_published = row_count;

  -- Recount before the course row flips; any concurrent change rolls back (0031).
  select count(*)::integer,
         count(*) filter (where l.status <> 'published')::integer
    into v_lessons_after, v_lessons_unpublished
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  select count(*)::integer,
         count(*) filter (where t.status <> 'published')::integer
    into v_topics_after, v_topics_unpublished
  from public.topics t
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  select count(*)::integer,
         count(*) filter (where s.status <> 'published')::integer
    into v_sagas_after, v_sagas_unpublished
  from public.sagas s
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  select count(*)::integer,
         count(*) filter (where a.status <> 'published')::integer
    into v_adventures_after, v_adventures_unpublished
  from public.adventures a
  where a.course_id = p_course_id;

  select count(*)::integer, max(d.updated_at)
    into v_documents_after, v_last_document_update_after
  from public.lesson_documents d
  join public.lessons l on l.id = d.lesson_id
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  select count(*)::integer, max(p.activated_at)
    into v_v2_pointers_after, v_last_v2_activation_after
  from public.lesson_document_version_current p
  join public.lessons l on l.id = p.lesson_id
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where a.course_id = p_course_id;

  if v_lessons_after <> v_lessons or v_lessons_unpublished > 0
     or v_topics_after <> v_topics or v_topics_unpublished > 0
     or v_sagas_after <> v_sagas or v_sagas_unpublished > 0
     or v_adventures_after <> v_adventures or v_adventures_unpublished > 0
     or v_documents_after <> v_documents
     or v_last_document_update_after is distinct from v_last_document_update
     or v_v2_pointers_after <> v_v2_pointers
     or v_last_v2_activation_after is distinct from v_last_v2_activation then
    raise exception 'release_course: concurrent content change detected for course % (adventures %/%, sagas %/%, topics %/%, lessons %/%, documents %/%); release rolled back',
      p_course_id,
      v_adventures_after, v_adventures,
      v_sagas_after, v_sagas,
      v_topics_after, v_topics,
      v_lessons_after, v_lessons,
      v_documents_after, v_documents;
  end if;

  update public.courses
  set status = 'published'
  where id = p_course_id;

  return query select true, 'RELEASED', 'Course hierarchy released.', adventures_published, sagas_published, topics_published, lessons_published;
end;
$$;

revoke all on function public.release_course(uuid) from public, anon, authenticated;
grant execute on function public.release_course(uuid) to service_role;
