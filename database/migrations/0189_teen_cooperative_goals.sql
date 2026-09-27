-- @phase: expand
-- L-04 (owner decision OD-27 (1), 27 September 2026): teen cooperative goals.
-- Teens 13 to 17 get one peer mechanic: a small group (2 to 5) of mutual
-- connections working toward one shared learning goal. No rankings, no public
-- progress, no messaging (E.10), no adults and no children under 13 in a
-- group, leave or remove at any time, a report path (E.3). No leaderboard in
-- any band. Policy: docs/rebuild/policies/SOCIAL-TIERS.md section 1.2.
--
-- Part 1 of 2: the tables, who may take part, what a mutual connection is,
-- and the reconcile step. Part 2 (teen_cooperative_goal_actions) adds the
-- functions Core calls and one AFTER DELETE trigger on follows. Additive: new
-- tables and functions only.
--
--   coop_goals                  One goal: a preset kind (finish lessons), a
--                               preset target and a 7, 14 or 28 day window.
--                               No free text anywhere (no name, no note).
--   coop_goal_members           Who is invited, active or ended, and why.
--                               One row per person per goal, so a person who
--                               declined, left or was removed cannot be asked
--                               again into the same goal.
--   coop_goal_guardian_consents A verified Tutor's opt-in for a parent-created
--                               child aged 13 to 17 (E.10 pattern: default
--                               off, guardian opt-in per child).
--
-- Who may take part (coop_goal_eligible, read on every action and every read):
--   * the teen social tier (self-registered 13 to 17, OD-3: no guardian asked), or
--   * a parent-created child whose profile birth date proves 13 to 17 today AND
--     whose current verified guardian turned cooperative goals on;
--   * and never a flagged profile (E.13). Adults, children under 13, guests
--     and every closed-tier account are refused.
--
-- A mutual connection (coop_goal_mutual) is a live follow both ways that each
-- side's own rule consented to: the guardian's approval for a child
-- (social_edge_consented), the teen's recorded consent for a teen (a
-- historical follow is not consent), or the family link; and no block.
-- Every member of a group is mutually connected with every other member.
--
-- Every write goes through a SECURITY DEFINER function that takes the goal's
-- advisory lock, re-checks every rule and writes its audit row in the same
-- transaction (E.2). Browsers have no access to any table or function; Core
-- calls them with the service role and always passes the session as the actor.
--
-- The group total is the only progress there is: lessons the active members
-- finished inside the window since each joined. It is returned only to the
-- group's own active members, never per member, never ranked, and it pays no
-- coins, XP or badge and triggers no celebration (OD-7 closed list).

CREATE TABLE IF NOT EXISTS public.coop_goals (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    kind          text NOT NULL DEFAULT 'lessons' CONSTRAINT coop_goals_kind_check CHECK (kind IN ('lessons')),
    target        integer NOT NULL CONSTRAINT coop_goals_target_check CHECK (target IN (5, 10, 15, 20, 30, 40)),
    starts_at     timestamptz NOT NULL DEFAULT now(),
    ends_at       timestamptz NOT NULL,
    status        text NOT NULL DEFAULT 'open' CONSTRAINT coop_goals_status_check CHECK (status IN ('open', 'closed')),
    closed_reason text CONSTRAINT coop_goals_closed_reason_check CHECK (closed_reason IN ('ended', 'too_small', 'empty')),
    closed_at     timestamptz,
    CONSTRAINT coop_goals_window CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '28 days'),
    CONSTRAINT coop_goals_closed_shape CHECK ((status = 'open') = (closed_at IS NULL) AND (status = 'open') = (closed_reason IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_coop_goals_open ON public.coop_goals (ends_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_coop_goals_closed ON public.coop_goals (closed_at) WHERE status = 'closed';
CREATE INDEX IF NOT EXISTS idx_coop_goals_created_by ON public.coop_goals (created_by) WHERE created_by IS NOT NULL;
ALTER TABLE public.coop_goals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coop_goals FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.coop_goals TO service_role;

CREATE TABLE IF NOT EXISTS public.coop_goal_members (
    goal_id    uuid NOT NULL REFERENCES public.coop_goals(id) ON DELETE CASCADE,
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    status     text NOT NULL CONSTRAINT coop_goal_members_status_check CHECK (status IN ('invited', 'active', 'ended')),
    end_reason text CONSTRAINT coop_goal_members_end_reason_check CHECK (end_reason IN (
        'declined', 'withdrawn', 'left', 'removed', 'lapsed', 'connection_ended', 'no_longer_eligible', 'guardian_off', 'goal_closed')),
    invited_at timestamptz NOT NULL DEFAULT now(),
    joined_at  timestamptz,
    ended_at   timestamptz,
    PRIMARY KEY (goal_id, user_id),
    CONSTRAINT coop_goal_members_shape CHECK (
        (status = 'ended') = (ended_at IS NOT NULL) AND (status = 'ended') = (end_reason IS NOT NULL)
        AND (status <> 'active' OR joined_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_coop_goal_members_user ON public.coop_goal_members (user_id, status);
CREATE INDEX IF NOT EXISTS idx_coop_goal_members_invited_by ON public.coop_goal_members (invited_by) WHERE invited_by IS NOT NULL;
ALTER TABLE public.coop_goal_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coop_goal_members FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.coop_goal_members TO service_role;

CREATE TABLE IF NOT EXISTS public.coop_goal_guardian_consents (
    kid_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    guardian_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled     boolean NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coop_goal_guardian_consents_guardian ON public.coop_goal_guardian_consents (guardian_id);
ALTER TABLE public.coop_goal_guardian_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coop_goal_guardian_consents FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.coop_goal_guardian_consents TO service_role;

-- ── Who may take part ────────────────────────────────────────────────────────
-- A parent-created child whose profile birth date proves 13 to 17 today. No
-- birth date is no evidence, so not eligible.
CREATE OR REPLACE FUNCTION public.coop_goal_child_teen(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'kid')
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_user AND p.birth_date IS NOT NULL
           AND p.birth_date <= ((now() AT TIME ZONE 'UTC')::date - interval '13 years')::date
           AND p.birth_date > ((now() AT TIME ZONE 'UTC')::date - interval '18 years')::date);
$$;

-- The opt-in counts only while the guardian who gave it is still a verified guardian.
CREATE OR REPLACE FUNCTION public.coop_goal_guardian_allows(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.coop_goal_guardian_consents c
        JOIN public.guardian_links l ON l.kid_user_id = c.kid_user_id AND l.parent_user_id = c.guardian_id
         AND l.verification_status = 'verified'
        WHERE c.kid_user_id = p_user AND c.enabled);
$$;

CREATE OR REPLACE FUNCTION public.coop_goal_eligible(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_user IS NOT NULL
       AND NOT public.profile_fields_flagged(p_user)
       AND CASE public.social_tier(p_user)
           WHEN 'teen' THEN true
           WHEN 'guardian' THEN public.coop_goal_child_teen(p_user) AND public.coop_goal_guardian_allows(p_user)
           ELSE false
       END;
$$;

-- One consented, unblocked follow from p_from to p_to.
CREATE OR REPLACE FUNCTION public.coop_goal_edge(p_from uuid, p_to uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_from IS NOT NULL AND p_to IS NOT NULL AND p_from <> p_to
       AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id = p_from AND followed_id = p_to)
       AND NOT EXISTS (SELECT 1 FROM public.blocks
           WHERE (blocker_id = p_from AND blocked_id = p_to) OR (blocker_id = p_to AND blocked_id = p_from))
       AND public.social_edge_consented(p_from, p_to)
       AND (public.social_tier(p_to) <> 'teen' OR public.social_family(p_from, p_to)
            OR public.has_current_teen_consent(p_from, p_to));
$$;

CREATE OR REPLACE FUNCTION public.coop_goal_mutual(p_a uuid, p_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT public.coop_goal_edge(p_a, p_b) AND public.coop_goal_edge(p_b, p_a);
$$;

-- ── Internal helpers ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.coop_goal_lock(p_goal uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('coop-goal:' || p_goal::text, 0));
$$;

CREATE OR REPLACE FUNCTION public.coop_goal_log(p_actor uuid, p_action text, p_subject uuid, p_goal uuid, p_detail jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, p_action, coalesce(p_subject::text, p_goal::text),
            jsonb_build_object('goal_id', p_goal, 'origin', 'database-function') || coalesce(p_detail, '{}'::jsonb));
$$;

-- Ends one invited or active membership. The reason is a code, never text.
CREATE OR REPLACE FUNCTION public.coop_goal_end_member(p_goal uuid, p_user uuid, p_reason text, p_actor uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    UPDATE public.coop_goal_members m SET status = 'ended', end_reason = p_reason, ended_at = now()
     WHERE m.goal_id = p_goal AND m.user_id = p_user AND m.status IN ('invited', 'active');
    IF NOT FOUND THEN RETURN false; END IF;
    PERFORM public.coop_goal_log(p_actor, 'social.coop_member_ended', p_user, p_goal, jsonb_build_object('reason', p_reason));
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.coop_goal_close(p_goal uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item record;
BEGIN
    FOR item IN SELECT user_id FROM public.coop_goal_members WHERE goal_id = p_goal AND status = 'invited' LOOP
        PERFORM public.coop_goal_end_member(p_goal, item.user_id, 'goal_closed', NULL);
    END LOOP;
    UPDATE public.coop_goals SET status = 'closed', closed_reason = p_reason, closed_at = now()
     WHERE id = p_goal AND status = 'open';
    IF FOUND THEN
        PERFORM public.coop_goal_log(NULL, 'social.coop_goal_closed', NULL, p_goal, jsonb_build_object('reason', p_reason));
    END IF;
END;
$$;

-- Re-applies every rule to one open goal: ineligible members end, an active
-- pair that is no longer mutually connected loses its later joiner (the same
-- for either side, so nobody learns who unfollowed or blocked), invitations
-- that no longer fit lapse, and a goal past its window, empty, or down to one
-- member with nobody asked closes.
CREATE OR REPLACE FUNCTION public.coop_goal_reconcile(p_goal uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    g record;
    item record;
    active_count integer;
    invited_count integer;
    pending_cutoff timestamptz := now() - make_interval(days => (public.social_retention_windows() ->> 'pendingRequestDays')::integer);
BEGIN
    PERFORM public.coop_goal_lock(p_goal);
    SELECT * INTO g FROM public.coop_goals WHERE id = p_goal FOR UPDATE;
    IF NOT FOUND OR g.status <> 'open' THEN RETURN; END IF;
    IF g.ends_at <= now() THEN
        PERFORM public.coop_goal_close(p_goal, 'ended');
        RETURN;
    END IF;
    FOR item IN SELECT user_id, status FROM public.coop_goal_members
        WHERE goal_id = p_goal AND status IN ('invited', 'active') ORDER BY user_id LOOP
        IF NOT public.coop_goal_eligible(item.user_id) THEN
            PERFORM public.coop_goal_end_member(p_goal, item.user_id,
                CASE item.status WHEN 'invited' THEN 'lapsed' ELSE 'no_longer_eligible' END, NULL);
        END IF;
    END LOOP;
    FOR item IN SELECT user_id FROM public.coop_goal_members
        WHERE goal_id = p_goal AND status = 'active' ORDER BY joined_at DESC, user_id DESC LOOP
        IF EXISTS (SELECT 1 FROM public.coop_goal_members o WHERE o.goal_id = p_goal AND o.status = 'active'
            AND o.user_id <> item.user_id AND NOT public.coop_goal_mutual(o.user_id, item.user_id)) THEN
            PERFORM public.coop_goal_end_member(p_goal, item.user_id, 'connection_ended', NULL);
        END IF;
    END LOOP;
    FOR item IN SELECT user_id, invited_at FROM public.coop_goal_members
        WHERE goal_id = p_goal AND status = 'invited' ORDER BY user_id LOOP
        IF item.invited_at < pending_cutoff OR EXISTS (SELECT 1 FROM public.coop_goal_members o
            WHERE o.goal_id = p_goal AND o.status = 'active' AND NOT public.coop_goal_mutual(o.user_id, item.user_id)) THEN
            PERFORM public.coop_goal_end_member(p_goal, item.user_id, 'lapsed', NULL);
        END IF;
    END LOOP;
    SELECT count(*) FILTER (WHERE status = 'active'), count(*) FILTER (WHERE status = 'invited')
      INTO active_count, invited_count FROM public.coop_goal_members WHERE goal_id = p_goal;
    IF active_count = 0 THEN
        PERFORM public.coop_goal_close(p_goal, 'empty');
    ELSIF active_count < 2 AND invited_count = 0 THEN
        PERFORM public.coop_goal_close(p_goal, 'too_small');
    END IF;
END;
$$;

-- The group total: lessons the active members first finished inside the window since each joined.
CREATE OR REPLACE FUNCTION public.coop_goal_done(p_goal uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT count(*)::integer
      FROM public.coop_goals g
      JOIN public.coop_goal_members m ON m.goal_id = g.id AND m.status = 'active'
      JOIN public.lesson_progress lp ON lp.user_id = m.user_id AND lp.passed AND lp.completed_at IS NOT NULL
       AND lp.completed_at >= greatest(g.starts_at, m.joined_at)
       AND lp.completed_at < least(g.ends_at, coalesce(g.closed_at, g.ends_at))
     WHERE g.id = p_goal;
$$;

DO $$
DECLARE fn text;
BEGIN
    FOREACH fn IN ARRAY ARRAY[
        'coop_goal_child_teen(uuid)', 'coop_goal_guardian_allows(uuid)', 'coop_goal_eligible(uuid)',
        'coop_goal_edge(uuid, uuid)', 'coop_goal_mutual(uuid, uuid)', 'coop_goal_lock(uuid)',
        'coop_goal_log(uuid, text, uuid, uuid, jsonb)', 'coop_goal_end_member(uuid, uuid, text, uuid)',
        'coop_goal_close(uuid, text)', 'coop_goal_reconcile(uuid)', 'coop_goal_done(uuid)']
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated, service_role', fn);
    END LOOP;
    GRANT EXECUTE ON FUNCTION public.coop_goal_eligible(uuid) TO service_role;
    GRANT EXECUTE ON FUNCTION public.coop_goal_mutual(uuid, uuid) TO service_role;
END $$;
