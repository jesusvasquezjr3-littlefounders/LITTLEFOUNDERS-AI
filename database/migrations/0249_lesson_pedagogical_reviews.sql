-- lesson_pedagogical_reviews — the storage of Appendix C Part 3 Stage 3
-- (Pedagogical Human Review) (GAP-FIX-R6 learning; Appendix C Part 2.1
-- criterion 4 "Reviewed"; Block B Pedagogical Design Standard, the six
-- checks; OD-17). Part 1 of 3: the writer is the next migration and the
-- release enforcement the one after it (a contract migration).
-- @phase: expand
--
-- Before: release_course, release_lesson and release_lesson_version checked
-- only Forge's automated Stage 2 attestation. Nothing stored a Stage 3 review
-- (its reviewer, distinct from the Content Author, a pass or fail per check
-- with a named finding, the content it covers), and Forge's Stage 3 review
-- flags (gates 12, 14, 16, 17, 18, 19) went to no recorded decision.
--
-- Now:
--   1. stage3_review_items(): the ten items every review answers, each with a
--      named finding of 10-600 characters: the six Block B checks and the
--      four Stage 3 questions (B.23 register, B.24 autonomy, B.12 reasoning,
--      B.11 fallibility). 'not_applicable' only where the SPEC scopes the item
--      ("where this lesson involves the Mentor", "where required").
--   2. lesson_pedagogical_reviews: append-only. A review covers either a
--      lesson's CURRENT content (subject 'lesson': lesson_stage3_fingerprint,
--      a digest of every v1 document and answer key without Echo's audio
--      stamps and of every current v2 pointer) or one immutable v2 version
--      (subject 'version', the G.2 queue). Its result is derived by the writer,
--      never typed: 'pass' only when no item failed and every Forge item was
--      judged acceptable. The reviewer is never the author (CHECK).
--   3. lesson_stage3_review_items: Forge's Stage 3 flags, written by
--      record_forge_stage3_items (service role). A review must resolve every
--      open item of its subject (acceptable | needs_change, with a note).
--   4. stage3_release_refusal(lesson, version): NULL when the latest review of
--      that content passed and no Forge item is open; otherwise the reason.
-- Service role only; Core serves the routes behind manage_content.
-- Proven on native PostgreSQL by database/scripts/verify-stage3-review-postgres.py.

CREATE OR REPLACE FUNCTION public.stage3_review_items()
RETURNS TABLE (item text, item_position smallint, allows_not_applicable boolean)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    VALUES ('working_memory'::text, 1::smallint, false),
           ('feedback_scope', 2::smallint, false),
           ('reward_autonomy', 3::smallint, false),
           ('practice_zone', 4::smallint, false),
           ('age_register', 5::smallint, false),
           ('resolution_efficiency', 6::smallint, true),
           ('register_genuine', 7::smallint, false),
           ('autonomy_real', 8::smallint, true),
           ('reasoning_authentic', 9::smallint, true),
           ('mentor_fallibility', 10::smallint, true)
$$;

-- Exactly the ten items, each {result, finding}; plpgsql so no JSON function runs on a non-object.
CREATE OR REPLACE FUNCTION public.stage3_review_checks_valid(p_checks jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
    v record;
    v_entry jsonb;
BEGIN
    IF p_checks IS NULL OR jsonb_typeof(p_checks) <> 'object' THEN
        RETURN false;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_checks)) <> (SELECT count(*) FROM public.stage3_review_items()) THEN
        RETURN false;
    END IF;
    FOR v IN SELECT * FROM public.stage3_review_items() LOOP
        v_entry := p_checks -> v.item;
        IF v_entry IS NULL OR jsonb_typeof(v_entry) <> 'object' THEN
            RETURN false;
        END IF;
        IF (SELECT count(*) FROM jsonb_object_keys(v_entry)) <> 2
           OR jsonb_typeof(v_entry -> 'result') IS DISTINCT FROM 'string'
           OR jsonb_typeof(v_entry -> 'finding') IS DISTINCT FROM 'string'
           OR (v_entry ->> 'result') NOT IN ('pass', 'fail', 'not_applicable')
           OR ((v_entry ->> 'result') = 'not_applicable' AND NOT v.allows_not_applicable)
           OR length(btrim(v_entry ->> 'finding')) NOT BETWEEN 10 AND 600 THEN
            RETURN false;
        END IF;
    END LOOP;
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.lesson_stage3_fingerprint(p_lesson_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT encode(sha256(convert_to(coalesce(string_agg(parts.part, '|' ORDER BY parts.part), ''), 'UTF8')), 'hex')
    FROM (
        SELECT 'v1:' || d.locale || ':' || encode(sha256(convert_to(
                   public.lesson_document_without_audio_stamps(d.document)::text || '#' || d.answer_keys::text, 'UTF8')), 'hex') AS part
        FROM public.lesson_documents d WHERE d.lesson_id = p_lesson_id
        UNION ALL
        SELECT 'v2:' || p.locale || ':' || p.document_version_id::text
        FROM public.lesson_document_version_current p WHERE p.lesson_id = p_lesson_id
    ) AS parts
$$;

CREATE TABLE IF NOT EXISTS public.lesson_pedagogical_reviews (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seq                 bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
    lesson_id           uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    subject_kind        text NOT NULL CHECK (subject_kind IN ('lesson', 'version')),
    content_fingerprint text CHECK (content_fingerprint IS NULL OR content_fingerprint ~ '^[0-9a-f]{64}$'),
    document_version_id uuid REFERENCES public.lesson_document_versions(id) ON DELETE RESTRICT,
    reviewer_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- kept as the record when the account is erased (E.6)
    author_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    author_source       text NOT NULL CHECK (author_source IN ('version_creator', 'named_by_reviewer')),
    result              text NOT NULL CHECK (result IN ('pass', 'fail')),
    finding_count       integer NOT NULL CHECK (finding_count BETWEEN 0 AND 1000),
    checks              jsonb NOT NULL CHECK (public.stage3_review_checks_valid(checks)),
    forge_items         jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(forge_items) = 'array'),
    recorded_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT lesson_pedagogical_reviews_subject CHECK (
        (subject_kind = 'lesson' AND content_fingerprint IS NOT NULL AND document_version_id IS NULL)
        OR (subject_kind = 'version' AND document_version_id IS NOT NULL AND content_fingerprint IS NULL)),
    CONSTRAINT lesson_pedagogical_reviews_independent CHECK (reviewer_id IS NULL OR author_id IS NULL OR reviewer_id <> author_id),
    CONSTRAINT lesson_pedagogical_reviews_findings CHECK ((result = 'fail') = (finding_count > 0))
);
CREATE INDEX IF NOT EXISTS lesson_pedagogical_reviews_lesson ON public.lesson_pedagogical_reviews (lesson_id, content_fingerprint, seq DESC);
CREATE INDEX IF NOT EXISTS lesson_pedagogical_reviews_version ON public.lesson_pedagogical_reviews (document_version_id, seq DESC);

ALTER TABLE public.lesson_pedagogical_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_pedagogical_reviews FROM anon, authenticated;
GRANT SELECT ON public.lesson_pedagogical_reviews TO service_role;

CREATE TABLE IF NOT EXISTS public.lesson_stage3_review_items (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id           uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    document_version_id uuid REFERENCES public.lesson_document_versions(id) ON DELETE RESTRICT,
    locale              text CHECK (locale IS NULL OR locale IN ('en-US', 'es-MX', 'pt-BR')),
    gate                smallint NOT NULL CHECK (gate BETWEEN 1 AND 99),
    flag_text           text NOT NULL CHECK (length(btrim(flag_text)) BETWEEN 1 AND 600),
    run_id              text CHECK (run_id IS NULL OR length(run_id) BETWEEN 1 AND 120),
    created_at          timestamptz NOT NULL DEFAULT now(),
    review_id           uuid REFERENCES public.lesson_pedagogical_reviews(id),
    resolution          text CHECK (resolution IS NULL OR resolution IN ('acceptable', 'needs_change')),
    resolution_note     text CHECK (resolution_note IS NULL OR length(btrim(resolution_note)) BETWEEN 10 AND 600),
    CONSTRAINT lesson_stage3_review_items_resolved CHECK ((review_id IS NULL) = (resolution IS NULL) AND (resolution IS NULL) = (resolution_note IS NULL))
);
-- One open copy of a flag per lesson, version, gate and text (a re-run of Forge adds nothing).
CREATE UNIQUE INDEX IF NOT EXISTS lesson_stage3_review_items_open_once ON public.lesson_stage3_review_items
    (lesson_id, (coalesce(document_version_id, '00000000-0000-0000-0000-000000000000'::uuid)), gate, (md5(flag_text))) WHERE review_id IS NULL;
CREATE INDEX IF NOT EXISTS lesson_stage3_review_items_lesson ON public.lesson_stage3_review_items (lesson_id, created_at);

ALTER TABLE public.lesson_stage3_review_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lesson_stage3_review_items FROM anon, authenticated;
GRANT SELECT ON public.lesson_stage3_review_items TO service_role;

-- A review is a record: never edited or removed. Let through: the erasure of an
-- account nulling reviewer_id / author_id (E.6), and the lesson's own deletion.
CREATE OR REPLACE FUNCTION public.reject_stage3_review_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF NOT EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = OLD.lesson_id) THEN
            RETURN OLD;
        END IF;
    ELSIF TG_TABLE_NAME = 'lesson_pedagogical_reviews' THEN
        IF (NEW.reviewer_id IS NULL OR NEW.reviewer_id = OLD.reviewer_id) AND (NEW.author_id IS NULL OR NEW.author_id = OLD.author_id)
           AND (to_jsonb(NEW) - 'reviewer_id' - 'author_id') = (to_jsonb(OLD) - 'reviewer_id' - 'author_id') THEN
            RETURN NEW;
        END IF;
    ELSIF OLD.review_id IS NULL AND NEW.review_id IS NOT NULL
          AND (to_jsonb(NEW) - 'review_id' - 'resolution' - 'resolution_note') = (to_jsonb(OLD) - 'review_id' - 'resolution' - 'resolution_note') THEN
        RETURN NEW;  -- an open Forge item receives its one resolution
    END IF;
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'a Stage 3 review record is never edited or removed; record a new review instead';
END;
$$;
REVOKE ALL ON FUNCTION public.reject_stage3_review_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS lesson_pedagogical_reviews_append_only ON public.lesson_pedagogical_reviews;
CREATE TRIGGER lesson_pedagogical_reviews_append_only
    BEFORE UPDATE OR DELETE ON public.lesson_pedagogical_reviews
    FOR EACH ROW EXECUTE FUNCTION public.reject_stage3_review_change();
DROP TRIGGER IF EXISTS lesson_stage3_review_items_append_only ON public.lesson_stage3_review_items;
CREATE TRIGGER lesson_stage3_review_items_append_only
    BEFORE UPDATE OR DELETE ON public.lesson_stage3_review_items
    FOR EACH ROW EXECUTE FUNCTION public.reject_stage3_review_change();

-- The open Forge items a review of this subject must resolve: a version's own,
-- or for the lesson the lesson-level ones and those of its current versions.
CREATE OR REPLACE FUNCTION public.stage3_open_items(p_lesson_id uuid, p_document_version_id uuid)
RETURNS SETOF public.lesson_stage3_review_items
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT i.* FROM public.lesson_stage3_review_items i
    WHERE i.lesson_id = p_lesson_id AND i.review_id IS NULL
      AND CASE WHEN p_document_version_id IS NOT NULL THEN i.document_version_id = p_document_version_id
               ELSE i.document_version_id IS NULL OR i.document_version_id IN (
                   SELECT p.document_version_id FROM public.lesson_document_version_current p WHERE p.lesson_id = p_lesson_id) END
    ORDER BY i.created_at, i.id
$$;

-- NULL when the content may go live; otherwise why not.
CREATE OR REPLACE FUNCTION public.stage3_release_refusal(p_lesson_id uuid, p_document_version_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_result text;
BEGIN
    IF p_document_version_id IS NULL THEN
        SELECT r.result INTO v_result FROM public.lesson_pedagogical_reviews r
        WHERE r.lesson_id = p_lesson_id AND r.subject_kind = 'lesson'
          AND r.content_fingerprint = public.lesson_stage3_fingerprint(p_lesson_id)
        ORDER BY r.seq DESC LIMIT 1;
    ELSE
        SELECT r.result INTO v_result FROM public.lesson_pedagogical_reviews r
        WHERE r.lesson_id = p_lesson_id AND r.subject_kind = 'version' AND r.document_version_id = p_document_version_id
        ORDER BY r.seq DESC LIMIT 1;
    END IF;
    IF v_result IS NULL THEN
        RETURN 'no Stage 3 pedagogical review covers this content';
    END IF;
    IF v_result <> 'pass' THEN
        RETURN 'the latest Stage 3 pedagogical review of this content failed';
    END IF;
    IF EXISTS (SELECT 1 FROM public.stage3_open_items(p_lesson_id, p_document_version_id)) THEN
        RETURN 'Forge flagged items that no Stage 3 review has resolved';
    END IF;
    RETURN NULL;
END;
$$;

-- Forge (service role) records its Stage 3 flags for a lesson, or for one v2 version of it.
CREATE OR REPLACE FUNCTION public.record_forge_stage3_items(
    p_lesson_id uuid, p_locale text, p_version_id text, p_run_id text, p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_version uuid;
    v_count integer;
BEGIN
    IF p_lesson_id IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) > 500
       OR (p_locale IS NOT NULL AND p_locale NOT IN ('en-US', 'es-MX', 'pt-BR'))
       OR (p_version_id IS NOT NULL AND p_locale IS NULL)
       OR (p_run_id IS NOT NULL AND length(p_run_id) NOT BETWEEN 1 AND 120) THEN
        RAISE EXCEPTION 'Invalid Stage 3 items input' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = p_lesson_id) THEN
        RAISE EXCEPTION 'Unknown lesson' USING ERRCODE = '22023';
    END IF;
    IF p_version_id IS NOT NULL THEN
        SELECT v.id INTO v_version FROM public.lesson_document_versions v
        WHERE v.lesson_id = p_lesson_id AND v.locale = p_locale AND v.version_id = p_version_id;
        IF v_version IS NULL THEN
            RAISE EXCEPTION 'Unknown lesson version' USING ERRCODE = '22023';
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) AS e(item)
               WHERE jsonb_typeof(e.item) <> 'object' OR jsonb_typeof(e.item -> 'gate') IS DISTINCT FROM 'number'
                  OR jsonb_typeof(e.item -> 'message') IS DISTINCT FROM 'string') THEN
        RAISE EXCEPTION 'Each Stage 3 item is {gate, message}' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) AS e(item)
               WHERE (e.item ->> 'gate')::numeric NOT BETWEEN 1 AND 99 OR (e.item ->> 'gate')::numeric % 1 <> 0
                  OR length(btrim(e.item ->> 'message')) NOT BETWEEN 1 AND 600) THEN
        RAISE EXCEPTION 'A Stage 3 item names a gate 1-99 and a message of 1-600 characters' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.lesson_stage3_review_items (lesson_id, document_version_id, locale, gate, flag_text, run_id)
    SELECT DISTINCT p_lesson_id, v_version, p_locale, (e.item ->> 'gate')::smallint, btrim(e.item ->> 'message'), p_run_id
    FROM jsonb_array_elements(p_items) AS e(item)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
        INSERT INTO public.audit_logs (actor_id, action, subject, detail)
        VALUES (NULL, 'forge.stage3_items_recorded', p_lesson_id::text, jsonb_build_object(
            'locale', p_locale, 'version_id', p_version_id, 'document_version_id', v_version, 'run_id', p_run_id, 'items', v_count));
    END IF;
    RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.record_forge_stage3_items(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_forge_stage3_items(uuid, text, text, text, jsonb) TO service_role;

-- No browser role reads a review or calls a helper; Core reads them with the service role.
REVOKE ALL ON FUNCTION public.stage3_review_items() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stage3_review_checks_valid(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lesson_stage3_fingerprint(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stage3_open_items(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stage3_release_refusal(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stage3_review_items() TO service_role;
GRANT EXECUTE ON FUNCTION public.stage3_review_checks_valid(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.lesson_stage3_fingerprint(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.stage3_open_items(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.stage3_release_refusal(uuid, uuid) TO service_role;
