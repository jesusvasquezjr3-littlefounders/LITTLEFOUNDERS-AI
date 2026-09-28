-- @phase: expand
-- cooperative_goals_data_practice — OD-9 section 4.2 for the teen
-- cooperative goals (OD-27 (1), B.23): a new sharing surface needs fresh,
-- specific consent before it applies to a migrated child.
--
-- The cooperative-goal lane (teen_cooperative_goals, teen_cooperative_goal_
-- actions, cooperative_goals_retention) merged after the S10.3 registry of
-- rebuild data practices (od9_legacy_migration, od9_consent_enforcement).
-- Its eligibility never asked data_practice_applies, so a migrated
-- self-registered 13-17 account could join a group that shares lesson totals
-- with peers on legacy mutual follows and no specific consent.
--
-- 1. Registers 'sharing.cooperative_goals' (kind sharing_surface). A Tutor
--    answers it, never the teen alone (teen_self_consent false, the same
--    conservative reading as sharing.social_connections); a self-registered
--    migrated teen with no verified Tutor therefore stays out, and so does a
--    new account only when it is a migrated child: data_practice_applies is
--    true for every account the OD-9 consent step did not mark.
-- 2. coop_goal_eligible also requires data_practice_applies(user,
--    'sharing.cooperative_goals'), so every read and write path (overview,
--    candidates, invite, reconcile, the retention sweep) applies it.
-- 3. create_coop_goal and decide_coop_goal_invitation refuse the acting
--    account by name, DATA_PRACTICE_CONSENT_REQUIRED, before the generic
--    eligibility answer; an invitee it does not apply to is simply
--    unavailable (COOP_MEMBER_UNAVAILABLE), never named.
-- 4. set_coop_goal_guardian_consent records the verified Tutor's opt-in as
--    the practice consent (data_practice_set_consent, grantor tutor, audited)
--    and its opt-out as the revocation. Same signatures and return shapes as
--    teen_cooperative_goal_actions; grants unchanged (service role only).
--
-- Additive. Until the OD-9 consent step marks migrated children at the
-- cutover, nothing changes for anyone.

INSERT INTO public.data_practices (key, kind, introduced_by, requirement, consent_source, teen_self_consent, summary) VALUES
    ('sharing.cooperative_goals', 'sharing_surface', 'teen_cooperative_goals', 'B.23/OD-27', 'data_practice_consents', false,
     'Shared learning goals with mutual connections aged 13 to 17: each member sees the group total, never a ranking.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.coop_goal_eligible(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user IS NOT NULL
       AND NOT public.profile_fields_flagged(p_user)
       AND public.data_practice_applies(p_user, 'sharing.cooperative_goals')
       AND CASE public.social_tier(p_user)
           WHEN 'teen' THEN true
           WHEN 'guardian' THEN public.coop_goal_child_teen(p_user) AND public.coop_goal_guardian_allows(p_user)
           ELSE false
       END;
$$;

CREATE OR REPLACE FUNCTION public.create_coop_goal(p_creator uuid, p_target integer, p_days integer, p_invitees uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_goal uuid := gen_random_uuid();
    v_invitee uuid;
    v_other uuid;
BEGIN
    IF p_creator IS NULL OR p_target IS NULL OR p_target NOT IN (5, 10, 15, 20, 30, 40) OR p_days IS NULL OR p_days NOT IN (7, 14, 28)
       OR p_invitees IS NULL OR cardinality(p_invitees) NOT BETWEEN 1 AND 4 OR array_position(p_invitees, NULL) IS NOT NULL
       OR p_creator = ANY (p_invitees)
       OR (SELECT count(DISTINCT x) FROM unnest(p_invitees) x) <> cardinality(p_invitees) THEN
        RAISE EXCEPTION 'COOP_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_creator FOR UPDATE;
    IF FOUND AND NOT public.data_practice_applies(p_creator, 'sharing.cooperative_goals') THEN
        RAISE EXCEPTION 'DATA_PRACTICE_CONSENT_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT FOUND OR NOT public.coop_goal_eligible(p_creator) THEN
        RAISE EXCEPTION 'COOP_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.coop_goal_members m JOIN public.coop_goals g ON g.id = m.goal_id AND g.status = 'open'
        WHERE m.user_id = p_creator AND m.status = 'active') >= 3 THEN
        RAISE EXCEPTION 'COOP_GOAL_LIMIT' USING ERRCODE = 'P0001';
    END IF;
    FOREACH v_invitee IN ARRAY p_invitees LOOP
        IF NOT public.coop_goal_eligible(v_invitee) OR NOT public.coop_goal_mutual(p_creator, v_invitee) THEN
            RAISE EXCEPTION 'COOP_MEMBER_UNAVAILABLE' USING ERRCODE = 'P0001';
        END IF;
        FOREACH v_other IN ARRAY p_invitees LOOP
            IF v_other <> v_invitee AND NOT public.coop_goal_mutual(v_other, v_invitee) THEN
                RAISE EXCEPTION 'COOP_MEMBER_UNAVAILABLE' USING ERRCODE = 'P0001';
            END IF;
        END LOOP;
    END LOOP;
    PERFORM public.coop_goal_lock(v_goal);
    INSERT INTO public.coop_goals (id, created_by, kind, target, starts_at, ends_at)
    VALUES (v_goal, p_creator, 'lessons', p_target, now(), now() + make_interval(days => p_days));
    INSERT INTO public.coop_goal_members (goal_id, user_id, invited_by, status, joined_at)
    VALUES (v_goal, p_creator, NULL, 'active', now());
    PERFORM public.coop_goal_log(p_creator, 'social.coop_goal_created', p_creator, v_goal,
        jsonb_build_object('kind', 'lessons', 'target', p_target, 'days', p_days));
    FOREACH v_invitee IN ARRAY p_invitees LOOP
        INSERT INTO public.coop_goal_members (goal_id, user_id, invited_by, status) VALUES (v_goal, v_invitee, p_creator, 'invited');
        PERFORM public.coop_goal_log(p_creator, 'social.coop_member_invited', v_invitee, v_goal);
    END LOOP;
    RETURN v_goal;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_coop_goal_invitation(p_user uuid, p_goal uuid, p_accept boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_user IS NULL OR p_goal IS NULL OR p_accept IS NULL THEN
        RAISE EXCEPTION 'COOP_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_user FOR UPDATE;
    PERFORM public.coop_goal_reconcile(p_goal);
    IF NOT EXISTS (SELECT 1 FROM public.coop_goal_members WHERE goal_id = p_goal AND user_id = p_user AND status = 'invited') THEN
        RAISE EXCEPTION 'COOP_INVITATION_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF NOT p_accept THEN
        PERFORM public.coop_goal_end_member(p_goal, p_user, 'declined', p_user);
        PERFORM public.coop_goal_reconcile(p_goal);
        RETURN 'declined';
    END IF;
    IF NOT public.data_practice_applies(p_user, 'sharing.cooperative_goals') THEN
        RAISE EXCEPTION 'DATA_PRACTICE_CONSENT_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.coop_goal_eligible(p_user) THEN
        RAISE EXCEPTION 'COOP_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.coop_goal_members m JOIN public.coop_goals g ON g.id = m.goal_id AND g.status = 'open'
        WHERE m.user_id = p_user AND m.status = 'active') >= 3 THEN
        RAISE EXCEPTION 'COOP_GOAL_LIMIT' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.coop_goal_members o WHERE o.goal_id = p_goal AND o.status = 'active'
        AND NOT public.coop_goal_mutual(o.user_id, p_user)) THEN
        RAISE EXCEPTION 'COOP_MEMBER_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.coop_goal_members SET status = 'active', joined_at = now() WHERE goal_id = p_goal AND user_id = p_user;
    PERFORM public.coop_goal_log(p_user, 'social.coop_member_joined', p_user, p_goal);
    RETURN 'accepted';
END;
$$;

CREATE OR REPLACE FUNCTION public.set_coop_goal_guardian_consent(p_guardian uuid, p_kid uuid, p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    item record;
    v_before boolean;
    v_guardian uuid;
BEGIN
    IF p_guardian IS NULL OR p_kid IS NULL OR p_enabled IS NULL THEN
        RAISE EXCEPTION 'COOP_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM 1 FROM auth.users WHERE id = p_kid FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.guardian_links WHERE parent_user_id = p_guardian AND kid_user_id = p_kid
        AND verification_status = 'verified') THEN
        RAISE EXCEPTION 'COOP_GUARDIAN_NOT_LINKED' USING ERRCODE = 'P0001';
    END IF;
    IF p_enabled AND NOT public.coop_goal_child_teen(p_kid) THEN
        RAISE EXCEPTION 'COOP_CHILD_NOT_TEEN' USING ERRCODE = 'P0001';
    END IF;
    -- OD-9 4.2: the Tutor's opt-in is the specific consent to this sharing
    -- surface (and the opt-out its revocation). Idempotent, audited by
    -- data_practice_set_consent; runs even when the opt-in itself is unchanged
    -- so a consent that lapsed with an earlier Tutor is replaced.
    PERFORM public.data_practice_set_consent(p_kid, p_guardian, 'sharing.cooperative_goals', p_enabled,
        (SELECT disclosure_version FROM public.data_practices WHERE key = 'sharing.cooperative_goals'));
    SELECT enabled, guardian_id INTO v_before, v_guardian FROM public.coop_goal_guardian_consents WHERE kid_user_id = p_kid;
    -- An unchanged answer writes nothing more (on: the same guardian already gave it).
    IF (v_before IS NULL AND NOT p_enabled) OR (v_before = p_enabled AND (NOT p_enabled OR v_guardian = p_guardian)) THEN
        RETURN p_enabled;
    END IF;
    INSERT INTO public.coop_goal_guardian_consents (kid_user_id, guardian_id, enabled, updated_at)
    VALUES (p_kid, p_guardian, p_enabled, now())
    ON CONFLICT (kid_user_id) DO UPDATE SET guardian_id = EXCLUDED.guardian_id, enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at;
    PERFORM public.coop_goal_log(p_guardian,
        CASE WHEN p_enabled THEN 'social.coop_guardian_enabled' ELSE 'social.coop_guardian_disabled' END, p_kid, NULL,
        jsonb_build_object('tier', 'guardian'));
    IF NOT p_enabled THEN
        FOR item IN SELECT m.goal_id FROM public.coop_goal_members m JOIN public.coop_goals g ON g.id = m.goal_id AND g.status = 'open'
            WHERE m.user_id = p_kid AND m.status IN ('invited', 'active') ORDER BY m.goal_id LOOP
            PERFORM public.coop_goal_lock(item.goal_id);
            PERFORM public.coop_goal_end_member(item.goal_id, p_kid, 'guardian_off', p_guardian);
            PERFORM public.coop_goal_reconcile(item.goal_id);
        END LOOP;
    END IF;
    RETURN p_enabled;
END;
$$;
