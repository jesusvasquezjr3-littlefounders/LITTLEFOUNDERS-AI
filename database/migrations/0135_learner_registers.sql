-- @phase: expand
-- B.23 (S05.3f): the learner's age register history and the one-time
-- graduation moment. Record: docs/rebuild/sprints/S05-LEARNING-EXPERIENCE.md;
-- policy: docs/rebuild/LEARNER-REGISTER-AND-WELLBEING-POLICY.md.
--
-- Core resolves a learner's register from age evidence on every read of
-- /learn/register and notes it here, first-seen only. A graduation (young to
-- transition at 10, transition to teen at 13) is owed only to a learner who
-- was seen in a younger register before, and it is shown once: the learner
-- acknowledging it is the only write after the first sighting. Nothing here is
-- a safeguard (safeguards follow age elsewhere); it decides tone and framing.
--
-- New table and two new service-role functions only: expand.

CREATE TABLE IF NOT EXISTS public.learner_register_history (
    user_id                    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    register                   text NOT NULL
        CONSTRAINT learner_register_history_register CHECK (register IN ('young', 'transition', 'teen', 'adult')),
    first_seen_at              timestamptz NOT NULL DEFAULT now(),
    graduation_acknowledged_at timestamptz NULL,
    PRIMARY KEY (user_id, register)
);
ALTER TABLE public.learner_register_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learner_register_history_select_own ON public.learner_register_history;
CREATE POLICY learner_register_history_select_own ON public.learner_register_history
    FOR SELECT USING (user_id = auth.uid());
-- Written by Core (service role) only; no browser write policy.
REVOKE INSERT, UPDATE, DELETE ON public.learner_register_history FROM anon, authenticated;

-- Notes the register Core resolved (first sighting only) and returns what the
-- learner has been seen in and which graduations they already acknowledged.
CREATE OR REPLACE FUNCTION public.note_learner_register(p_user_id uuid, p_register text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_user_id IS NULL OR p_register IS NULL OR p_register NOT IN ('young', 'transition', 'teen', 'adult') THEN
        RAISE EXCEPTION 'Invalid register parameters' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.learner_register_history (user_id, register)
    VALUES (p_user_id, p_register)
    ON CONFLICT (user_id, register) DO NOTHING;
    RETURN jsonb_build_object(
        'seen', COALESCE((SELECT jsonb_agg(h.register ORDER BY h.first_seen_at, h.register)
                          FROM public.learner_register_history h WHERE h.user_id = p_user_id), '[]'::jsonb),
        'acknowledged', COALESCE((SELECT jsonb_agg(h.register ORDER BY h.register)
                                  FROM public.learner_register_history h
                                  WHERE h.user_id = p_user_id AND h.graduation_acknowledged_at IS NOT NULL), '[]'::jsonb)
    );
END;
$$;
REVOKE ALL ON FUNCTION public.note_learner_register(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.note_learner_register(uuid, text) TO service_role;

-- Acknowledges the graduation into p_register. Refuses (false) unless the
-- learner has a row for that register AND a row for a younger one: there is
-- no graduation to acknowledge otherwise. Idempotent: a second call keeps the
-- first timestamp and returns true.
CREATE OR REPLACE FUNCTION public.acknowledge_learner_graduation(p_user_id uuid, p_register text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_rank integer;
BEGIN
    IF p_user_id IS NULL OR p_register IS NULL OR p_register NOT IN ('transition', 'teen') THEN
        RETURN false;
    END IF;
    v_rank := CASE p_register WHEN 'transition' THEN 1 ELSE 2 END;
    IF NOT EXISTS (
        SELECT 1 FROM public.learner_register_history h
        WHERE h.user_id = p_user_id
          AND (CASE h.register WHEN 'young' THEN 0 WHEN 'transition' THEN 1 WHEN 'teen' THEN 2 ELSE 3 END) < v_rank
    ) THEN
        RETURN false;
    END IF;
    UPDATE public.learner_register_history
    SET graduation_acknowledged_at = COALESCE(graduation_acknowledged_at, now())
    WHERE user_id = p_user_id AND register = p_register;
    RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.acknowledge_learner_graduation(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_learner_graduation(uuid, text) TO service_role;
