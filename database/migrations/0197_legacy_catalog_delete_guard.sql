-- @phase: expand
-- legacy_catalog_delete_guard — OD-24 with OD-9 section 4.1: the legacy
-- catalog is retired by ARCHIVING, never by deleting, because every earned
-- record hangs off it with ON DELETE CASCADE: lesson_progress and
-- placement_credits (lesson), course_placements, placement_credits and
-- course_pathway_badges (course). One DELETE of a course would erase the
-- progress, placements and frozen badges OD-9 promises to keep, and until now
-- the only thing preventing it was a sentence in the toolkit README.
--
-- A BEFORE DELETE trigger on lessons, topics and courses refuses (23503,
-- LEGACY_RECORDS_KEPT) deleting a row that any learner record depends on:
--   lessons  lesson_progress or placement_credits of that lesson;
--   topics   placement_credits of that topic, or a lesson of it with progress
--            or a placement credit;
--   courses  course_placements, placement_credits or course_pathway_badges of
--            that course, or progress on any of its lessons.
-- It applies to every role, the database owner included: there is no product
-- or operator path that deletes a catalog row with learners on it (the OD-9
-- toolkit's `retire-catalog` archives). A row nobody learned from can still be
-- deleted (drafts, fixtures). Deleting an adventure or saga cascades to its
-- topics and lessons, so the same guard fires there too.
--
-- Additive: one function, three triggers.

CREATE OR REPLACE FUNCTION public.guard_catalog_learner_records()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_kept boolean;
BEGIN
    IF TG_TABLE_NAME = 'lessons' THEN
        v_kept := EXISTS (SELECT 1 FROM public.lesson_progress p WHERE p.lesson_id = OLD.id)
               OR EXISTS (SELECT 1 FROM public.placement_credits c WHERE c.lesson_id = OLD.id);
    ELSIF TG_TABLE_NAME = 'topics' THEN
        v_kept := EXISTS (SELECT 1 FROM public.placement_credits c WHERE c.topic_id = OLD.id)
               OR EXISTS (SELECT 1 FROM public.lessons l JOIN public.lesson_progress p ON p.lesson_id = l.id WHERE l.topic_id = OLD.id);
    ELSE
        v_kept := EXISTS (SELECT 1 FROM public.course_placements c WHERE c.course_id = OLD.id)
               OR EXISTS (SELECT 1 FROM public.placement_credits c WHERE c.course_id = OLD.id)
               OR EXISTS (SELECT 1 FROM public.course_pathway_badges b WHERE b.course_id = OLD.id)
               OR EXISTS (SELECT 1 FROM public.adventures a
                          JOIN public.sagas s ON s.adventure_id = a.id
                          JOIN public.topics t ON t.saga_id = s.id
                          JOIN public.lessons l ON l.topic_id = t.id
                          JOIN public.lesson_progress p ON p.lesson_id = l.id
                          WHERE a.course_id = OLD.id);
    END IF;
    IF v_kept THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = format('LEGACY_RECORDS_KEPT: %s %s has learner records; retire it by archiving (status = ''archived''), never by deleting (OD-24, OD-9 4.1)',
                             rtrim(TG_TABLE_NAME, 's'), OLD.id);
    END IF;
    RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_catalog_learner_records() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lessons_keep_learner_records ON public.lessons;
CREATE TRIGGER lessons_keep_learner_records
    BEFORE DELETE ON public.lessons
    FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_learner_records();

DROP TRIGGER IF EXISTS topics_keep_learner_records ON public.topics;
CREATE TRIGGER topics_keep_learner_records
    BEFORE DELETE ON public.topics
    FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_learner_records();

DROP TRIGGER IF EXISTS courses_keep_learner_records ON public.courses;
CREATE TRIGGER courses_keep_learner_records
    BEFORE DELETE ON public.courses
    FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_learner_records();
