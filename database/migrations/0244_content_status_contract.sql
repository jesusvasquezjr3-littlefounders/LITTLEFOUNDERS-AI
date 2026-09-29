-- 0243_content_status_contract.sql — GAP-FIX-R5 staff-ops: a course or
-- lesson status changes only through the audited, actor-named functions.
-- @phase: contract
-- @after-release: the Core release of GAP-FIX-R5 staff-ops, whose staff
-- content and moderation routes call release_course(actor, course),
-- release_lesson(actor, lesson), set_course_status and set_lesson_status
-- (0242) instead of the one-argument releases and a status PATCH, and the
-- matching database/scripts/publish-course.sh. An older Core would get
-- "function does not exist" from its release and a refusal from its status
-- PATCH. Apply after 0242 and after that Core release; never by auto-apply.
--
-- Product G.3 ("No staff moderation decision affecting content a child will
-- see may go unrecorded in the central Audit Log"), Appendix N 1.2 (the
-- publish event log is the audit log, from the staff console and the CLI).
--
-- 1. The one-argument release_course(uuid) and release_lesson(uuid), which
--    take no actor and write no audit row, are dropped: no caller can release
--    without naming a staff actor any more.
-- 2. guard_release_only_publication (0113) now refuses, for the API roles
--    (anon, authenticated, service_role), EVERY status change of a course or
--    a lesson, not only publication, with one exception: the Forge pipeline's
--    upsert of a lesson into 'review' (new content entering the human gate,
--    coursegen/src/pipeline/publish.ts). A published lesson demoted that way
--    (the explicit `demote-to-review`) leaves the learner catalog, so the
--    trigger records it ('content.lesson.demoted', no staff actor) in the same
--    statement. Inserting a row that is not 'published' stays allowed
--    (creation is not a decision). The security-definer functions of 0242 run
--    as the owner and pass; migrations, seeds and operator psql sessions run
--    as the database owner and stay outside the guard (0113's design).
--
-- Proven on native PostgreSQL by database/scripts/verify-course-publish-postgres.py.

drop function if exists public.release_course(uuid);
drop function if exists public.release_lesson(uuid);

create or replace function public.guard_release_only_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated', 'service_role') then
    return new;
  end if;
  -- OLD is only read on UPDATE: an INSERT has no previous row.
  if tg_op = 'INSERT' then
    if new.status is not distinct from 'published' then
      raise exception using
        errcode = '42501',
        message = format('%s.status can only become published through release_course or release_lesson', tg_table_name);
    end if;
    return new;
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status = 'published' then
    raise exception using
      errcode = '42501',
      message = format('%s.status can only become published through release_course or release_lesson', tg_table_name);
  end if;
  if tg_table_name = 'lessons' and new.status = 'review' then
    if old.status = 'published' then
      insert into public.audit_logs (actor_id, action, subject, detail)
      values (null, 'content.lesson.demoted', new.id::text, jsonb_build_object('from', old.status, 'to', new.status, 'via', current_user));
    end if;
    return new;
  end if;
  raise exception using
    errcode = '42501',
    message = format('%s.status changes only through set_course_status or set_lesson_status (audited, with a staff actor)', tg_table_name);
end;
$$;

revoke all on function public.guard_release_only_publication() from public, anon, authenticated;

select 'migration_content_status_contract_ok' as sentinel;
