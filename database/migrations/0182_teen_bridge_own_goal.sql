-- teen_bridge_own_goal — L-12 (owner decision OD-28, 27 September 2026): an
-- independent teen's "I will try" on a savings-goal bridge prompt creates the
-- teen's own savings goal in their personal wallet (OD-3 Option B, D.3).
-- @phase: contract
-- @after-release: none — a pure widening in effect. The one CHECK dropped and
--   re-added (learning_bridge_prompts_goal_guardian ->
--   learning_bridge_prompts_goal_savings) accepts every row the old one did
--   and additionally a goal on an acted SELF savings-goal prompt; the new
--   owner guard only refuses a result goal that belongs to someone other than
--   the prompt's learner, which no deployed Core writes (Core writes the
--   table only through act_on_learning_bridge_prompt). Declared contract
--   because the phase gate counts every dropped-and-re-added CHECK as a
--   narrowing. An older Core keeps working unchanged: it acts on a self
--   prompt with all-null details, which still records a commitment only.
--
-- Rationale and evidence: docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md
-- (S05.3c, "Owner answers applied (OD-27, OD-28)"); native-PostgreSQL proof in
-- database/scripts/verify-teen-bridge-goal-postgres.py.
--
-- What changes, and what does not:
--
--   * A SELF prompt of action 'savings_goal', acted on by its own learner with
--     goal details (title 1-80, target 1-100000, an icon of the goal form's
--     set; no recurrence), inserts savings_goals(kid_user_id = the learner) in
--     the same transaction that closes the prompt, and links it through
--     result_goal_id. A replay returns the stored goal and never creates a
--     second one (the prompt row is locked FOR UPDATE, then already 'acted').
--   * The goal is created only when the learner holds a personal wallet today
--     (public.teen_wallet_holder: declared 13-17, no under-13 origin, not a
--     guest, no kid/parent/staff role, and a birth date or birth month, when
--     recorded, still inside 13-17). Otherwise the commitment is still
--     recorded, no goal is created, and the result says why
--     (goal_refused = 'WALLET_HOLDER_REQUIRED'). The function never creates a
--     wallet and never errors the "I will try" itself.
--   * A self prompt acted on with all-null details records the commitment
--     only, exactly as before (the pre-L-12 contract an older Core relies on).
--   * Tasks stay guardian-only (OD-3): learning_bridge_prompts_task_guardian is
--     untouched, and a self prompt of action 'earning_task' still refuses any
--     detail.
--   * Guardian prompts are unchanged, line for line.
--   * New table guard: a result goal must belong to the prompt's learner, for
--     every writer (the service role included), so no prompt can ever point at
--     another account's goal.
--   * A defect found by this migration's native-PostgreSQL verifier, fixed
--     here because L-12 cannot work without it: 0127's
--     offer_learning_bridge_prompt read its candidates with
--     `jsonb_to_recordset(...) WITH ORDINALITY AS c(kc_key text, ...)`, which
--     PostgreSQL rejects at run time ("WITH ORDINALITY cannot be used with a
--     column definition list"). Every offer therefore failed, so no bridge
--     prompt (guardian or self) could ever be stored; Core logs the failure and
--     learning proceeds (best-effort by design), which is why no route test
--     saw it (the RPC double does not parse SQL). The function is re-created
--     below with the same body and the candidates read through
--     `ROWS FROM (jsonb_to_recordset(...) AS (...)) WITH ORDINALITY`.
--
-- POSTURE: act_on_learning_bridge_prompt stays SECURITY DEFINER and executable
-- by service_role only; the guard function is executable by nobody directly.

-- ── The CHECK: a goal on any acted savings-goal prompt, guardian or self ─────
ALTER TABLE public.learning_bridge_prompts DROP CONSTRAINT IF EXISTS learning_bridge_prompts_goal_guardian;
ALTER TABLE public.learning_bridge_prompts DROP CONSTRAINT IF EXISTS learning_bridge_prompts_goal_savings;
ALTER TABLE public.learning_bridge_prompts ADD CONSTRAINT learning_bridge_prompts_goal_savings CHECK (
    result_goal_id IS NULL OR (status = 'acted' AND action = 'savings_goal'));

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
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_learning_bridge_prompt_goal() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS learning_bridge_prompt_goal_guard ON public.learning_bridge_prompts;
CREATE TRIGGER learning_bridge_prompt_goal_guard
    BEFORE INSERT OR UPDATE OF result_goal_id, learner_id ON public.learning_bridge_prompts
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

-- ── Acting on a prompt ──────────────────────────────────────────────────────
-- The latest definition (0127) with only the self branch changed.
CREATE OR REPLACE FUNCTION public.act_on_learning_bridge_prompt(
    p_prompt_id  uuid,
    p_actor_id   uuid,
    p_title      text,
    p_amount     integer,
    p_icon       text,
    p_recurrence text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prompt  public.learning_bridge_prompts%ROWTYPE;
    v_task    uuid;
    v_goal    uuid;
    v_refused text;
    v_title   text := btrim(coalesce(p_title, ''));
BEGIN
    SELECT * INTO v_prompt FROM public.learning_bridge_prompts WHERE id = p_prompt_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF v_prompt.audience = 'guardian' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.guardian_links gl
            WHERE gl.parent_user_id = p_actor_id AND gl.kid_user_id = v_prompt.learner_id
              AND gl.verification_status = 'verified'
        ) THEN
            RETURN jsonb_build_object('status', 'forbidden');
        END IF;
    ELSIF p_actor_id IS DISTINCT FROM v_prompt.learner_id THEN
        RETURN jsonb_build_object('status', 'forbidden');
    END IF;

    IF v_prompt.status = 'acted' THEN
        RETURN jsonb_build_object('status', 'acted', 'replayed', true,
            'task_id', v_prompt.result_task_id, 'goal_id', v_prompt.result_goal_id);
    END IF;
    IF v_prompt.status <> 'open' OR v_prompt.expires_at <= now() THEN
        RETURN jsonb_build_object('status', 'closed');
    END IF;

    IF v_prompt.audience = 'self' THEN
        IF p_title IS NULL AND p_amount IS NULL AND p_icon IS NULL AND p_recurrence IS NULL THEN
            -- A commitment only: the pre-L-12 contract, still what an older Core sends.
            NULL;
        ELSIF v_prompt.action <> 'savings_goal' THEN
            -- Tasks stay guardian-only (OD-3): a self task prompt takes no detail.
            RAISE EXCEPTION 'act_on_learning_bridge_prompt: a self prompt creates no task' USING ERRCODE = '22023';
        ELSE
            IF char_length(v_title) NOT BETWEEN 1 AND 80 OR p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 100000
               OR p_icon IS NULL OR p_icon NOT IN ('star', 'game', 'toy', 'book', 'bike', 'trip', 'gift') OR p_recurrence IS NOT NULL THEN
                RAISE EXCEPTION 'act_on_learning_bridge_prompt: invalid savings goal' USING ERRCODE = '22023';
            END IF;
            -- L-12: the teen's own goal, in their own wallet. No wallet today
            -- (for example the birth date now says 18) keeps the commitment and
            -- creates nothing; a wallet is never created here.
            IF public.teen_wallet_holder(v_prompt.learner_id) THEN
                INSERT INTO public.savings_goals (kid_user_id, title, target, icon)
                VALUES (v_prompt.learner_id, v_title, p_amount, p_icon)
                RETURNING id INTO v_goal;
            ELSE
                v_refused := 'WALLET_HOLDER_REQUIRED';
            END IF;
        END IF;
    ELSIF v_prompt.action = 'savings_goal' THEN
        IF char_length(v_title) NOT BETWEEN 1 AND 80 OR p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 100000
           OR p_icon IS NULL OR p_icon NOT IN ('star', 'game', 'toy', 'book', 'bike', 'trip', 'gift') OR p_recurrence IS NOT NULL THEN
            RAISE EXCEPTION 'act_on_learning_bridge_prompt: invalid savings goal' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.savings_goals (kid_user_id, title, target, icon)
        VALUES (v_prompt.learner_id, v_title, p_amount, p_icon)
        RETURNING id INTO v_goal;
    ELSE
        IF char_length(v_title) NOT BETWEEN 1 AND 120 OR p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 500
           OR p_recurrence IS NULL OR p_recurrence NOT IN ('once', 'weekly') OR p_icon IS NOT NULL THEN
            RAISE EXCEPTION 'act_on_learning_bridge_prompt: invalid task' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.tasks (assigned_by, assigned_to, title, reward_coins, recurrence, due_at, requires_evidence)
        VALUES (p_actor_id, v_prompt.learner_id, v_title, p_amount, p_recurrence, NULL, false)
        RETURNING id INTO v_task;
    END IF;

    UPDATE public.learning_bridge_prompts
       SET status = 'acted', closed_at = now(), closed_by = p_actor_id,
           result_task_id = v_task, result_goal_id = v_goal
     WHERE id = p_prompt_id;

    RETURN jsonb_build_object('status', 'acted', 'replayed', false, 'task_id', v_task, 'goal_id', v_goal, 'goal_refused', v_refused);
END;
$$;

REVOKE ALL ON FUNCTION public.act_on_learning_bridge_prompt(uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_learning_bridge_prompt(uuid, uuid, text, integer, text, text) TO service_role;

SELECT 'teen_bridge_own_goal_ok' AS sentinel;
