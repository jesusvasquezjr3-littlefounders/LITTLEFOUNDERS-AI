-- 0241_audited_content_release.sql — GAP-FIX-R5 staff-ops: course and lesson
-- release, rejection and unpublish decisions write their central audit row
-- INSIDE the transaction that makes them, and name a staff actor.
-- @phase: expand
--
-- Product G.3: "No staff moderation decision affecting content a child will
-- see may go unrecorded in the central Audit Log"; Appendix N 1.2 counts
-- 'admin.course.release' and 'admin.lesson.release' rows as the denominator of
-- the Release-Verification Bypass Rate (content_bypass_metrics, 0222).
--
-- Before this migration release_course(uuid) (0112) and release_lesson(uuid)
-- (0113) took no actor, checked no staff grant and wrote no audit row: Core
-- committed the release and then posted the audit row as a separate request
-- whose failure it only logged, and every other status move was a PostgREST
-- PATCH followed by an audit insert whose result was ignored.
--
-- 1. release_course(p_actor, p_course_id) and 2. release_lesson(p_actor,
--    p_lesson_id): the latest bodies (0112, 0113) unchanged, plus a FORBIDDEN
--    refusal unless the actor is a superadmin or an admin holding
--    manage_content (content_release_actor_allowed, 0221), and the audit row
--    in the same transaction. A course retry that changes nothing writes no
--    row. The one-argument signatures stay until the contract migration that
--    follows this one drops them (an older Core still calls them).
-- 3. set_course_status(p_actor, p_course_id, p_status) (draft | archived) and
--    set_lesson_status(p_actor, p_lesson_id, p_status) (draft | review |
--    archived): the same actor rule, the row locked, the move and
--    'admin.course.set_status' / 'admin.lesson.set_status' {status, from}
--    committed together. Publishing is refused here (USE_RELEASE): it is a
--    release. A move to the current status changes nothing and writes nothing.
-- 4. The release-only-publication triggers are re-issued unchanged (the
--    static gate pins them next to the latest release_lesson).
--
-- Proven on native PostgreSQL by database/scripts/verify-course-publish-postgres.py.

-- 1. release_course(actor, course): 0112 with the actor check and the audit row.
create or replace function public.release_course(
  p_actor uuid,
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
  -- G.3: a release names a staff actor who holds the content permission.
  if not public.content_release_actor_allowed(p_actor) then
    return query select false, 'FORBIDDEN', 'Only staff with the content permission may release a course.', 0, 0, 0, 0;
    return;
  end if;

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

  -- G.3 / Appendix N 1.2: the decision and its central audit row commit
  -- together; a failed insert rolls the release back. A retry that
  -- changes nothing is not a new decision and writes nothing.
  if v_course_status <> 'published' or adventures_published + sagas_published + topics_published + lessons_published > 0 then
    insert into public.audit_logs (actor_id, action, subject, detail)
    values (p_actor, 'admin.course.release', p_course_id::text, jsonb_build_object(
      'adventuresPublished', adventures_published, 'sagasPublished', sagas_published,
      'topicsPublished', topics_published, 'lessonsPublished', lessons_published));
  end if;

  return query select true, 'RELEASED', 'Course hierarchy released.', adventures_published, sagas_published, topics_published, lessons_published;
end;
$$;

revoke all on function public.release_course(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_course(uuid, uuid) to service_role;

-- 2. release_lesson(actor, lesson): 0113 with the actor check and the audit row.
create or replace function public.release_lesson(
  p_actor uuid,
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
  if not public.content_release_actor_allowed(p_actor) then
    return query select false, 'FORBIDDEN', 'Only staff with the content permission may release a lesson.', 0;
    return;
  end if;

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

  insert into public.audit_logs (actor_id, action, subject, detail)
  values (p_actor, 'admin.lesson.release', p_lesson_id::text, jsonb_build_object('lessonsPublished', lessons_published));

  return query select true, 'RELEASED', 'Lesson released.', lessons_published;
end;
$$;

revoke all on function public.release_lesson(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_lesson(uuid, uuid) to service_role;

-- 3. Every other status move of a course or a lesson: audited, with its actor.
create or replace function public.set_course_status(
  p_actor uuid,
  p_course_id uuid,
  p_status text
)
returns table (ok boolean, code text, message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
begin
  if not public.content_release_actor_allowed(p_actor) then
    return query select false, 'FORBIDDEN', 'Only staff with the content permission may change a course status.';
    return;
  end if;
  if p_status = 'published' then
    return query select false, 'USE_RELEASE', 'A course is published only through release_course.';
    return;
  end if;
  if p_status is null or p_status not in ('draft', 'archived') then
    return query select false, 'INVALID_STATUS', 'A course status is draft or archived.';
    return;
  end if;

  select c.status into v_from from public.courses c where c.id = p_course_id for update;
  if not found then
    return query select false, 'NOT_FOUND', 'Course does not exist.';
    return;
  end if;
  if v_from = p_status then
    return query select true, 'UNCHANGED', 'The course already has this status.';
    return;
  end if;

  update public.courses c set status = p_status where c.id = p_course_id;
  insert into public.audit_logs (actor_id, action, subject, detail)
  values (p_actor, 'admin.course.set_status', p_course_id::text, jsonb_build_object('status', p_status, 'from', v_from));

  return query select true, 'UPDATED', 'Course status changed.';
end;
$$;

revoke all on function public.set_course_status(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_course_status(uuid, uuid, text) to service_role;

create or replace function public.set_lesson_status(
  p_actor uuid,
  p_lesson_id uuid,
  p_status text
)
returns table (ok boolean, code text, message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from text;
begin
  if not public.content_release_actor_allowed(p_actor) then
    return query select false, 'FORBIDDEN', 'Only staff with the content permission may change a lesson status.';
    return;
  end if;
  if p_status = 'published' then
    return query select false, 'USE_RELEASE', 'A lesson is published only through release_lesson.';
    return;
  end if;
  if p_status is null or p_status not in ('draft', 'review', 'archived') then
    return query select false, 'INVALID_STATUS', 'A lesson status is draft, review or archived.';
    return;
  end if;

  select l.status into v_from from public.lessons l where l.id = p_lesson_id for update;
  if not found then
    return query select false, 'NOT_FOUND', 'Lesson does not exist.';
    return;
  end if;
  if v_from = p_status then
    return query select true, 'UNCHANGED', 'The lesson already has this status.';
    return;
  end if;

  update public.lessons l set status = p_status where l.id = p_lesson_id;
  insert into public.audit_logs (actor_id, action, subject, detail)
  values (p_actor, 'admin.lesson.set_status', p_lesson_id::text, jsonb_build_object('status', p_status, 'from', v_from));

  return query select true, 'UPDATED', 'Lesson status changed.';
end;
$$;

revoke all on function public.set_lesson_status(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_lesson_status(uuid, uuid, text) to service_role;

-- 4. Re-issued unchanged (0113); the contract migration extends the function.
drop trigger if exists lessons_release_only_publication on public.lessons;
create trigger lessons_release_only_publication
  before insert or update of status on public.lessons
  for each row execute function public.guard_release_only_publication();

drop trigger if exists courses_release_only_publication on public.courses;
create trigger courses_release_only_publication
  before insert or update of status on public.courses
  for each row execute function public.guard_release_only_publication();

drop trigger if exists lesson_document_version_current_live_guard on public.lesson_document_version_current;
create trigger lesson_document_version_current_live_guard
  before insert or update on public.lesson_document_version_current
  for each row execute function public.guard_live_v2_activation();

select 'migration_audited_content_release_ok' as sentinel;
