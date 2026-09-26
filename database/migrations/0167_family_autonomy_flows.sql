-- family_autonomy_flows — S07.5, part 3 of 6 (D.17): who may move a level,
-- and the flows that move it (a Tutor, the child stepping down or asking,
-- staff with manage_support), plus the eligibility log's writer and the
-- status the child and the Tutor read.
-- @phase: expand
--
-- Rationale: family_autonomy_ladder (part 1) and
-- docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md.

-- ── The level-change guard: who may move a level, and when ──────────────────
CREATE OR REPLACE FUNCTION public.guard_family_autonomy_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_cur record;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF public.family_only_nulled(public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW)), ARRAY['actor_user_id', 'request_id'], to_jsonb(NEW))
           OR public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW)) = '{}'::text[] THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'AUTONOMY_CHANGE_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.family_child_in_family(NEW.kid_user_id) THEN
        RAISE EXCEPTION 'AUTONOMY_NOT_IN_FAMILY' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_cur FROM public.family_autonomy_level(NEW.kid_user_id);
    IF NEW.from_level <> v_cur.stored_level OR NEW.from_limit <> v_cur.stored_limit THEN
        RAISE EXCEPTION 'AUTONOMY_STALE' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.family_autonomy_changes WHERE kid_user_id = NEW.kid_user_id AND created_at = now()) THEN
        RAISE EXCEPTION 'AUTONOMY_STALE' USING ERRCODE = 'P0001', DETAIL = 'One level change per transaction.';
    END IF;
    IF NEW.to_limit < 0 OR NEW.to_limit > public.family_autonomy_cap(NEW.to_level) THEN
        RAISE EXCEPTION 'AUTONOMY_LIMIT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.to_level = NEW.from_level AND NEW.to_limit = NEW.from_limit THEN
        RAISE EXCEPTION 'AUTONOMY_NO_CHANGE' USING ERRCODE = 'P0001';
    END IF;
    NEW.created_at := now();

    IF NEW.actor_kind = 'tutor' THEN
        IF NOT public.family_is_verified_guardian(NEW.actor_user_id, NEW.kid_user_id) THEN
            RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.to_level > NEW.from_level THEN
            IF NOT public.family_autonomy_eligible_for(NEW.kid_user_id, NEW.to_level) THEN
                RAISE EXCEPTION 'AUTONOMY_NOT_ELIGIBLE' USING ERRCODE = 'P0001';
            END IF;
            IF NEW.reason_code IS NOT NULL THEN
                RAISE EXCEPTION 'AUTONOMY_REASON_INVALID' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.to_level < NEW.from_level THEN
            IF NEW.reason_code IS NULL OR NEW.reason_code NOT IN ('practice_more', 'talk_first', 'not_suitable')
               OR NOT public.family_reason_actionable(NEW.reason) THEN
                RAISE EXCEPTION 'AUTONOMY_REASON_REQUIRED' USING ERRCODE = 'P0001';
            END IF;
        ELSIF NEW.reason_code IS NOT NULL THEN
            RAISE EXCEPTION 'AUTONOMY_REASON_INVALID' USING ERRCODE = 'P0001';
        END IF;
    ELSIF NEW.actor_kind = 'child' THEN
        IF NEW.actor_user_id IS DISTINCT FROM NEW.kid_user_id OR NEW.to_level >= NEW.from_level
           OR NEW.to_limit <> least(NEW.from_limit, public.family_autonomy_cap(NEW.to_level))
           OR NEW.reason_code IS NOT NULL OR NEW.reason IS NOT NULL THEN
            RAISE EXCEPTION 'AUTONOMY_CHILD_STEP_DOWN_ONLY' USING ERRCODE = 'P0001';
        END IF;
    ELSIF NEW.actor_kind = 'staff' THEN
        IF NOT public.family_staff_may_support(NEW.actor_user_id) THEN
            RAISE EXCEPTION 'AUTONOMY_STAFF_FORBIDDEN' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.to_level >= NEW.from_level OR NEW.to_limit <> least(NEW.from_limit, public.family_autonomy_cap(NEW.to_level)) THEN
            RAISE EXCEPTION 'AUTONOMY_STAFF_LOWER_ONLY' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.reason_code IS DISTINCT FROM 'staff_review' OR NOT public.family_reason_actionable(NEW.reason) THEN
            RAISE EXCEPTION 'AUTONOMY_REASON_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
    ELSE
        -- The system acts only from the questioned-pattern trigger, one level down.
        IF pg_trigger_depth() < 2 OR NEW.actor_user_id IS NOT NULL OR NEW.to_level <> NEW.from_level - 1
           OR NEW.to_limit <> least(NEW.from_limit, public.family_autonomy_cap(NEW.to_level))
           OR NEW.reason_code IS DISTINCT FROM 'questioned_pattern' OR NEW.reason IS NOT NULL THEN
            RAISE EXCEPTION 'AUTONOMY_SYSTEM_FORBIDDEN' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_family_autonomy_change() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS family_autonomy_change_guard ON public.family_autonomy_changes;
CREATE TRIGGER family_autonomy_change_guard BEFORE INSERT OR UPDATE ON public.family_autonomy_changes
    FOR EACH ROW EXECUTE FUNCTION public.guard_family_autonomy_change();

-- The level row moves only with the change row of the same transaction.
CREATE OR REPLACE FUNCTION public.guard_family_autonomy_level()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.kid_user_id <> OLD.kid_user_id THEN
        RAISE EXCEPTION 'AUTONOMY_CHANGE_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.family_autonomy_changes
                   WHERE kid_user_id = NEW.kid_user_id AND to_level = NEW.level AND to_limit = NEW.preapproved_limit AND created_at = now()) THEN
        RAISE EXCEPTION 'AUTONOMY_CHANGE_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF TG_OP = 'INSERT' OR NEW.level <> OLD.level THEN
        NEW.level_since := now();
    ELSE
        NEW.level_since := OLD.level_since;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_family_autonomy_level() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS family_autonomy_level_guard ON public.family_autonomy_levels;
CREATE TRIGGER family_autonomy_level_guard BEFORE INSERT OR UPDATE ON public.family_autonomy_levels
    FOR EACH ROW EXECUTE FUNCTION public.guard_family_autonomy_level();

-- And no change row without its level row at commit.
CREATE OR REPLACE FUNCTION public.check_family_autonomy_change_applied()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.family_autonomy_levels
                   WHERE kid_user_id = NEW.kid_user_id AND level = NEW.to_level AND preapproved_limit = NEW.to_limit) THEN
        RAISE EXCEPTION 'AUTONOMY_CHANGE_UNAPPLIED' USING ERRCODE = 'P0001';
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.check_family_autonomy_change_applied() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS family_autonomy_change_applied ON public.family_autonomy_changes;
CREATE CONSTRAINT TRIGGER family_autonomy_change_applied AFTER INSERT ON public.family_autonomy_changes
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_family_autonomy_change_applied();

-- ── Producing flows (service role only; serialized on the child's wallet
-- lock like every S07 flow; the guards above decide) ────────────────────────

-- One change, applied: the change row, then the level row it describes.
CREATE OR REPLACE FUNCTION public.family_autonomy_apply(
    p_kid uuid, p_actor uuid, p_actor_kind text, p_to_level int, p_to_limit int, p_reason_code text, p_reason text, p_request uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_cur record;
BEGIN
    SELECT * INTO v_cur FROM public.family_autonomy_level(p_kid);
    INSERT INTO public.family_autonomy_changes (kid_user_id, from_level, to_level, from_limit, to_limit, actor_user_id, actor_kind, reason_code, reason, request_id)
    VALUES (p_kid, v_cur.stored_level, p_to_level, v_cur.stored_limit, p_to_limit, p_actor, p_actor_kind, p_reason_code, nullif(btrim(p_reason), ''), p_request);
    INSERT INTO public.family_autonomy_levels (kid_user_id, level, preapproved_limit)
    VALUES (p_kid, p_to_level, p_to_limit)
    ON CONFLICT (kid_user_id) DO UPDATE SET level = EXCLUDED.level, preapproved_limit = EXCLUDED.preapproved_limit;
    -- A promotion proves eligibility at this moment: the progression metric
    -- never loses a child promoted before the nightly sweep saw them.
    IF p_to_level > v_cur.stored_level THEN
        INSERT INTO public.family_autonomy_eligibility_log (kid_user_id, level) VALUES (p_kid, p_to_level)
        ON CONFLICT (kid_user_id, level) DO NOTHING;
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.family_autonomy_apply(uuid, uuid, text, int, int, text, text, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- A Tutor sets the level and the pre-approved amount. Up only when eligible,
-- down with an actionable reason. A pending request the new level covers is
-- granted in the same transaction.
CREATE OR REPLACE FUNCTION public.family_autonomy_set(
    p_kid uuid, p_actor uuid, p_level int, p_limit int, p_reason_code text DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_request  public.family_autonomy_requests%ROWTYPE;
    v_decision uuid;
BEGIN
    IF p_kid IS NULL OR p_actor IS NULL OR p_level IS NULL OR p_limit IS NULL THEN
        RAISE EXCEPTION 'AUTONOMY_LIMIT_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid::text, 1));
    IF NOT public.family_is_verified_guardian(p_actor, p_kid) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    PERFORM public.family_autonomy_apply(p_kid, p_actor, 'tutor', p_level, p_limit, p_reason_code, p_reason, NULL);
    SELECT * INTO v_request FROM public.family_autonomy_requests
    WHERE kid_user_id = p_kid AND status = 'pending' AND requested_level <= p_level FOR UPDATE;
    IF FOUND THEN
        INSERT INTO public.family_decisions (kid_user_id, subject, level_request_id, prior_status, outcome, actor_user_id, actor_kind)
        VALUES (p_kid, 'level_request', v_request.id, 'pending', 'granted', p_actor, 'tutor')
        RETURNING id INTO v_decision;
        UPDATE public.family_autonomy_requests SET status = 'granted', decision_id = v_decision WHERE id = v_request.id;
    END IF;
    RETURN p_level;
END;
$$;

-- The child steps down one level on their own (volitional, no reason asked).
CREATE OR REPLACE FUNCTION public.family_autonomy_step_down(p_kid uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_cur record;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid::text, 1));
    SELECT * INTO v_cur FROM public.family_autonomy_level(p_kid);
    IF v_cur.stored_level <= 1 THEN
        RAISE EXCEPTION 'AUTONOMY_CHILD_STEP_DOWN_ONLY' USING ERRCODE = 'P0001';
    END IF;
    PERFORM public.family_autonomy_apply(p_kid, p_kid, 'child', v_cur.stored_level - 1,
        least(v_cur.stored_limit, public.family_autonomy_cap(v_cur.stored_level - 1)), NULL, NULL, NULL);
    RETURN v_cur.stored_level - 1;
END;
$$;

-- Staff with manage_support lower a level, with a reason the family reads.
CREATE OR REPLACE FUNCTION public.family_autonomy_staff_lower(p_kid uuid, p_staff uuid, p_level int, p_reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_cur record;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid::text, 1));
    SELECT * INTO v_cur FROM public.family_autonomy_level(p_kid);
    PERFORM public.family_autonomy_apply(p_kid, p_staff, 'staff', p_level,
        least(v_cur.stored_limit, public.family_autonomy_cap(p_level)), 'staff_review', p_reason, NULL);
    RETURN p_level;
END;
$$;

-- The child asks for the next level, optionally in their own words.
CREATE OR REPLACE FUNCTION public.family_autonomy_request_level(p_kid uuid, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_note  text := nullif(btrim(coalesce(p_note, '')), '');
    v_level int;
    v_id    uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid::text, 1));
    IF v_note IS NOT NULL AND char_length(v_note) > public.family_autonomy_threshold('child_note_max_chars') THEN
        RAISE EXCEPTION 'AUTONOMY_REQUEST_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.family_autonomy_requests WHERE kid_user_id = p_kid AND status = 'pending') THEN
        RAISE EXCEPTION 'AUTONOMY_REQUEST_PENDING' USING ERRCODE = 'P0001';
    END IF;
    SELECT stored_level INTO v_level FROM public.family_autonomy_level(p_kid);
    IF v_level >= 3 THEN
        RAISE EXCEPTION 'AUTONOMY_REQUEST_INVALID' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.family_autonomy_requests (kid_user_id, requested_level, child_note)
    VALUES (p_kid, v_level + 1, v_note) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- A Tutor answers the child's ask: grant (the level moves, eligibility
-- checked by the change guard) or "not yet" with an actionable reason.
CREATE OR REPLACE FUNCTION public.family_autonomy_decide_request(
    p_request uuid, p_actor uuid, p_grant boolean, p_limit int, p_reason_code text, p_reason text, p_revisit_on date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_kid      uuid;
    v_request  public.family_autonomy_requests%ROWTYPE;
    v_decision uuid;
BEGIN
    SELECT kid_user_id INTO v_kid FROM public.family_autonomy_requests WHERE id = p_request;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'AUTONOMY_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_kid::text, 1));
    IF NOT public.family_is_verified_guardian(p_actor, v_kid) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_request FROM public.family_autonomy_requests WHERE id = p_request FOR UPDATE;
    IF v_request.status <> 'pending' THEN
        RAISE EXCEPTION 'AUTONOMY_REQUEST_DECIDED' USING ERRCODE = 'P0001';
    END IF;
    IF p_grant THEN
        PERFORM public.family_autonomy_apply(v_kid, p_actor, 'tutor', v_request.requested_level, coalesce(p_limit, 0), NULL, NULL, p_request);
        INSERT INTO public.family_decisions (kid_user_id, subject, level_request_id, prior_status, outcome, actor_user_id, actor_kind)
        VALUES (v_kid, 'level_request', p_request, 'pending', 'granted', p_actor, 'tutor') RETURNING id INTO v_decision;
        UPDATE public.family_autonomy_requests SET status = 'granted', decision_id = v_decision WHERE id = p_request;
        RETURN 'granted';
    END IF;
    INSERT INTO public.family_decisions (kid_user_id, subject, level_request_id, prior_status, outcome, actor_user_id, actor_kind, reason_code, reason, revisit_on)
    VALUES (v_kid, 'level_request', p_request, 'pending', 'declined', p_actor, 'tutor', p_reason_code, p_reason, p_revisit_on)
    RETURNING id INTO v_decision;
    UPDATE public.family_autonomy_requests SET status = 'declined', decision_id = v_decision WHERE id = p_request;
    RETURN 'declined';
END;
$$;

REVOKE ALL ON FUNCTION public.family_autonomy_set(uuid, uuid, int, int, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_autonomy_step_down(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_autonomy_staff_lower(uuid, uuid, int, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_autonomy_request_level(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_autonomy_decide_request(uuid, uuid, boolean, int, text, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_autonomy_set(uuid, uuid, int, int, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_autonomy_step_down(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_autonomy_staff_lower(uuid, uuid, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_autonomy_request_level(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_autonomy_decide_request(uuid, uuid, boolean, int, text, text, date) TO service_role;

-- The eligibility log: the first moment a child met the rule for their next
-- level. Written after every decision (family_talk_nudges) and by the nightly
-- sweep (a birthday changes eligibility without any decision).
CREATE OR REPLACE FUNCTION public.record_family_autonomy_eligibility(p_kid uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_level int;
    v_added int;
BEGIN
    SELECT stored_level INTO v_level FROM public.family_autonomy_level(p_kid);
    IF v_level >= 3 OR NOT public.family_autonomy_eligible_for(p_kid, v_level + 1) THEN
        RETURN 0;
    END IF;
    INSERT INTO public.family_autonomy_eligibility_log (kid_user_id, level) VALUES (p_kid, v_level + 1)
    ON CONFLICT (kid_user_id, level) DO NOTHING;
    GET DIAGNOSTICS v_added = ROW_COUNT;
    RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_family_autonomy_eligibility_all()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_kid   uuid;
    v_total int := 0;
BEGIN
    FOR v_kid IN SELECT DISTINCT gl.kid_user_id FROM public.guardian_links gl WHERE gl.verification_status = 'verified' LOOP
        IF public.family_child_in_family(v_kid) THEN
            v_total := v_total + public.record_family_autonomy_eligibility(v_kid);
        END IF;
    END LOOP;
    RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.record_family_autonomy_eligibility(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.record_family_autonomy_eligibility_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_family_autonomy_eligibility_all() TO service_role;

-- What the child and the Tutor read: the level as it applies today, what it
-- unlocks, the rule for the next level with the child's own numbers, and
-- the pending request if any.
CREATE OR REPLACE FUNCTION public.family_autonomy_status(p_kid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_cur     record;
    v_request public.family_autonomy_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_cur FROM public.family_autonomy_level(p_kid);
    SELECT * INTO v_request FROM public.family_autonomy_requests WHERE kid_user_id = p_kid AND status = 'pending';
    RETURN jsonb_build_object(
        'in_family', public.family_child_in_family(p_kid),
        'level', v_cur.level,
        'preapproved_limit', v_cur.preapproved_limit,
        'stored_level', v_cur.stored_level,
        'level_since', v_cur.level_since,
        'preapproved_cap', public.family_autonomy_cap(v_cur.level),
        'self_log_contributions', v_cur.level >= 2,
        'self_log_max_coins', CASE WHEN v_cur.level >= 3 THEN public.family_autonomy_threshold('level3_self_log_max_coins') ELSE NULL END,
        'next', CASE WHEN v_cur.stored_level < 3 THEN public.family_autonomy_eligibility(p_kid, v_cur.stored_level + 1) ELSE NULL END,
        'request', CASE WHEN v_request.id IS NULL THEN NULL
                        ELSE jsonb_build_object('id', v_request.id, 'level', v_request.requested_level,
                                                'note', v_request.child_note, 'created_at', v_request.created_at) END);
END;
$$;
REVOKE ALL ON FUNCTION public.family_autonomy_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_autonomy_status(uuid) TO service_role;

SELECT 'family_autonomy_flows_ok' AS sentinel;
