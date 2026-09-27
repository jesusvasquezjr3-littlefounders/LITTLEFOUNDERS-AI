-- @phase: expand
-- learning_bridge_offer_repair: bridge prompts can be offered again, and a
-- prompt's goal is always its own learner's goal (B.13; L-12, owner decision
-- OD-28, 27 September 2026).
--
-- Merge reconciliation. Two lanes implemented L-12. The W2 learner lane's
-- 0180_teen_bridge_own_goal is the one kept: an independent teen's savings
-- goal from a self prompt lands in result_self_goal_id, and a teen without a
-- personal wallet gets 'no_wallet'. From the W3 owner-answers lane this file
-- keeps the two parts that do not depend on which design won:
--
--   * A defect found by that lane's native-PostgreSQL verifier: 0127's
--     offer_learning_bridge_prompt read its candidates with
--     `jsonb_to_recordset(...) WITH ORDINALITY AS c(kc_key text, ...)`, which
--     PostgreSQL rejects at run time ("WITH ORDINALITY cannot be used with a
--     column definition list"). Every offer therefore failed, so no bridge
--     prompt (guardian or self) could ever be stored; Core logs the failure and
--     learning proceeds (best-effort by design), which is why no route test
--     saw it (the RPC double does not parse SQL). The function is re-created
--     below with the same body, signature and grants, and the candidates read
--     through `ROWS FROM (jsonb_to_recordset(...) AS (...)) WITH ORDINALITY`.
--   * An owner guard for every writer, the service role included: a prompt's
--     result goal (result_goal_id for a guardian prompt, result_self_goal_id
--     for a teen's own goal) must belong to the prompt's learner, so no prompt
--     can ever point at another account's goal. Every goal the deployed
--     act_on_learning_bridge_prompt writes already satisfies it.
--
-- Additive: one function body corrected, one new trigger. No CHECK is touched.

-- ── The owner guard: a prompt's goal is always its learner's own goal ───────
CREATE OR REPLACE FUNCTION public.guard_learning_bridge_prompt_goal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NEW.result_goal_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.savings_goals g
        WHERE g.id = NEW.result_goal_id AND g.kid_user_id = NEW.learner_id
    ) THEN
        RAISE EXCEPTION 'BRIDGE_GOAL_NOT_LEARNERS' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.result_self_goal_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.savings_goals g
        WHERE g.id = NEW.result_self_goal_id AND g.kid_user_id = NEW.learner_id
    ) THEN
        RAISE EXCEPTION 'BRIDGE_GOAL_NOT_LEARNERS' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_learning_bridge_prompt_goal() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS learning_bridge_prompt_goal_guard ON public.learning_bridge_prompts;
CREATE TRIGGER learning_bridge_prompt_goal_guard
    BEFORE INSERT OR UPDATE OF result_goal_id, result_self_goal_id, learner_id ON public.learning_bridge_prompts
    FOR EACH ROW EXECUTE FUNCTION public.guard_learning_bridge_prompt_goal();

-- ── Offering a prompt (0127's body; only the candidate read is corrected) ──
-- Candidates come from Core's reviewed bridge catalog, in priority order:
-- [{"kc_key": "...", "action": "..."}]. The audience is re-checked here
-- against the guardian links: a guardian prompt needs a verified guardian, a
-- self prompt needs none.
CREATE OR REPLACE FUNCTION public.offer_learning_bridge_prompt(
    p_learner_id    uuid,
    p_audience      text,
    p_candidates    jsonb,
    p_course_id     uuid,
    p_topic_id      uuid,
    p_lesson_id     uuid,
    p_ttl_days      integer DEFAULT 14,
    p_cooldown_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_guardian boolean;
    v_candidate    record;
    v_kc_id        uuid;
    v_id           uuid;
BEGIN
    IF p_audience NOT IN ('guardian', 'self') THEN
        RAISE EXCEPTION 'offer_learning_bridge_prompt: unknown audience' USING ERRCODE = '22023';
    END IF;
    IF p_candidates IS NULL OR jsonb_typeof(p_candidates) <> 'array' OR jsonb_array_length(p_candidates) > 16 THEN
        RAISE EXCEPTION 'offer_learning_bridge_prompt: candidates must be an array of at most 16' USING ERRCODE = '22023';
    END IF;
    IF p_ttl_days NOT BETWEEN 1 AND 60 OR p_cooldown_days NOT BETWEEN 0 AND 365 THEN
        RAISE EXCEPTION 'offer_learning_bridge_prompt: expiry or cooldown out of range' USING ERRCODE = '22023';
    END IF;

    -- One learner's offers are serialized, so two completions cannot race past
    -- the one-open-prompt and cooldown rules.
    PERFORM pg_advisory_xact_lock(hashtextextended('learning_bridge:' || p_learner_id::text, 0));

    v_has_guardian := EXISTS (
        SELECT 1 FROM public.guardian_links gl
        WHERE gl.kid_user_id = p_learner_id AND gl.verification_status = 'verified'
    );
    IF (p_audience = 'guardian') <> v_has_guardian THEN
        RETURN jsonb_build_object('offered', false, 'reason', 'audience');
    END IF;

    UPDATE public.learning_bridge_prompts
       SET status = 'expired', closed_at = expires_at
     WHERE learner_id = p_learner_id AND status = 'open' AND expires_at <= now();

    FOR v_candidate IN
        SELECT c.kc_key, c.action
        FROM ROWS FROM (jsonb_to_recordset(p_candidates) AS (kc_key text, action text)) WITH ORDINALITY AS c(kc_key, action, ord)
        ORDER BY c.ord
    LOOP
        CONTINUE WHEN v_candidate.action NOT IN ('savings_goal', 'earning_task');
        SELECT k.id INTO v_kc_id FROM public.kc k WHERE k.key = v_candidate.kc_key AND k.status <> 'retired';
        CONTINUE WHEN v_kc_id IS NULL;
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM public.learning_bridge_prompts p
            WHERE p.learner_id = p_learner_id AND p.kc_id = v_kc_id);
        CONTINUE WHEN EXISTS (
            SELECT 1 FROM public.learning_bridge_prompts p
            WHERE p.learner_id = p_learner_id AND p.action = v_candidate.action
              AND (p.status = 'open' OR p.created_at > now() - make_interval(days => p_cooldown_days)));

        INSERT INTO public.learning_bridge_prompts (
            learner_id, kc_id, action, audience, course_id, topic_id, lesson_id, expires_at
        ) VALUES (
            p_learner_id, v_kc_id, v_candidate.action, p_audience, p_course_id, p_topic_id, p_lesson_id,
            now() + make_interval(days => p_ttl_days)
        ) RETURNING id INTO v_id;
        RETURN jsonb_build_object('offered', true, 'prompt_id', v_id, 'action', v_candidate.action, 'kc_key', v_candidate.kc_key);
    END LOOP;

    RETURN jsonb_build_object('offered', false, 'reason', 'none_eligible');
END;
$$;

REVOKE ALL ON FUNCTION public.offer_learning_bridge_prompt(uuid, text, jsonb, uuid, uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.offer_learning_bridge_prompt(uuid, text, jsonb, uuid, uuid, uuid, integer, integer) TO service_role;

SELECT 'learning_bridge_offer_repair_ok' AS sentinel;
