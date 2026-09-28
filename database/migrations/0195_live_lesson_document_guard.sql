-- @phase: expand
-- live_lesson_document_guard — G.2 (non-negotiable: no path to production
-- content for children bypasses the release check), Appendix N 1.2 and 2.3,
-- owner queue F-09 option (a).
--
-- release_only_publication (0113) made publication a release and froze the v2
-- pointer of a published lesson, but nothing stopped an in-place rewrite of a
-- published lesson's `document` (the legacy JSON a learner is served). Two
-- tools did exactly that: coursegen's images:backfill PATCHed the document of
-- published and review lessons, and Echo (audiogen) PATCHes narration stamps
-- into it. Engineering's option (a), confirmed in the owner queue (F-09):
--
-- 1. For the API roles (anon, authenticated, service_role), an UPDATE that
--    changes the `document` of a lesson whose status is 'published', or a
--    DELETE of such a row, is refused (42501). The one allowlisted change is
--    Echo's narration stamp: the documents compared with every
--    segments[].audio_segment_id removed must be equal (an audio-only diff).
--    The `audio` manifest column is not content and stays writable.
-- 2. The database owner (migrations, an operator's psql session) is outside
--    the guard, as in 0113, but a content change it makes to a published
--    lesson is LOGGED (audit_logs 'content.live_document_patched', lesson and
--    locale, never the document), so the retroactive release check G.2 asks
--    for within 30 days has a list to work from.
--
-- A lesson in draft or review is untouched by this guard: its content is not
-- live, and the release preflight checks it when it is released. To change a
-- live lesson, demote it or publish a new v2 version through the reviewed
-- release path. images:backfill now skips published lessons and reports them.
--
-- Additive: two functions and one trigger. Deploy after the Forge change that
-- makes images:backfill skip published lessons (an older backfill would get a
-- refusal on its first published document; nothing else writes documents of
-- published lessons except Echo's allowlisted stamp).

CREATE OR REPLACE FUNCTION public.lesson_document_without_audio_stamps(p_document jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN jsonb_typeof(p_document -> 'segments') = 'array' THEN
            jsonb_set(p_document, '{segments}', coalesce((
                SELECT jsonb_agg(CASE WHEN jsonb_typeof(e.value) = 'object' THEN e.value - 'audio_segment_id' ELSE e.value END
                                 ORDER BY e.ordinality)
                FROM jsonb_array_elements(p_document -> 'segments') WITH ORDINALITY AS e(value, ordinality)
            ), '[]'::jsonb))
        ELSE p_document
    END
$$;

REVOKE ALL ON FUNCTION public.lesson_document_without_audio_stamps(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_document_without_audio_stamps(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_live_lesson_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_live boolean;
    v_api boolean := current_user IN ('anon', 'authenticated', 'service_role');
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = OLD.lesson_id AND l.status = 'published') INTO v_live;
    IF NOT v_live THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF v_api THEN
            RAISE EXCEPTION USING
                ERRCODE = '42501',
                MESSAGE = 'a published lesson''s document is removed only by archiving the lesson or through a release (G.2)';
        END IF;
        INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (NULL, 'content.live_document_patched', OLD.lesson_id::text,
                jsonb_build_object('locale', OLD.locale, 'change', 'deleted', 'origin', 'database-owner'));
        RETURN OLD;
    END IF;

    IF NEW.document IS NOT DISTINCT FROM OLD.document AND NEW.lesson_id = OLD.lesson_id AND NEW.locale = OLD.locale THEN
        RETURN NEW;
    END IF;
    IF NEW.lesson_id = OLD.lesson_id AND NEW.locale = OLD.locale
       AND public.lesson_document_without_audio_stamps(NEW.document)
           IS NOT DISTINCT FROM public.lesson_document_without_audio_stamps(OLD.document) THEN
        RETURN NEW;  -- Echo's narration stamp: audio-only, allowlisted.
    END IF;
    IF v_api THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'the document of a published lesson changes only through a release (G.2); only narration stamps (segments[].audio_segment_id) may be written in place';
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (NULL, 'content.live_document_patched', OLD.lesson_id::text,
            jsonb_build_object('locale', OLD.locale, 'change', 'content', 'origin', 'database-owner'));
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_live_lesson_document() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS lesson_documents_live_guard ON public.lesson_documents;
CREATE TRIGGER lesson_documents_live_guard
    BEFORE UPDATE OR DELETE ON public.lesson_documents
    FOR EACH ROW EXECUTE FUNCTION public.guard_live_lesson_document();
