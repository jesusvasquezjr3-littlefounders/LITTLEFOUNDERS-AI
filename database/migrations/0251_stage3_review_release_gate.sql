-- stage3_review_release_gate — no lesson content reaches learners without a
-- passing Stage 3 pedagogical review (GAP-FIX-R6 learning; Appendix C Part 3
-- Stage 3 and Part 2.1 criterion 4; OD-17: generation "use[s] Appendix C's
-- human and automated release pipeline"). Part 3 of 3.
-- @phase: contract
-- @after-release: the Core and console release of GAP-FIX-R6 learning (fix6learni2): the staff routes GET/POST /admin/content/lessons/:lessonId/pedagogical-review, the Stage 3 form on the rebuilt Content page and Core's STAGE3_REVIEW_REQUIRED mapping of the release refusals. Applied earlier, every release is refused with no screen to record the review. Never by auto-apply.
--
-- Enforcement is two triggers, so no release path and no later re-issue of a
-- release function can skip it:
--   1. a lesson moving to 'published' (release_course, release_lesson, and
--      any other writer) needs stage3_release_refusal(lesson) to be NULL: the
--      latest review of the lesson's CURRENT content fingerprint passed and no
--      Forge item of it is open;
--   2. a v2 pointer moving on a published lesson (release_lesson_version, and
--      emergency_activate_lesson_version: the emergency skips the course
--      verification, never the human review) needs the same of that version.
-- Otherwise the statement raises, and the release rolls back whole, with
-- MESSAGE 'STAGE3_REVIEW_REQUIRED: lesson <id>[ version <id>]: <reason>';
-- Core maps it to 409 RELEASE_STAGE3_REVIEW_REQUIRED. The database owner (an
-- operator's psql session, a migration, a seed) alone may pass with
-- SET LOCAL lf.bypass_justification = '<20-600 characters>', which is audited
-- as 'content.stage3_review_bypassed' (0222's convention). Inserting a lesson
-- row is not a release and stays outside the trigger (0244 refuses an API
-- role inserting a published lesson). Lessons already published are unchanged.
-- Proven on native PostgreSQL by database/scripts/verify-stage3-review-postgres.py.

CREATE OR REPLACE FUNCTION public.stage3_refuse_or_bypass(p_lesson_id uuid, p_document_version_id uuid, p_refusal text)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
    v_justification text := btrim(coalesce(current_setting('lf.bypass_justification', true), ''));
BEGIN
    IF current_user NOT IN ('anon', 'authenticated', 'service_role') AND length(v_justification) BETWEEN 20 AND 600 THEN
        INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (NULL, 'content.stage3_review_bypassed', p_lesson_id::text, jsonb_build_object(
            'document_version_id', p_document_version_id, 'refusal', p_refusal,
            'origin', 'database-owner', 'justification', v_justification));
        RETURN;
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0001',
        MESSAGE = format('STAGE3_REVIEW_REQUIRED: lesson %s%s: %s', p_lesson_id,
                         CASE WHEN p_document_version_id IS NULL THEN '' ELSE ' version ' || p_document_version_id END, p_refusal),
        HINT = 'Record a passing Stage 3 pedagogical review of this content on the staff Content page (Appendix C Part 3).';
END;
$$;
REVOKE ALL ON FUNCTION public.stage3_refuse_or_bypass(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_stage3_lesson_release()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
    v_refusal text := public.stage3_release_refusal(NEW.id, NULL);
BEGIN
    IF v_refusal IS NOT NULL THEN
        PERFORM public.stage3_refuse_or_bypass(NEW.id, NULL, v_refusal);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_stage3_lesson_release() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS lessons_stage3_review_required ON public.lessons;
CREATE TRIGGER lessons_stage3_review_required
    BEFORE UPDATE OF status ON public.lessons
    FOR EACH ROW WHEN (NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published')
    EXECUTE FUNCTION public.guard_stage3_lesson_release();

CREATE OR REPLACE FUNCTION public.guard_stage3_version_activation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
    v_refusal text;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.document_version_id IS NOT DISTINCT FROM OLD.document_version_id THEN
        RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = NEW.lesson_id AND l.status = 'published') THEN
        RETURN NEW;  -- an unpublished lesson goes live only through a release, gated above
    END IF;
    v_refusal := public.stage3_release_refusal(NEW.lesson_id, NEW.document_version_id);
    IF v_refusal IS NOT NULL THEN
        PERFORM public.stage3_refuse_or_bypass(NEW.lesson_id, NEW.document_version_id, v_refusal);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_stage3_version_activation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS lesson_document_version_current_stage3 ON public.lesson_document_version_current;
CREATE TRIGGER lesson_document_version_current_stage3
    BEFORE INSERT OR UPDATE ON public.lesson_document_version_current
    FOR EACH ROW EXECUTE FUNCTION public.guard_stage3_version_activation();
