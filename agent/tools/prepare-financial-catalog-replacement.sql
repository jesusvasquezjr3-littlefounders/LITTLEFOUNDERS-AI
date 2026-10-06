-- Owner-authorized replacement of the withdrawn 112-lesson catalog.
-- The verified encrypted local backup is retained outside the repository.
-- Supply psql -v actor_id=<the authorized staff UUID>. Review ends in ROLLBACK.
-- Keep every lesson, version, attempt, mastery record and KC identity.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.courses, public.adventures, public.sagas, public.topics,
  public.lessons, public.kc IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE lf_replacement_actor (id uuid NOT NULL) ON COMMIT DROP;
INSERT INTO lf_replacement_actor VALUES (:'actor_id'::uuid);

DO $replacement$
DECLARE
  v_actor uuid := (SELECT id FROM lf_replacement_actor);
  v_course uuid := '229108e1-4e81-5636-aae6-f0dc74249569';
  v_result record;
  v_topics integer;
  v_sagas integer;
  v_adventures integer;
  v_bridges integer;
BEGIN
  IF NOT public.content_release_actor_allowed(v_actor) THEN
    RAISE EXCEPTION 'An authorized content staff actor is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id=v_course
      AND slug='financial-education' AND status IN ('archived','draft')) THEN
    RAISE EXCEPTION 'Only the withdrawn course may be prepared; never demote a live replacement';
  END IF;
  CREATE TEMP TABLE lf_retired_lessons ON COMMIT DROP AS
    SELECT l.id,l.topic_id FROM public.lessons l
    JOIN public.topics t ON t.id=l.topic_id
    JOIN public.sagas s ON s.id=t.saga_id
    JOIN public.adventures a ON a.id=s.adventure_id
    WHERE a.course_id=v_course AND l.status='archived';
  IF (SELECT count(*) FROM lf_retired_lessons)<>112
     OR (SELECT md5(string_agg(id::text,',' ORDER BY id)) FROM lf_retired_lessons)
       IS DISTINCT FROM '63c9a8f881af30e7fe44cd02760d6629' THEN
    RAISE EXCEPTION 'Withdrawn lesson identities differ from the verified local backup';
  END IF;
  IF EXISTS (SELECT 1 FROM public.lessons l WHERE l.topic_id IN
      (SELECT topic_id FROM lf_retired_lessons) AND l.status<>'archived') THEN
    RAISE EXCEPTION 'A retired topic now contains a non-archived lesson';
  END IF;
  CREATE TEMP TABLE lf_retired_topics ON COMMIT DROP AS
    SELECT t.id,t.saga_id,t.slug FROM public.topics t
    WHERE t.id IN (SELECT topic_id FROM lf_retired_lessons);
  UPDATE public.topics t SET status='archived'
    WHERE t.id IN (SELECT id FROM lf_retired_topics) AND t.status<>'archived';
  GET DIAGNOSTICS v_topics=ROW_COUNT;
  UPDATE public.sagas s SET status='archived'
    WHERE s.id IN (SELECT saga_id FROM lf_retired_topics) AND s.status<>'archived'
      AND NOT EXISTS (SELECT 1 FROM public.topics t WHERE t.saga_id=s.id AND t.status<>'archived');
  GET DIAGNOSTICS v_sagas=ROW_COUNT;
  UPDATE public.adventures a SET status='archived'
    WHERE a.course_id=v_course AND a.status<>'archived'
      AND EXISTS (SELECT 1 FROM public.sagas s JOIN lf_retired_topics t ON t.saga_id=s.id WHERE s.adventure_id=a.id)
      AND NOT EXISTS (SELECT 1 FROM public.sagas s WHERE s.adventure_id=a.id AND s.status<>'archived');
  GET DIAGNOSTICS v_adventures=ROW_COUNT;
  -- An absent content bridge is explicit. Do not invent equivalence between old
  -- and new competencies or change active status, prerequisite edges or mastery.
  UPDATE public.kc k SET skill_key=NULL,updated_at=now()
    WHERE k.skill_key IN (SELECT 'financial-education/'||slug FROM lf_retired_topics)
      AND NOT EXISTS (SELECT 1 FROM public.topics t JOIN public.sagas s ON s.id=t.saga_id
        JOIN public.adventures a ON a.id=s.adventure_id
        WHERE a.course_id=v_course AND 'financial-education/'||t.slug=k.skill_key AND t.status<>'archived');
  GET DIAGNOSTICS v_bridges=ROW_COUNT;
  SELECT * INTO v_result FROM public.set_course_status(v_actor,v_course,'draft');
  IF NOT v_result.ok THEN RAISE EXCEPTION 'Course preparation refused: %',v_result.code; END IF;
  IF v_topics+v_sagas+v_adventures+v_bridges>0 THEN
    INSERT INTO public.audit_logs(actor_id,action,subject,detail)
    VALUES(v_actor,'content.retired_catalog_prepared',v_course::text,
      jsonb_build_object('retired_lessons',112,'lesson_identity_md5','63c9a8f881af30e7fe44cd02760d6629',
        'topics_archived',v_topics,'sagas_archived',v_sagas,'adventures_archived',v_adventures,
        'retired_bridges_cleared',v_bridges,'learner_history_preserved',true));
  END IF;
END
$replacement$;
-- Replace only this final ROLLBACK with COMMIT after the release prerequisites pass.
ROLLBACK;
