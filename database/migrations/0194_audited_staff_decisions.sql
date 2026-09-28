-- audited_staff_decisions — G.3 (no staff moderation decision goes
-- unrecorded) and Appendix N 1.2 (100% audit-log completeness): the Mentor
-- live-activity verdict and the curated-pack status decision write their
-- central audit row INSIDE the transaction that records the decision.
-- @phase: expand
--
-- Before this migration Core committed the verdict through
-- record_tutor_live_review (0144, which never touched audit_logs) and then
-- posted 'admin.tutor_activity.review' as a separate request whose failure it
-- ignored, answering 200 either way. The pack decision (a PostgREST PATCH,
-- then a separate 'admin.tutor_pack.status' insert) had the same gap.
--
-- 1. record_tutor_live_review keeps its signature, grants, refusals and
--    return values ('recorded' | 'recorded_legacy' | 'not_pending'), and now
--    inserts 'admin.tutor_activity.review' {status, issue, governed} in the
--    same transaction, only when the segment row actually changed. A stale
--    second decision ('not_pending') writes nothing.
-- 2. set_tutor_pack_status(pack, from, to, actor, content_hash): the status
--    change (guarded by the status Core read, so a stale decision is a no-op)
--    and 'admin.tutor_pack.status' {from, to, skillKey, tier, locale,
--    packVersion, contentHash} commit together. Publishing stamps
--    released_by/released_at/validated_at and the content hash Core just
--    validated. Returns the updated row as jsonb, or NULL when nothing
--    changed. Core keeps validating the stored pack before it calls this.
--
-- Additive: an older Core that still posts its own audit row keeps working
-- (it would record the decision twice until the new Core is live).
-- Proven on native PostgreSQL by database/scripts/verify-staff-ops-postgres.py.

CREATE OR REPLACE FUNCTION public.record_tutor_live_review(
    p_segment_id uuid,
    p_verdict    text,
    p_issue      text,
    p_reviewer   uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claimed uuid;
    v_logged  uuid;
BEGIN
    IF p_verdict NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'unknown verdict %', p_verdict;
    END IF;
    IF p_issue IS NOT NULL AND (p_verdict <> 'rejected' OR p_issue NOT IN ('quality', 'safety')) THEN
        RAISE EXCEPTION 'an issue class accompanies a rejection only';
    END IF;

    UPDATE public.tutor_segments
    SET review_status = p_verdict
    WHERE id = p_segment_id AND review_status = 'pending'
    RETURNING id INTO v_claimed;
    IF v_claimed IS NULL THEN
        RETURN 'not_pending';
    END IF;

    UPDATE public.tutor_live_content_log
    SET review_verdict = p_verdict,
        review_issue = p_issue,
        reviewed_by = p_reviewer,
        reviewed_at = now()
    WHERE segment_id = p_segment_id AND reviewed_at IS NULL
    RETURNING id INTO v_logged;

    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_reviewer, 'admin.tutor_activity.review', p_segment_id::text,
            jsonb_build_object('status', p_verdict, 'issue', p_issue, 'governed', v_logged IS NOT NULL));

    RETURN CASE WHEN v_logged IS NULL THEN 'recorded_legacy' ELSE 'recorded' END;
END;
$$;

REVOKE ALL ON FUNCTION public.record_tutor_live_review(uuid, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_tutor_live_review(uuid, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.record_tutor_live_review(uuid, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_tutor_live_review(uuid, text, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_tutor_pack_status(
    p_pack_id      uuid,
    p_from         text,
    p_to           text,
    p_actor        uuid,
    p_content_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.tutor_packs%ROWTYPE;
BEGIN
    IF p_to NOT IN ('review', 'published', 'archived') OR p_from NOT IN ('review', 'published', 'archived') THEN
        RAISE EXCEPTION 'unknown pack status' USING ERRCODE = '22023';
    END IF;
    IF p_actor IS NULL THEN
        RAISE EXCEPTION 'a pack decision names its actor' USING ERRCODE = '22023';
    END IF;
    IF p_to = 'published' AND (p_content_hash IS NULL OR p_content_hash !~ '^[0-9a-f]{64}$') THEN
        RAISE EXCEPTION 'publishing records the validated content hash' USING ERRCODE = '22023';
    END IF;

    UPDATE public.tutor_packs
    SET status = p_to,
        updated_at = now(),
        released_by = CASE WHEN p_to = 'published' THEN p_actor ELSE released_by END,
        released_at = CASE WHEN p_to = 'published' THEN now() ELSE released_at END,
        validated_at = CASE WHEN p_to = 'published' THEN now() ELSE validated_at END,
        content_hash = CASE WHEN p_to = 'published' THEN p_content_hash ELSE content_hash END
    WHERE id = p_pack_id AND status = p_from AND p_from <> p_to
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'admin.tutor_pack.status', p_pack_id::text, jsonb_build_object(
        'from', p_from, 'to', p_to, 'skillKey', v_row.skill_key, 'tier', v_row.tier, 'locale', v_row.locale,
        'packVersion', v_row.pack_version, 'contentHash', v_row.content_hash));

    RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.set_tutor_pack_status(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_tutor_pack_status(uuid, text, text, uuid, text) TO service_role;

SELECT 'migration_audited_staff_decisions_ok' AS sentinel;
