-- 0031_course_release_gate.sql -- atomic, human-triggered course release.
--
-- Forge writes courses/adventures/sagas/topics as draft and lessons as review.
-- Client visibility requires every level of that hierarchy to be published
-- (0007). A direct PATCH of courses.status therefore creates a false release:
-- the course says "published" while no learner can read its descendants.
--
-- This RPC is the only supported bulk release path. It is deliberately a
-- preflight plus one transaction: it refuses an incomplete locale set, an
-- unreviewable lesson, or content that has not passed Forge's full acceptance
-- check since its last document update. Core performs the authenticated staff
-- action and audit log; Forge records the verification, never the release.

create table if not exists public.course_release_verifications (
  course_id uuid primary key references public.courses (id) on delete cascade,
  verified_at timestamptz not null default now(),
  checks jsonb not null default '[]'::jsonb
);

alter table public.course_release_verifications enable row level security;
-- Service role only. A release attestation is internal operational metadata,
-- not learner-facing content and not a client-readable approval signal.

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
  v_ineligible_lessons integer := 0;
  v_incomplete_locale_lessons integer := 0;
  v_last_document_update timestamptz;
  v_verified_at timestamptz;
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

  -- Hold every existing descendant through the preflight and state transition.
  -- Without these row locks, a concurrent Forge document update could land
  -- after `max(updated_at)` is read but before the hierarchy becomes visible,
  -- bypassing the fresh-verification requirement for that new content.
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

  select v.verified_at into v_verified_at
  from public.course_release_verifications v
  where v.course_id = p_course_id;

  if v_verified_at is null or (v_last_document_update is not null and v_verified_at < v_last_document_update) then
    return query select false, 'VERIFICATION_REQUIRED', 'Run Forge verify:course successfully after the latest document change before release.', 0, 0, 0, 0;
    return;
  end if;

  update public.lessons l
  set status = 'published'
  from public.topics t, public.sagas s, public.adventures a
  where l.topic_id = t.id
    and t.saga_id = s.id
    and s.adventure_id = a.id
    and a.course_id = p_course_id
    and l.status <> 'published';
  get diagnostics lessons_published = row_count;

  update public.topics t
  set status = 'published'
  from public.sagas s, public.adventures a
  where t.saga_id = s.id
    and s.adventure_id = a.id
    and a.course_id = p_course_id
    and t.status <> 'published';
  get diagnostics topics_published = row_count;

  update public.sagas s
  set status = 'published'
  from public.adventures a
  where s.adventure_id = a.id
    and a.course_id = p_course_id
    and s.status <> 'published';
  get diagnostics sagas_published = row_count;

  update public.adventures a
  set status = 'published'
  where a.course_id = p_course_id
    and a.status <> 'published';
  get diagnostics adventures_published = row_count;

  update public.courses
  set status = 'published'
  where id = p_course_id;

  return query select true, 'RELEASED', 'Course hierarchy released.', adventures_published, sagas_published, topics_published, lessons_published;
end;
$$;

revoke all on function public.release_course(uuid) from public, anon, authenticated;
grant execute on function public.release_course(uuid) to service_role;
