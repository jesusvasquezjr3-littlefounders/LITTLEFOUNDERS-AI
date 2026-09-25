-- 0113_release_only_publication.sql — S05.4c lane review: content becomes
-- child-visible only through the verified release preflight.
-- @phase: contract
-- @after-release: the Core release of S05.4c, whose staff lesson-approval
-- route calls release_lesson instead of patching lessons.status, and the Forge
-- release of S05.4c, which no longer offers the in-place `keep-published`
-- swap. This narrows who may write lessons.status = 'published',
-- courses.status = 'published' and lesson_document_version_current: an older
-- Core would get a refusal from its lesson "Approve" action. Apply it with (or
-- after) those releases, and after the release-gate-manifest migration that
-- defines forge_release_verification_refusal; never by auto-apply.
--
-- Product G.2: "No path to production content for children should exist that
-- is structurally exempt from the same gates the primary interface enforces."
-- The lane review of S05.4 found three such paths after the release-gate
-- manifest was wired into release_course:
--
-- 1. The staff console's lesson "Approve" (Core POST
--    /admin/moderation/:lessonId/status with status=published) patched
--    lessons.status directly. A regenerated lesson in an already-live course
--    became visible with no Forge verification at all.
-- 2. Any service-role caller (a script, a future tool) could do the same with
--    one PATCH, for lessons or for a whole course.
-- 3. lesson_document_version_current (0101) is the pointer that decides which
--    immutable v2 document a learner is served. Nothing stopped a service-role
--    write from moving it on a published lesson, swapping live content with no
--    verification.
--
-- This migration:
-- a. adds `release_lesson(lesson_id)`: publishes ONE review lesson of an
--    already-live course through the same verification preflight as
--    release_course (forge_release_verification_refusal), after the same
--    locale and reviewability checks. A lesson whose course or section is not
--    live yet is refused with COURSE_RELEASE_REQUIRED: release the course.
-- b. refuses, for the API roles (anon, authenticated, service_role), any write
--    that makes a lesson or a course 'published'. release_course and
--    release_lesson are SECURITY DEFINER, so their writes run as the function
--    owner and pass; migrations, seeds and operator psql sessions run as the
--    database owner and are outside this guard by design (they are not an API
--    path, and the local publish command already calls release_course).
-- c. refuses, for the same roles, activating or moving the v2 pointer of a
--    published lesson. A future reviewed publication transaction (0101) is the
--    only path for live v2 content; activating a version on a lesson in review
--    stays possible and is covered by the release preflight, which now counts
--    v2 activations as content changes.

create or replace function public.release_lesson(
  p_lesson_id uuid
)
returns table (
  ok boolean,
  code text,
  message text,
  lessons_published integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
  v_course_status text;
  v_lesson_status text;
  v_parents_live boolean;
  v_locales integer := 0;
  v_refusal_code text;
  v_refusal_message text;
begin
  select a.course_id into v_course_id
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  where l.id = p_lesson_id;

  if v_course_id is null then
    return query select false, 'NOT_FOUND', 'Lesson does not exist.', 0;
    return;
  end if;

  -- Same lock order as release_course (course first), so a lesson release and
  -- a course release of the same course serialize instead of deadlocking.
  select c.status into v_course_status
  from public.courses c
  where c.id = v_course_id
  for update;

  select l.status into v_lesson_status
  from public.lessons l
  where l.id = p_lesson_id
  for update;

  perform 1 from public.lesson_documents d where d.lesson_id = p_lesson_id for update;
  perform 1 from public.lesson_document_version_current p where p.lesson_id = p_lesson_id for update;

  if v_course_status = 'archived' then
    return query select false, 'ARCHIVED', 'An archived course must be restored to draft before release.', 0;
    return;
  end if;

  if v_lesson_status = 'published' then
    return query select true, 'RELEASED', 'Lesson is already published.', 0;
    return;
  end if;

  if v_lesson_status <> 'review' then
    return query select false, 'LESSONS_NOT_REVIEWABLE', 'The lesson must be in review before release.', 0;
    return;
  end if;

  select c.status = 'published' and a.status = 'published' and s.status = 'published' and t.status = 'published'
    into v_parents_live
  from public.lessons l
  join public.topics t on t.id = l.topic_id
  join public.sagas s on s.id = t.saga_id
  join public.adventures a on a.id = s.adventure_id
  join public.courses c on c.id = a.course_id
  where l.id = p_lesson_id;

  if not coalesce(v_parents_live, false) then
    return query select false, 'COURSE_RELEASE_REQUIRED',
      'This lesson''s course or section is not live yet. Release the whole course instead.', 0;
    return;
  end if;

  select count(*) filter (where d.locale in ('en-US', 'es-MX', 'pt-BR'))::integer into v_locales
  from public.lesson_documents d
  where d.lesson_id = p_lesson_id;

  if v_locales <> 3 then
    return query select false, 'INCOMPLETE_LOCALES', 'The lesson needs exactly one document for en-US, es-MX, and pt-BR before release.', 0;
    return;
  end if;

  select r.code, r.message into v_refusal_code, v_refusal_message
  from public.forge_release_verification_refusal(v_course_id) as r;

  if v_refusal_code is not null then
    return query select false, v_refusal_code, v_refusal_message, 0;
    return;
  end if;

  update public.lessons l
  set status = 'published'
  where l.id = p_lesson_id
    and l.status = 'review';
  get diagnostics lessons_published = row_count;

  if lessons_published <> 1 then
    raise exception 'release_lesson: lesson % changed concurrently; release rolled back', p_lesson_id;
  end if;

  return query select true, 'RELEASED', 'Lesson released.', lessons_published;
end;
$$;

revoke all on function public.release_lesson(uuid) from public, anon, authenticated;
grant execute on function public.release_lesson(uuid) to service_role;

-- b. Publication is a release, never a status write.
create or replace function public.guard_release_only_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_becomes_published boolean;
begin
  if current_user not in ('anon', 'authenticated', 'service_role') or new.status is distinct from 'published' then
    return new;
  end if;
  -- OLD is only read on UPDATE: an INSERT has no previous row.
  if tg_op = 'INSERT' then
    v_becomes_published := true;
  else
    v_becomes_published := old.status is distinct from 'published';
  end if;
  if v_becomes_published then
    raise exception using
      errcode = '42501',
      message = format('%s.status can only become published through release_course or release_lesson', tg_table_name);
  end if;
  return new;
end;
$$;

revoke all on function public.guard_release_only_publication() from public, anon, authenticated;

drop trigger if exists lessons_release_only_publication on public.lessons;
create trigger lessons_release_only_publication
  before insert or update of status on public.lessons
  for each row execute function public.guard_release_only_publication();

drop trigger if exists courses_release_only_publication on public.courses;
create trigger courses_release_only_publication
  before insert or update of status on public.courses
  for each row execute function public.guard_release_only_publication();

-- c. Live v2 content moves only through a reviewed publication transaction.
create or replace function public.guard_live_v2_activation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_live boolean;
begin
  if current_user not in ('anon', 'authenticated', 'service_role') then
    return new;
  end if;
  select exists (select 1 from public.lessons l where l.id = new.lesson_id and l.status = 'published') into v_live;
  -- Moving a pointer AWAY from a published lesson is also a live change.
  if not v_live and tg_op = 'UPDATE' then
    select exists (select 1 from public.lessons l where l.id = old.lesson_id and l.status = 'published') into v_live;
  end if;
  if v_live then
    raise exception using
      errcode = '42501',
      message = 'the v2 document of a published lesson changes only through a reviewed publication transaction';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_live_v2_activation() from public, anon, authenticated;

drop trigger if exists lesson_document_version_current_live_guard on public.lesson_document_version_current;
create trigger lesson_document_version_current_live_guard
  before insert or update on public.lesson_document_version_current
  for each row execute function public.guard_live_v2_activation();
