-- content_bypass_retro_checks — G.2's retained bypasses carry a mandatory
-- logged justification and a retroactive release check within 30 days, and
-- Appendix N 1.2's two bypass metrics are computed from the record (Appendix
-- N 2.3(b) and (c)).
-- @phase: contract
-- @after-release: none in Core; this narrows the database owner's path. An
--   operator (or a migration) that changes a published lesson's document must
--   first `SET LOCAL lf.bypass_justification = '<why, 20-600 characters>'`.
--
-- Before: guard_live_lesson_document (0201) let the database owner (an
-- operator's psql session, a migration) rewrite a published lesson's document
-- and only logged 'content.live_document_patched', with no justification, and
-- nothing consumed that log.
--
-- Now:
--   1. The owner's change of a published document (content or delete) is
--      refused unless the session sets lf.bypass_justification (20-600
--      characters after trimming); the text is stored in the audit detail.
--      The API roles stay refused outright and Echo's narration stamp stays
--      allowlisted, exactly as in 0201.
--   2. content_retro_checks: one row per bypass, written by a trigger on
--      audit_logs for 'content.live_document_patched',
--      'content.v2_emergency_activation' (0215) and the legacy
--      'forge.v2_lesson_published' of an already-published lesson (the 0209
--      path; backfilled). due_at = occurred_at + 30 days.
--   3. A check CLOSES when a complete Forge verification of the lesson's
--      course (course_release_verifications, every gate ok, current watermark:
--      forge_release_verification_refusal returns nothing) is recorded after
--      the bypass. The closing is recorded on the row (closed_at,
--      closing_verified_at) and audited ('content.retro_check_closed').
--   4. content_bypass_checks(p_days) lists the checks of the window plus any
--      still open; content_bypass_metrics(p_days) returns the counts behind
--      the Release-Verification Bypass Rate and the Bypass-Path Justification
--      & Retroactive-Check Completeness (Core computes the two rates).
-- Service role only; Core serves them behind manage_content.

CREATE OR REPLACE FUNCTION public.guard_live_lesson_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_live boolean;
    v_api boolean := current_user IN ('anon', 'authenticated', 'service_role');
    v_justification text := btrim(coalesce(current_setting('lf.bypass_justification', true), ''));
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = OLD.lesson_id AND l.status = 'published') INTO v_live;
    IF NOT v_live THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.document IS NOT DISTINCT FROM OLD.document AND NEW.lesson_id = OLD.lesson_id AND NEW.locale = OLD.locale THEN
            RETURN NEW;
        END IF;
        IF NEW.lesson_id = OLD.lesson_id AND NEW.locale = OLD.locale
           AND public.lesson_document_without_audio_stamps(NEW.document)
               IS NOT DISTINCT FROM public.lesson_document_without_audio_stamps(OLD.document) THEN
            RETURN NEW;  -- Echo's narration stamp: audio-only, allowlisted.
        END IF;
    END IF;

    IF v_api THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION USING
                ERRCODE = '42501',
                MESSAGE = 'a published lesson''s document is removed only by archiving the lesson or through a release (G.2)';
        END IF;
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'the document of a published lesson changes only through a release (G.2); only narration stamps (segments[].audio_segment_id) may be written in place';
    END IF;

    -- The database owner: G.2's bypass needs a logged justification.
    IF length(v_justification) NOT BETWEEN 20 AND 600 THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'changing a published lesson''s document outside a release needs a justification: SET LOCAL lf.bypass_justification = ''<20-600 characters>'' (G.2)';
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (NULL, 'content.live_document_patched', OLD.lesson_id::text,
            jsonb_build_object('locale', OLD.locale, 'change', CASE WHEN TG_OP = 'DELETE' THEN 'deleted' ELSE 'content' END,
                               'origin', 'database-owner', 'justification', v_justification));
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_live_lesson_document() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.content_retro_checks (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    audit_log_id         bigint NOT NULL UNIQUE REFERENCES public.audit_logs(id) ON DELETE RESTRICT,
    action               text NOT NULL CHECK (action IN ('content.live_document_patched', 'content.v2_emergency_activation', 'forge.v2_lesson_published')),
    lesson_id            uuid,
    course_id            uuid,
    locale               text,
    occurred_at          timestamptz NOT NULL,
    due_at               timestamptz NOT NULL,
    justification        text,
    closed_at            timestamptz,
    closing_verified_at  timestamptz,
    CONSTRAINT content_retro_checks_closed CHECK ((closed_at IS NULL) = (closing_verified_at IS NULL))
);
CREATE INDEX IF NOT EXISTS content_retro_checks_open ON public.content_retro_checks (course_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS content_retro_checks_occurred ON public.content_retro_checks (occurred_at DESC);

ALTER TABLE public.content_retro_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_retro_checks FROM anon, authenticated;
GRANT SELECT ON public.content_retro_checks TO service_role;

CREATE OR REPLACE FUNCTION public.content_retro_check_days() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 30 $$;

-- Which audit rows are bypasses of the release check.
CREATE OR REPLACE FUNCTION public.content_is_release_bypass(p_action text, p_detail jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
    SELECT p_action IN ('content.live_document_patched', 'content.v2_emergency_activation')
        OR (p_action = 'forge.v2_lesson_published' AND p_detail->>'lesson_status' = 'published')
$$;

CREATE OR REPLACE FUNCTION public.content_course_of_lesson(p_lesson text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT a.course_id FROM public.lessons l
    JOIN public.topics t ON t.id = l.topic_id JOIN public.sagas s ON s.id = t.saga_id JOIN public.adventures a ON a.id = s.adventure_id
    WHERE l.id::text = p_lesson
$$;
REVOKE ALL ON FUNCTION public.content_course_of_lesson(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_content_retro_check()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF public.content_is_release_bypass(NEW.action, NEW.detail) THEN
        INSERT INTO public.content_retro_checks (audit_log_id, action, lesson_id, course_id, locale, occurred_at, due_at, justification)
        VALUES (NEW.id, NEW.action,
                CASE WHEN NEW.subject ~ '^[0-9a-f-]{36}$' THEN NEW.subject::uuid END,
                public.content_course_of_lesson(NEW.subject), NEW.detail->>'locale', NEW.created_at,
                NEW.created_at + make_interval(days => public.content_retro_check_days()),
                NULLIF(btrim(coalesce(NEW.detail->>'justification', '')), ''))
        ON CONFLICT (audit_log_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_content_retro_check() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_logs_content_retro_check ON public.audit_logs;
CREATE TRIGGER audit_logs_content_retro_check
    AFTER INSERT ON public.audit_logs
    FOR EACH ROW
    WHEN (NEW.action IN ('content.live_document_patched', 'content.v2_emergency_activation', 'forge.v2_lesson_published'))
    EXECUTE FUNCTION public.record_content_retro_check();

-- Backfill the bypasses logged before this migration (0201, 0209).
INSERT INTO public.content_retro_checks (audit_log_id, action, lesson_id, course_id, locale, occurred_at, due_at, justification)
SELECT a.id, a.action, CASE WHEN a.subject ~ '^[0-9a-f-]{36}$' THEN a.subject::uuid END,
       public.content_course_of_lesson(a.subject), a.detail->>'locale', a.created_at,
       a.created_at + make_interval(days => public.content_retro_check_days()),
       NULLIF(btrim(coalesce(a.detail->>'justification', '')), '')
FROM public.audit_logs a
WHERE public.content_is_release_bypass(a.action, a.detail)
ON CONFLICT (audit_log_id) DO NOTHING;

-- The retroactive check runs: a complete, current Forge verification of the
-- course closes every open check logged before it, and says so.
CREATE OR REPLACE FUNCTION public.close_content_retro_checks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_closed integer;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.content_retro_checks WHERE course_id = NEW.course_id AND closed_at IS NULL) THEN
        RETURN NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM public.forge_release_verification_refusal(NEW.course_id)) THEN
        RETURN NULL;  -- incomplete or stale: the checks stay open
    END IF;
    UPDATE public.content_retro_checks
    SET closed_at = now(), closing_verified_at = NEW.verified_at
    WHERE course_id = NEW.course_id AND closed_at IS NULL AND occurred_at <= NEW.verified_at;
    GET DIAGNOSTICS v_closed = ROW_COUNT;
    IF v_closed > 0 THEN
        INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (NULL, 'content.retro_check_closed', NEW.course_id::text,
                jsonb_build_object('closed', v_closed, 'verified_at', NEW.verified_at));
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.close_content_retro_checks() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS course_release_verifications_close_retro_checks ON public.course_release_verifications;
CREATE TRIGGER course_release_verifications_close_retro_checks
    AFTER INSERT OR UPDATE ON public.course_release_verifications
    FOR EACH ROW EXECUTE FUNCTION public.close_content_retro_checks();

-- Every check of the last p_days days, plus any still open (whatever its age).
CREATE OR REPLACE FUNCTION public.content_bypass_checks(p_days integer)
RETURNS TABLE (
    id bigint, action text, lesson_id uuid, course_id uuid, locale text, occurred_at timestamptz, due_at timestamptz,
    justified boolean, closed_at timestamptz, closing_verified_at timestamptz, state text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT c.id, c.action, c.lesson_id, c.course_id, c.locale, c.occurred_at, c.due_at,
           c.justification IS NOT NULL, c.closed_at, c.closing_verified_at,
           CASE
               WHEN c.closed_at IS NOT NULL AND c.closed_at <= c.due_at THEN 'closed'
               WHEN c.closed_at IS NOT NULL THEN 'closed_late'
               WHEN now() > c.due_at THEN 'overdue'
               ELSE 'open'
           END
    FROM public.content_retro_checks c
    WHERE c.occurred_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 3650)))
       OR c.closed_at IS NULL
    ORDER BY (c.closed_at IS NULL AND now() > c.due_at) DESC, c.occurred_at DESC
    LIMIT 500
$$;
REVOKE ALL ON FUNCTION public.content_bypass_checks(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_bypass_checks(integer) TO service_role;

-- The counts behind Appendix N 1.2 over the last p_days days.
--   publish_actions   staff releases (course, lesson, v2 version) plus bypasses
--   bypasses          bypass uses in the window
--   decided           bypasses whose outcome is known (closed, or past due)
--   unverified        bypasses with no retroactive check within 30 days (overdue or closed late)
--   complete          bypasses with a justification AND a check closed within 30 days
--   overdue_open      checks past due and still open (any age): the watchdog's number
CREATE OR REPLACE FUNCTION public.content_bypass_metrics(p_days integer)
RETURNS TABLE (publish_actions bigint, bypasses bigint, decided bigint, unverified bigint, complete bigint, overdue_open bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    WITH w AS (SELECT now() - make_interval(days => greatest(1, least(coalesce(p_days, 90), 3650))) AS since),
    b AS (SELECT c.* FROM public.content_retro_checks c, w WHERE c.occurred_at >= w.since),
    releases AS (
        SELECT count(*) AS n FROM public.audit_logs a, w
        WHERE a.created_at >= w.since AND a.action IN ('admin.course.release', 'admin.lesson.release', 'content.v2_version_released'))
    SELECT (SELECT n FROM releases) + (SELECT count(*) FROM b),
           (SELECT count(*) FROM b),
           (SELECT count(*) FROM b WHERE closed_at IS NOT NULL OR now() > due_at),
           (SELECT count(*) FROM b WHERE (closed_at IS NULL AND now() > due_at) OR closed_at > due_at),
           (SELECT count(*) FROM b WHERE justification IS NOT NULL AND closed_at IS NOT NULL AND closed_at <= due_at),
           (SELECT count(*) FROM public.content_retro_checks WHERE closed_at IS NULL AND now() > due_at)
$$;
REVOKE ALL ON FUNCTION public.content_bypass_metrics(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_bypass_metrics(integer) TO service_role;
