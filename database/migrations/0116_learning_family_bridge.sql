-- @phase: expand
-- B.13 (S05.3c): the bridge from course learning to the Family Hub, plus the
-- Appendix C diagnostics for B.9 and B.13 and the prompts' retention sweep.
-- Record: docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md. Requires
-- *_learning_decision_journal.sql (the metrics read the journal) and the B.6
-- data layer (the kc table's draft status and topic_knowledge_components).
--
--   learning_bridge_prompts        An optional prompt, created when a
--                                  learner completes a topic that teaches a
--                                  bridge knowledge component (savings goals,
--                                  earning by work). A learner with a verified
--                                  guardian gets a guardian prompt in the
--                                  Family Hub, which can create a real savings
--                                  goal or a real task. An independent teen
--                                  (Option B) gets a self-directed prompt that
--                                  never creates a task: the CHECKs below make
--                                  "tasks stay guardian-only" a database fact.
--                                  One prompt per learner per component, one
--                                  open prompt per action, a 30-day cooldown per
--                                  action and a 14-day quiet expiry keep it
--                                  from nagging (B.25).
--
--   learning_narrative_metrics     Appendix C diagnostics for B.9 (journal
--   purge_closed_learning_bridge_prompts  coverage and resurfacing) and B.13
--                                  (bridge conversion within 7 days), and the
--                                  retention sweep for closed prompts.
--
-- POSTURE: every function is SECURITY DEFINER and executable by service_role
-- only. No client policy writes the table.

-- ─────────────────────────────────────────────────────────────
-- learning_bridge_prompts (B.13)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_bridge_prompts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kc_id           uuid NOT NULL REFERENCES public.kc (id) ON DELETE RESTRICT,
    action          text NOT NULL CHECK (action IN ('savings_goal', 'earning_task')),
    audience        text NOT NULL CHECK (audience IN ('guardian', 'self')),
    course_id       uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    topic_id        uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
    lesson_id       uuid NULL REFERENCES public.lessons (id) ON DELETE SET NULL,
    status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acted', 'dismissed', 'expired')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL,
    closed_at       timestamptz NULL,
    closed_by       uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    result_task_id  uuid NULL REFERENCES public.tasks (id) ON DELETE SET NULL,
    result_goal_id  uuid NULL REFERENCES public.savings_goals (id) ON DELETE SET NULL,
    CONSTRAINT learning_bridge_prompts_expiry CHECK (expires_at > created_at),
    CONSTRAINT learning_bridge_prompts_closed CHECK ((status = 'open') = (closed_at IS NULL)),
    -- Tasks stay guardian-only (OD-3, Option B): a self prompt can never own one.
    CONSTRAINT learning_bridge_prompts_task_guardian CHECK (
        result_task_id IS NULL OR (status = 'acted' AND action = 'earning_task' AND audience = 'guardian')),
    CONSTRAINT learning_bridge_prompts_goal_guardian CHECK (
        result_goal_id IS NULL OR (status = 'acted' AND action = 'savings_goal' AND audience = 'guardian')),
    CONSTRAINT learning_bridge_prompts_once_per_kc UNIQUE (learner_id, kc_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_bridge_prompts_open_action
    ON public.learning_bridge_prompts (learner_id, action) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_learning_bridge_prompts_learner
    ON public.learning_bridge_prompts (learner_id, created_at DESC);

ALTER TABLE public.learning_bridge_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_bridge_prompts_select_audience ON public.learning_bridge_prompts;
CREATE POLICY learning_bridge_prompts_select_audience ON public.learning_bridge_prompts
    FOR SELECT USING (
        (audience = 'self' AND learner_id = auth.uid())
        OR (audience = 'guardian' AND public.is_verified_guardian_of(learner_id))
    );

-- Offers at most one prompt. Candidates come from Core's reviewed bridge
-- catalog, in priority order: [{"kc_key": "...", "action": "..."}]. The
-- audience is re-checked here against the guardian links: a guardian prompt
-- needs a verified guardian, a self prompt needs none.
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
        FROM jsonb_to_recordset(p_candidates) WITH ORDINALITY AS c(kc_key text, action text, ord bigint)
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

-- Acts on a prompt in one transaction. A guardian prompt, acted on by a
-- verified guardian of the learner, creates the real savings goal or task and
-- closes the prompt with its id. A self prompt, acted on by the learner,
-- records the learner's own commitment and creates nothing: no task can come
-- from it. A replay by anyone returns the stored result, never a second row.
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
    v_prompt public.learning_bridge_prompts%ROWTYPE;
    v_task   uuid;
    v_goal   uuid;
    v_title  text := btrim(coalesce(p_title, ''));
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
        IF p_title IS NOT NULL OR p_amount IS NOT NULL OR p_icon IS NOT NULL OR p_recurrence IS NOT NULL THEN
            RAISE EXCEPTION 'act_on_learning_bridge_prompt: a self prompt creates nothing' USING ERRCODE = '22023';
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

    RETURN jsonb_build_object('status', 'acted', 'replayed', false, 'task_id', v_task, 'goal_id', v_goal);
END;
$$;

REVOKE ALL ON FUNCTION public.act_on_learning_bridge_prompt(uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_learning_bridge_prompt(uuid, uuid, text, integer, text, text) TO service_role;

-- Dismissing is always allowed to the prompt's audience and is final: the
-- same component never prompts again for this learner.
CREATE OR REPLACE FUNCTION public.dismiss_learning_bridge_prompt(p_prompt_id uuid, p_actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prompt public.learning_bridge_prompts%ROWTYPE;
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
    IF v_prompt.status = 'dismissed' THEN
        RETURN jsonb_build_object('status', 'dismissed', 'replayed', true);
    END IF;
    IF v_prompt.status <> 'open' THEN
        RETURN jsonb_build_object('status', 'closed');
    END IF;
    UPDATE public.learning_bridge_prompts
       SET status = 'dismissed', closed_at = now(), closed_by = p_actor_id
     WHERE id = p_prompt_id;
    RETURN jsonb_build_object('status', 'dismissed', 'replayed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_learning_bridge_prompt(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_learning_bridge_prompt(uuid, uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- Appendix C diagnostics and retention
-- ─────────────────────────────────────────────────────────────
-- Both B.9 and B.13 metrics are "Diagnostic, no fixed target" in Appendix C.
-- A prompt counts as converted when it produced a real goal or task within
-- 7 days of being offered; a self commitment is reported apart, never as a
-- conversion, because nothing was created.
CREATE OR REPLACE FUNCTION public.learning_narrative_metrics(p_since timestamptz, p_until timestamptz)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT jsonb_build_object(
        'journal_entries_recorded', (
            SELECT count(*) FROM public.learner_decision_journal j
            WHERE j.first_recorded_at >= p_since AND j.first_recorded_at < p_until),
        'journal_entries_resurfaced', (
            SELECT count(*) FROM public.learner_decision_journal j
            WHERE j.first_recorded_at >= p_since AND j.first_recorded_at < p_until
              AND EXISTS (SELECT 1 FROM public.learner_decision_resurfacings r WHERE r.entry_id = j.id)),
        'bridge_prompts_offered', (
            SELECT count(*) FROM public.learning_bridge_prompts p
            WHERE p.created_at >= p_since AND p.created_at < p_until),
        'bridge_prompts_converted_7d', (
            SELECT count(*) FROM public.learning_bridge_prompts p
            WHERE p.created_at >= p_since AND p.created_at < p_until AND p.status = 'acted'
              AND (p.result_task_id IS NOT NULL OR p.result_goal_id IS NOT NULL)
              AND p.closed_at <= p.created_at + interval '7 days'),
        'bridge_self_commitments', (
            SELECT count(*) FROM public.learning_bridge_prompts p
            WHERE p.created_at >= p_since AND p.created_at < p_until AND p.status = 'acted' AND p.audience = 'self'),
        'bridge_prompts_dismissed', (
            SELECT count(*) FROM public.learning_bridge_prompts p
            WHERE p.created_at >= p_since AND p.created_at < p_until AND p.status = 'dismissed'),
        'bridge_prompts_expired', (
            SELECT count(*) FROM public.learning_bridge_prompts p
            WHERE p.created_at >= p_since AND p.created_at < p_until
              AND (p.status = 'expired' OR (p.status = 'open' AND p.expires_at <= now())))
    );
$$;

REVOKE ALL ON FUNCTION public.learning_narrative_metrics(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.learning_narrative_metrics(timestamptz, timestamptz) TO service_role;

-- Closed prompts are kept for the metric window, then removed. The nightly
-- insights-maintenance workflow calls this with 400 days, the same window the
-- learning-event stream keeps. Open prompts are never purged here; they expire.
CREATE OR REPLACE FUNCTION public.purge_closed_learning_bridge_prompts(p_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    IF p_days IS NULL OR p_days < 30 THEN
        RAISE EXCEPTION 'purge_closed_learning_bridge_prompts: keep at least 30 days' USING ERRCODE = '22023';
    END IF;
    WITH purged AS (DELETE FROM public.learning_bridge_prompts
        WHERE status <> 'open' AND closed_at < now() - make_interval(days => p_days)
        RETURNING 1)
    SELECT count(*) INTO v_count FROM purged;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_closed_learning_bridge_prompts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_closed_learning_bridge_prompts(integer) TO service_role;
