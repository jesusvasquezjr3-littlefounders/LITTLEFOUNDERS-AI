-- teen_bridge_own_goal — an independent teen's "I will try" on a savings-goal
-- bridge prompt creates the teen's own savings goal (OD-28, owner review item
-- L-12; Product 10 B.13 under Option B, OD-3).
-- @phase: expand
--
-- Before: a self prompt (audience 'self', an independent teen with no verified
-- guardian) recorded the teen's commitment and created nothing, because the
-- personal wallet of D.3 did not exist yet. It exists now (0152 to 0155), so
-- a teen who holds a wallet may turn the savings-goal prompt into a real goal
-- in that wallet, with their own title, target and icon.
--
-- Unchanged, and still enforced here:
--   * An earning-task prompt of a teen creates nothing: tasks stay
--     guardian-only (OD-3), and learning_bridge_prompts_task_guardian still
--     refuses a task on any self prompt.
--   * A self prompt with no details still records the commitment only, so an
--     older Core that sends none keeps working (this file only widens).
--   * The goal needs a wallet: public.teen_wallet_holder() must admit the
--     learner at the moment of acting, otherwise the answer is 'no_wallet'
--     and nothing is written.
--   * Only the learner acts on a self prompt; a replay returns the same goal.
--
-- Additive only: the new result column carries its own CHECK (the existing
-- guardian-only CHECK on result_goal_id is not touched), and the function is
-- replaced with the same signature and grants.

ALTER TABLE public.learning_bridge_prompts
    ADD COLUMN IF NOT EXISTS result_self_goal_id uuid NULL REFERENCES public.savings_goals (id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.learning_bridge_prompts'::regclass AND conname = 'learning_bridge_prompts_self_goal'
    ) THEN
        ALTER TABLE public.learning_bridge_prompts
            ADD CONSTRAINT learning_bridge_prompts_self_goal CHECK (
                result_self_goal_id IS NULL OR (status = 'acted' AND action = 'savings_goal' AND audience = 'self'));
    END IF;
END;
$$;

COMMENT ON COLUMN public.learning_bridge_prompts.result_self_goal_id IS
    'OD-28 (L-12): the savings goal an independent teen created in their own wallet by answering the prompt. NULL for a commitment only.';

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
    v_prompt    public.learning_bridge_prompts%ROWTYPE;
    v_task      uuid;
    v_goal      uuid;
    v_self_goal uuid;
    v_title     text := btrim(coalesce(p_title, ''));
    v_details   boolean := p_title IS NOT NULL OR p_amount IS NOT NULL OR p_icon IS NOT NULL OR p_recurrence IS NOT NULL;
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
            'task_id', v_prompt.result_task_id, 'goal_id', coalesce(v_prompt.result_goal_id, v_prompt.result_self_goal_id));
    END IF;
    IF v_prompt.status <> 'open' OR v_prompt.expires_at <= now() THEN
        RETURN jsonb_build_object('status', 'closed');
    END IF;

    IF v_prompt.audience = 'self' THEN
        IF v_details THEN
            -- Only a savings-goal prompt may carry details, and only into the
            -- teen's own wallet. A task never comes from a self prompt.
            IF v_prompt.action <> 'savings_goal' THEN
                RAISE EXCEPTION 'act_on_learning_bridge_prompt: a self task prompt creates nothing' USING ERRCODE = '22023';
            END IF;
            IF char_length(v_title) NOT BETWEEN 1 AND 80 OR p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 100000
               OR p_icon IS NULL OR p_icon NOT IN ('star', 'game', 'toy', 'book', 'bike', 'trip', 'gift') OR p_recurrence IS NOT NULL THEN
                RAISE EXCEPTION 'act_on_learning_bridge_prompt: invalid savings goal' USING ERRCODE = '22023';
            END IF;
            IF NOT public.teen_wallet_holder(v_prompt.learner_id) THEN
                RETURN jsonb_build_object('status', 'no_wallet');
            END IF;
            INSERT INTO public.savings_goals (kid_user_id, title, target, icon)
            VALUES (v_prompt.learner_id, v_title, p_amount, p_icon)
            RETURNING id INTO v_self_goal;
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
           result_task_id = v_task, result_goal_id = v_goal, result_self_goal_id = v_self_goal
     WHERE id = p_prompt_id;

    RETURN jsonb_build_object('status', 'acted', 'replayed', false, 'task_id', v_task, 'goal_id', coalesce(v_goal, v_self_goal));
END;
$$;

REVOKE ALL ON FUNCTION public.act_on_learning_bridge_prompt(uuid, uuid, text, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.act_on_learning_bridge_prompt(uuid, uuid, text, integer, text, text) TO service_role;
