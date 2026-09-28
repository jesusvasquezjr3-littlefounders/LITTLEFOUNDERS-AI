-- family_research_reconsent_at_18 — GAP-FIX-R2 (owner review H-25, D.22,
-- OD-9 section 4.2): a young adult whose Tutor's research yes lapsed at 18 can
-- answer for themselves.
-- @phase: expand
--
-- H-25 was approved as "It lapses at 18, and re-consent is requested."
-- family_research_instrumentation (S07.7) made the Tutor's yes lapse at 18
-- and accepted an adult's own yes, but only from a wallet holder. A
-- self-registered teen linked to a Tutor stops being a wallet holder at 18
-- (teen_wallet_holder ends at 17, H-08), so the young adult the request is
-- for was refused RESEARCH_CONSENT_NOT_ALLOWED.
--
-- This redefinition of family_research_set_consent keeps every rule and adds
-- one admission: an adult may say yes for themselves when they still hold an
-- active consent row (the lapsed Tutor one, or their own), with or without a
-- wallet; repeating their own yes to the same disclosure changes nothing. Their yes replaces the lapsed row (never revives it), so the
-- history recorded while they were a child stays under their own consent. A
-- no still deletes every snapshot at once.
--
-- Unchanged on purpose: family_research_admitted still records only a wallet
-- holder, so an adult without a wallet is not observed any further in this
-- phase (the adult measures belong to a later phase with its own disclosure,
-- docs/operations/BLOCK-D-LONGITUDINAL-RESEARCH-PLAN.md). An adult with no
-- lapsed consent and no wallet is still refused, and a Tutor still cannot
-- answer for an 18-year-old. Same signature, grants and SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.family_research_set_consent(p_subject uuid, p_actor uuid, p_participate boolean, p_version int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_self    boolean := p_actor IS NOT NULL AND p_actor = p_subject;
    v_tutor   boolean := public.family_is_verified_guardian(p_actor, p_subject);
    v_consent public.family_research_consents%ROWTYPE;
    v_active  boolean;
    v_removed bigint;
    v_reconsent boolean;
BEGIN
    IF p_subject IS NULL OR p_actor IS NULL OR p_participate IS NULL OR NOT (v_self OR v_tutor) THEN
        RAISE EXCEPTION 'RESEARCH_CONSENT_NOT_ALLOWED' USING ERRCODE = 'P0001';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_subject FOR UPDATE;
    SELECT * INTO v_consent FROM public.family_research_consents WHERE subject_user_id = p_subject AND revoked_at IS NULL;
    v_active := FOUND;

    IF NOT p_participate THEN
        IF v_active THEN
            UPDATE public.family_research_consents SET revoked_at = now(), revoked_by = p_actor WHERE id = v_consent.id;
        END IF;
        -- Runs only when someone says no, never while this migration is applied.
        WITH gone AS (DELETE FROM public.family_research_participants WHERE subject_user_id = p_subject RETURNING 1)
        SELECT count(*) INTO v_removed FROM gone;
        RETURN public.family_research_state(p_subject);
    END IF;

    IF p_version IS DISTINCT FROM public.family_research_disclosure_version() THEN
        RAISE EXCEPTION 'RESEARCH_DISCLOSURE_STALE' USING ERRCODE = 'P0001';
    END IF;
    -- H-25: the young adult answering the request their Tutor's lapsed yes left
    -- behind (or repeating their own yes to it).
    v_reconsent := v_self AND v_active AND public.family_research_is_adult(p_subject);
    IF (public.wallet_holder_kind(p_subject) IS NULL AND NOT v_reconsent)
       OR EXISTS (SELECT 1 FROM auth.users WHERE id = p_subject AND is_anonymous)
       OR (v_self AND NOT public.family_research_is_adult(p_subject))
       OR (NOT v_self AND public.family_research_is_adult(p_subject)) THEN
        RAISE EXCEPTION 'RESEARCH_CONSENT_NOT_ALLOWED' USING ERRCODE = 'P0001';
    END IF;
    IF v_active AND (public.family_research_admitted(p_subject)
                     OR (v_self AND v_consent.grantor_kind = 'self' AND v_consent.disclosure_version = p_version)) THEN
        RETURN public.family_research_state(p_subject);
    END IF;
    IF v_active THEN
        -- A lapsed consent (aged out, or its Tutor left) is replaced, never revived:
        -- it ends here and the new yes is its own row.
        UPDATE public.family_research_consents SET revoked_at = now(), revoked_by = p_actor WHERE id = v_consent.id;
    END IF;
    INSERT INTO public.family_research_consents (subject_user_id, grantor_kind, granted_by, disclosure_version)
        VALUES (p_subject, CASE WHEN v_self THEN 'self' ELSE 'tutor' END, p_actor, p_version::smallint);
    INSERT INTO public.family_research_participants (subject_user_id) VALUES (p_subject) ON CONFLICT DO NOTHING;
    RETURN public.family_research_state(p_subject);
END;
$$;
REVOKE ALL ON FUNCTION public.family_research_set_consent(uuid, uuid, boolean, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_research_set_consent(uuid, uuid, boolean, int) TO service_role;
