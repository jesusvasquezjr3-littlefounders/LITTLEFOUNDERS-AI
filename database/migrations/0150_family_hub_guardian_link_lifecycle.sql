-- family_hub_guardian_link_lifecycle — S07.1, part 4 of 5 (D.4 / D.5, OD-21): the guardian-link state
-- machine, suspension on revocation and the transition audit recorder.
-- @phase: contract
-- @after-release: none — guardian-link writes are narrowed to the legal
--   transitions; the only existing writers (kid creation, invite acceptance,
--   dev seeds) insert verified links, which stay legal. Apply with the Core release that ships the
--   S07.1 routes, after family_hub_state_machine, never ahead of it.
--
-- Rationale and the full state-machine description: family_hub_state_machine
-- (part 1) and docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

-- ── Guardian link state machine ─────────────────────────────────────────────
-- INSERT: pending (an accepted invite awaiting confirmation) or verified.
-- pending  -> verified | rejected  : decided by ANOTHER verified guardian.
-- verified -> revoked              : the guardian themself stepping away.
-- pending | rejected | revoked -> pending : a newer invite was accepted.
-- pending | rejected | revoked -> verified : a newer invite was accepted for a
--                                    child with no verified guardian left to confirm.
CREATE OR REPLACE FUNCTION public.guard_guardian_link_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
    v_others  boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.verification_status NOT IN ('pending', 'verified')
           OR (NEW.verification_status = 'verified' AND NEW.verified_at IS NULL)
           OR (NEW.verification_status = 'pending' AND NEW.verified_at IS NOT NULL)
           OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.revoked_by IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[]
       OR public.family_only_nulled(v_changed, ARRAY['invite_id', 'decided_by', 'revoked_by'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'parent_user_id', 'kid_user_id', 'created_at'] THEN
        RAISE EXCEPTION 'GUARDIAN_LINK_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;

    v_others := EXISTS (
        SELECT 1 FROM public.guardian_links
        WHERE kid_user_id = NEW.kid_user_id AND id <> NEW.id AND verification_status = 'verified'
    );

    IF OLD.verification_status = 'pending' AND NEW.verification_status IN ('verified', 'rejected')
       AND NEW.decided_by IS NOT NULL THEN
        IF NEW.decided_by = NEW.parent_user_id
           OR NOT public.family_is_verified_guardian(NEW.decided_by, NEW.kid_user_id) OR NEW.decided_at IS NULL
           OR (NEW.verification_status = 'verified' AND NEW.verified_at IS NULL)
           OR (NEW.verification_status = 'rejected' AND NEW.verified_at IS NOT NULL) THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_DECISION_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF OLD.verification_status = 'verified' AND NEW.verification_status = 'revoked' THEN
        IF NEW.revoked_by IS DISTINCT FROM NEW.parent_user_id OR NEW.revoked_at IS NULL THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_REVOCATION_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF OLD.verification_status IN ('pending', 'rejected', 'revoked') AND NEW.verification_status = 'pending' THEN
        IF NEW.invite_id IS NULL OR NEW.invite_id IS NOT DISTINCT FROM OLD.invite_id OR NEW.verified_at IS NOT NULL
           OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL OR NEW.revoked_by IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_REINVITE_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF OLD.verification_status IN ('pending', 'rejected', 'revoked') AND NEW.verification_status = 'verified' THEN
        IF v_others OR NEW.invite_id IS NULL OR NEW.invite_id IS NOT DISTINCT FROM OLD.invite_id OR NEW.verified_at IS NULL
           OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
           OR NEW.revoked_by IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION 'GUARDIAN_LINK_REINVITE_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSE
        RAISE EXCEPTION 'GUARDIAN_LINK_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
            DETAIL = format('%s -> %s', OLD.verification_status, NEW.verification_status);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_guardian_link_state() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS guardian_link_state_guard ON public.guardian_links;
CREATE TRIGGER guardian_link_state_guard BEFORE INSERT OR UPDATE ON public.guardian_links
    FOR EACH ROW EXECUTE FUNCTION public.guard_guardian_link_state();

-- A revocation that empties the child's verified set suspends the child the
-- same way a deleted link does (0110). The existing trigger only watched DELETE.
DROP TRIGGER IF EXISTS guardian_link_suspension_on_status ON public.guardian_links;
CREATE TRIGGER guardian_link_suspension_on_status
    AFTER UPDATE OF verification_status ON public.guardian_links
    FOR EACH ROW EXECUTE FUNCTION public.suspend_unlinked_kid();

-- ── Transition recorder (invoker rights: db_role is the real writer) ────────
CREATE OR REPLACE FUNCTION public.record_family_state_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
    v_old   jsonb := to_jsonb(OLD);
    v_new   jsonb := to_jsonb(NEW);
    v_actor text;
    v_index int;
BEGIN
    IF v_old ->> TG_ARGV[0] IS NOT DISTINCT FROM v_new ->> TG_ARGV[0] THEN
        RETURN NULL;
    END IF;
    FOR v_index IN 2 .. TG_NARGS - 1 LOOP
        v_actor := coalesce(v_actor, v_new ->> TG_ARGV[v_index]);
    END LOOP;
    INSERT INTO public.family_state_audit (table_name, row_id, from_state, to_state, actor_user_id, request_role, db_role)
    VALUES (TG_TABLE_NAME, v_new ->> TG_ARGV[1], v_old ->> TG_ARGV[0], v_new ->> TG_ARGV[0],
            v_actor::uuid, public.family_request_role(), current_user);
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.record_family_state_transition() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_family_state_transition() TO service_role;

DROP TRIGGER IF EXISTS task_state_transition_audit ON public.tasks;
CREATE TRIGGER task_state_transition_audit AFTER UPDATE OF status ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.record_family_state_transition('status', 'id', 'decided_by');
DROP TRIGGER IF EXISTS savings_goal_state_transition_audit ON public.savings_goals;
CREATE TRIGGER savings_goal_state_transition_audit AFTER UPDATE OF status ON public.savings_goals
    FOR EACH ROW EXECUTE FUNCTION public.record_family_state_transition('status', 'id');
DROP TRIGGER IF EXISTS redemption_state_transition_audit ON public.redemptions;
CREATE TRIGGER redemption_state_transition_audit AFTER UPDATE OF status ON public.redemptions
    FOR EACH ROW EXECUTE FUNCTION public.record_family_state_transition('status', 'id', 'fulfilled_by', 'decided_by');
DROP TRIGGER IF EXISTS guardian_link_state_transition_audit ON public.guardian_links;
CREATE TRIGGER guardian_link_state_transition_audit AFTER UPDATE OF verification_status ON public.guardian_links
    FOR EACH ROW EXECUTE FUNCTION public.record_family_state_transition('verification_status', 'id', 'revoked_by', 'decided_by');
DROP TRIGGER IF EXISTS banking_account_freeze_transition_audit ON public.banking_accounts;
CREATE TRIGGER banking_account_freeze_transition_audit AFTER UPDATE OF frozen ON public.banking_accounts
    FOR EACH ROW EXECUTE FUNCTION public.record_family_state_transition('frozen', 'kid_user_id', 'frozen_by');

-- Appendix H's D.4 metric: transitions per table, and how many did not come
-- through the service layer (target: zero).
CREATE OR REPLACE FUNCTION public.family_state_integrity(p_since timestamptz)
RETURNS TABLE (table_name text, transitions bigint, outside_service bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT a.table_name, count(*), count(*) FILTER (WHERE a.request_role IS DISTINCT FROM 'service_role')
    FROM public.family_state_audit a
    WHERE a.created_at >= p_since
    GROUP BY a.table_name
    ORDER BY a.table_name;
$$;
REVOKE ALL ON FUNCTION public.family_state_integrity(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_state_integrity(timestamptz) TO service_role;

SELECT 'family_hub_guardian_link_lifecycle_ok' AS sentinel;
