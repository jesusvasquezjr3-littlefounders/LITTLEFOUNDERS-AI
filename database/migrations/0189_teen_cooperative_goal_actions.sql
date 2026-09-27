-- @phase: expand
-- L-04 (owner decision OD-27 (1)): teen cooperative goals, part 2 of 2: the
-- write and read functions Core calls with the service role, and the trigger
-- that re-applies the rules when a follow between two members ends. The
-- tables, the eligibility and connection rules and the reconcile step are in
-- teen_cooperative_goals (part 1); the policy is SOCIAL-TIERS.md section 1.2.
--
-- Every function takes the session as the actor (Core never lets a browser
-- name another account), re-checks every rule under the goal's advisory lock
-- and writes its audit row in the same transaction. Refusals are P0001 codes:
--   COOP_INVALID             malformed call (preset target, 7/14/28 days, 1 to 4 invitees)
--   COOP_NOT_ELIGIBLE        the actor is not a 13-to-17 participant (tier, age, guardian opt-in, E.13 flag)
--   COOP_MEMBER_UNAVAILABLE  the invitee is not eligible or not mutually connected with every member
--   COOP_GOAL_LIMIT          already active in three open goals
--   COOP_GROUP_FULL          five people are already in or asked
--   COOP_ALREADY_ASKED       one ask per person per goal (no re-asking after a no)
--   COOP_GOAL_NOT_FOUND, COOP_INVITATION_NOT_FOUND, COOP_MEMBER_NOT_FOUND, COOP_NOT_ALLOWED
--   COOP_GUARDIAN_NOT_LINKED, COOP_CHILD_NOT_TEEN  (the guardian's opt-in)

-- ── Writes (service role only; the actor is always the session) ──────────────
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

CREATE OR REPLACE FUNCTION public.invite_coop_goal_member(p_actor uuid, p_goal uuid, p_invitee uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_actor IS NULL OR p_goal IS NULL OR p_invitee IS NULL OR p_actor = p_invitee THEN
        RAISE EXCEPTION 'COOP_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM public.coop_goal_reconcile(p_goal);
    IF NOT EXISTS (SELECT 1 FROM public.coop_goal_members m JOIN public.coop_goals g ON g.id = m.goal_id AND g.status = 'open'
        WHERE m.goal_id = p_goal AND m.user_id = p_actor AND m.status = 'active') THEN
        RAISE EXCEPTION 'COOP_GOAL_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.coop_goal_members WHERE goal_id = p_goal AND user_id = p_invitee) THEN
        RAISE EXCEPTION 'COOP_ALREADY_ASKED' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.coop_goal_members WHERE goal_id = p_goal AND status IN ('invited', 'active')) >= 5 THEN
        RAISE EXCEPTION 'COOP_GROUP_FULL' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.coop_goal_eligible(p_invitee) OR EXISTS (SELECT 1 FROM public.coop_goal_members o
        WHERE o.goal_id = p_goal AND o.status IN ('invited', 'active') AND NOT public.coop_goal_mutual(o.user_id, p_invitee)) THEN
        RAISE EXCEPTION 'COOP_MEMBER_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.coop_goal_members (goal_id, user_id, invited_by, status) VALUES (p_goal, p_invitee, p_actor, 'invited');
    PERFORM public.coop_goal_log(p_actor, 'social.coop_member_invited', p_invitee, p_goal);
    RETURN true;
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

-- Leave (the member themself), withdraw an invitation (its inviter or the
-- goal's creator), or remove a member (the goal's creator). Returns the reason.
CREATE OR REPLACE FUNCTION public.end_coop_goal_membership(p_actor uuid, p_goal uuid, p_member uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    target record;
    creator uuid;
    actor_active boolean;
    reason text;
BEGIN
    IF p_actor IS NULL OR p_goal IS NULL OR p_member IS NULL THEN
        RAISE EXCEPTION 'COOP_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM public.coop_goal_reconcile(p_goal);
    SELECT created_by INTO creator FROM public.coop_goals WHERE id = p_goal AND status = 'open';
    SELECT status, invited_by INTO target FROM public.coop_goal_members
     WHERE goal_id = p_goal AND user_id = p_member AND status IN ('invited', 'active');
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.coop_goals WHERE id = p_goal AND status = 'open') THEN
        RAISE EXCEPTION 'COOP_MEMBER_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF p_actor = p_member THEN
        reason := CASE target.status WHEN 'invited' THEN 'declined' ELSE 'left' END;
    ELSE
        actor_active := EXISTS (SELECT 1 FROM public.coop_goal_members
            WHERE goal_id = p_goal AND user_id = p_actor AND status = 'active');
        IF NOT actor_active THEN
            RAISE EXCEPTION 'COOP_MEMBER_NOT_FOUND' USING ERRCODE = 'P0001';
        ELSIF target.status = 'invited' AND (p_actor = target.invited_by OR p_actor = creator) THEN
            reason := 'withdrawn';
        ELSIF target.status = 'active' AND p_actor = creator THEN
            reason := 'removed';
        ELSE
            RAISE EXCEPTION 'COOP_NOT_ALLOWED' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    PERFORM public.coop_goal_end_member(p_goal, p_member, reason, p_actor);
    PERFORM public.coop_goal_reconcile(p_goal);
    RETURN reason;
END;
$$;

-- A verified guardian turns cooperative goals on or off for their child aged
-- 13 to 17. Off always works for a linked guardian and ends the child's
-- memberships and invitations at once.
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
    SELECT enabled, guardian_id INTO v_before, v_guardian FROM public.coop_goal_guardian_consents WHERE kid_user_id = p_kid;
    -- An unchanged answer writes nothing (on: the same guardian already gave it).
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

-- ── Reads ────────────────────────────────────────────────────────────────────
-- The session's own view: whether it may take part, its open goals with the
-- group total and the member ids, its invitations, and goals that finished in
-- the last 14 days. Reconciles first, so what it returns obeys every rule now.
CREATE OR REPLACE FUNCTION public.coop_goal_overview(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    item record;
    v_eligible boolean;
BEGIN
    IF p_user IS NULL THEN RAISE EXCEPTION 'COOP_INVALID' USING ERRCODE = 'P0001'; END IF;
    FOR item IN SELECT m.goal_id FROM public.coop_goal_members m JOIN public.coop_goals g ON g.id = m.goal_id AND g.status = 'open'
        WHERE m.user_id = p_user AND m.status IN ('invited', 'active') ORDER BY m.goal_id LOOP
        PERFORM public.coop_goal_reconcile(item.goal_id);
    END LOOP;
    v_eligible := public.coop_goal_eligible(p_user);
    RETURN jsonb_build_object(
        'eligible', v_eligible,
        'goals', coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id', g.id, 'kind', g.kind, 'target', g.target, 'startsAt', g.starts_at, 'endsAt', g.ends_at,
            'createdByMe', g.created_by = p_user, 'done', public.coop_goal_done(g.id),
            'members', (SELECT jsonb_agg(x.user_id ORDER BY x.joined_at, x.user_id) FROM public.coop_goal_members x
                        WHERE x.goal_id = g.id AND x.status = 'active'),
            'invited', coalesce((SELECT jsonb_agg(jsonb_build_object('userId', x.user_id, 'mine', x.invited_by = p_user)
                        ORDER BY x.invited_at, x.user_id) FROM public.coop_goal_members x
                        WHERE x.goal_id = g.id AND x.status = 'invited'), '[]'::jsonb)) ORDER BY g.ends_at, g.id)
            FROM public.coop_goals g JOIN public.coop_goal_members m ON m.goal_id = g.id AND m.user_id = p_user AND m.status = 'active'
            WHERE g.status = 'open' AND v_eligible), '[]'::jsonb),
        'invitations', coalesce((SELECT jsonb_agg(jsonb_build_object(
            'goalId', g.id, 'kind', g.kind, 'target', g.target, 'endsAt', g.ends_at, 'invitedBy', m.invited_by,
            'members', (SELECT jsonb_agg(x.user_id ORDER BY x.joined_at, x.user_id) FROM public.coop_goal_members x
                        WHERE x.goal_id = g.id AND x.status = 'active')) ORDER BY m.invited_at, g.id)
            FROM public.coop_goals g JOIN public.coop_goal_members m ON m.goal_id = g.id AND m.user_id = p_user AND m.status = 'invited'
            WHERE g.status = 'open' AND v_eligible), '[]'::jsonb),
        'finished', coalesce((SELECT jsonb_agg(jsonb_build_object(
            'id', g.id, 'kind', g.kind, 'target', g.target, 'endsAt', g.ends_at, 'done', public.coop_goal_done(g.id))
            ORDER BY g.closed_at DESC, g.id)
            FROM public.coop_goals g JOIN public.coop_goal_members m ON m.goal_id = g.id AND m.user_id = p_user AND m.status = 'active'
            WHERE g.status = 'closed' AND g.closed_reason = 'ended' AND g.closed_at > now() - interval '14 days' AND v_eligible), '[]'::jsonb)
    );
END;
$$;

-- Mutual connections who may be asked: eligible, mutually connected, at most 60.
CREATE OR REPLACE FUNCTION public.coop_goal_candidates(p_user uuid)
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT coalesce((SELECT array_agg(c.followed_id ORDER BY c.created_at DESC, c.followed_id) FROM (
        SELECT f.followed_id, f.created_at FROM public.follows f
         WHERE f.follower_id = p_user AND public.coop_goal_eligible(p_user)
           AND public.coop_goal_mutual(p_user, f.followed_id) AND public.coop_goal_eligible(f.followed_id)
         ORDER BY f.created_at DESC, f.followed_id LIMIT 60) c), ARRAY[]::uuid[]);
$$;

-- A verified guardian's view of one child: does the child's age fit, is it on, how many open goals.
CREATE OR REPLACE FUNCTION public.coop_goal_guardian_view(p_guardian uuid, p_kid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.guardian_links WHERE parent_user_id = p_guardian AND kid_user_id = p_kid
        AND verification_status = 'verified') THEN
        RAISE EXCEPTION 'COOP_GUARDIAN_NOT_LINKED' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object(
        'ageFits', public.coop_goal_child_teen(p_kid),
        'enabled', public.coop_goal_guardian_allows(p_kid),
        'openGoals', (SELECT count(*) FROM public.coop_goal_members m JOIN public.coop_goals g ON g.id = m.goal_id AND g.status = 'open'
                      WHERE m.user_id = p_kid AND m.status = 'active'));
END;
$$;

-- A follow that ends between two people who share an open goal re-applies the rules to it.
CREATE OR REPLACE FUNCTION public.coop_goal_on_unfollow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item record;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.follower_id)
       OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.followed_id) THEN
        RETURN NULL;
    END IF;
    FOR item IN SELECT DISTINCT a.goal_id FROM public.coop_goal_members a
        JOIN public.coop_goal_members b ON b.goal_id = a.goal_id AND b.user_id = OLD.followed_id AND b.status IN ('invited', 'active')
        JOIN public.coop_goals g ON g.id = a.goal_id AND g.status = 'open'
        WHERE a.user_id = OLD.follower_id AND a.status IN ('invited', 'active') ORDER BY a.goal_id LOOP
        PERFORM public.coop_goal_reconcile(item.goal_id);
    END LOOP;
    RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS coop_goal_unfollow ON public.follows;
CREATE TRIGGER coop_goal_unfollow AFTER DELETE ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.coop_goal_on_unfollow();

DO $$
DECLARE fn text;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'create_coop_goal(uuid, integer, integer, uuid[])', 'invite_coop_goal_member(uuid, uuid, uuid)',
        'decide_coop_goal_invitation(uuid, uuid, boolean)', 'end_coop_goal_membership(uuid, uuid, uuid)',
        'set_coop_goal_guardian_consent(uuid, uuid, boolean)', 'coop_goal_overview(uuid)',
        'coop_goal_candidates(uuid)', 'coop_goal_guardian_view(uuid, uuid)']
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
    END LOOP;
    REVOKE ALL ON FUNCTION public.coop_goal_on_unfollow() FROM PUBLIC, anon, authenticated, service_role;
END $$;
