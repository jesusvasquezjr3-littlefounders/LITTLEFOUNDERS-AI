-- @phase: expand
-- coop_goal_guardian_goals — the verified Tutor sees which goals together a
-- parent-created child is in, and with whom (Product 10 E.2 "readable by the
-- relevant guardian"; Law 5 "nothing about a child happens out of the
-- parent's sight"; OD-27 (1) "every connection rule still applies"; Block E
-- component 2, the parent stays in the room).
--
-- Before this file the guardian's only read was coop_goal_guardian_view
-- (teen_cooperative_goal_actions): whether the age fits, whether the opt-in
-- is on, and a COUNT of open goals. A Tutor who turned goals together on saw
-- a number, never the goals, the other members or the pending asks.
--
-- public.coop_goal_guardian_goals(p_guardian, p_kid), service role only (Core
-- passes the session guardian):
--   - refuses a caller without a verified guardian link to this child
--     (COOP_GUARDIAN_NOT_LINKED, the same answer as the opt-in functions);
--   - refuses a child outside the guardian social tier (COOP_NOT_ALLOWED): a
--     self-registered teen's goals stay its own (OD-3 Option B, E.8), even
--     when a Tutor is linked;
--   - reconciles every open goal the child is asked to or in first (the
--     same step the child's own overview runs), so the answer obeys every
--     rule now;
--   - returns at most 50 open goals: the preset kind and target, the window,
--     whether the child started it, the child's own status (invited or
--     active) and every other person with a status: invited (asked), active
--     (joined) or ended after joining (left). Someone who ended without ever
--     joining (declined, withdrawn, lapsed) was never in the goal and is not
--     listed.
-- No progress of any kind is returned: the group total stays with the
-- group's own members, and there is no per-member number anywhere (OD-27 (1)).
-- STABLE is not declared: the reconcile step may end memberships and write
-- their audit rows, exactly like coop_goal_overview. Applying this file
-- changes no row.

CREATE OR REPLACE FUNCTION public.coop_goal_guardian_goals(p_guardian uuid, p_kid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item record;
BEGIN
    IF p_guardian IS NULL OR p_kid IS NULL OR p_guardian = p_kid THEN
        RAISE EXCEPTION 'COOP_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.guardian_links WHERE parent_user_id = p_guardian AND kid_user_id = p_kid
        AND verification_status = 'verified') THEN
        RAISE EXCEPTION 'COOP_GUARDIAN_NOT_LINKED' USING ERRCODE = 'P0001';
    END IF;
    IF public.social_tier(p_kid) IS DISTINCT FROM 'guardian' THEN
        RAISE EXCEPTION 'COOP_NOT_ALLOWED' USING ERRCODE = 'P0001';
    END IF;
    FOR item IN SELECT m.goal_id FROM public.coop_goal_members m JOIN public.coop_goals g ON g.id = m.goal_id AND g.status = 'open'
        WHERE m.user_id = p_kid AND m.status IN ('invited', 'active') ORDER BY m.goal_id LOOP
        PERFORM public.coop_goal_reconcile(item.goal_id);
    END LOOP;
    RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', x.id, 'kind', x.kind, 'target', x.target, 'startsAt', x.starts_at, 'endsAt', x.ends_at,
        'startedByChild', x.created_by IS NOT DISTINCT FROM p_kid, 'childStatus', x.child_status,
        'people', coalesce((SELECT jsonb_agg(jsonb_build_object('userId', o.user_id, 'status', o.status)
                    ORDER BY o.status = 'ended', coalesce(o.joined_at, o.invited_at), o.user_id)
                  FROM public.coop_goal_members o
                  WHERE o.goal_id = x.id AND o.user_id <> p_kid
                    AND (o.status IN ('invited', 'active') OR (o.status = 'ended' AND o.joined_at IS NOT NULL))), '[]'::jsonb))
        ORDER BY x.ends_at, x.id)
        FROM (SELECT g.id, g.kind, g.target, g.starts_at, g.ends_at, g.created_by, m.status AS child_status
                FROM public.coop_goals g JOIN public.coop_goal_members m ON m.goal_id = g.id AND m.user_id = p_kid
               WHERE g.status = 'open' AND m.status IN ('invited', 'active')
               ORDER BY g.ends_at, g.id LIMIT 50) x), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.coop_goal_guardian_goals(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.coop_goal_guardian_goals(uuid, uuid) TO service_role;
