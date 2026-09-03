-- 0069_tutor_plan_and_notebook.sql — Class V artifacts (/TUTOR_INSTRUMENTS.md
-- §3.6, S21): the first two things a learner keeps across sessions instead of
-- losing when the conversation ends.
-- @phase: expand
--
-- WHAT THIS ADDS AND WHY.
--
--   tutor_plans             ONE row per learner: the savings plan built in
--                           conversation, as a whiteboard JSONB snapshot —
--                           the SAME shape any whiteboard kind already
--                           produces (`oracle/src/tutor/turnSchema.ts`'s
--                           `Whiteboard` union), not a new content format.
--                           A new turn-level flag (`savePlan`) tells Core
--                           "persist the board this turn just drew as the
--                           learner's ongoing plan" — the content is never
--                           composed separately from what was already
--                           moderated and shown on screen, so this adds no
--                           new unmoderated surface (§1.9). "Real progress"
--                           falls out for free: the plan is whatever the
--                           tutor's own server-computed numbers say NOW,
--                           each time it is re-saved, never a separately
--                           tracked counter that could drift from the
--                           board the learner actually saw.
--
--                           CONCURRENCY: unlike learner_memory (0059), the
--                           new content here is never a MERGE of the old
--                           value with something new — it is a complete,
--                           self-contained snapshot of "the plan as of this
--                           turn." There is nothing to compare-and-swap
--                           against, so `write_tutor_plan` is a plain
--                           advisory-locked UPSERT: the last write to
--                           actually commit is the stated winner, and
--                           because every write is a full snapshot rather
--                           than a delta, "last write wins" loses no
--                           information a merge-based store would have.
--
--   tutor_notebook_entries  MANY rows per learner: boards explicitly marked
--                           "keep this" — a new learner-facing control, not
--                           the model's choice. Each row COPIES the
--                           `tutor_turns.whiteboard` JSONB payload at the
--                           moment it is kept, rather than merely
--                           referencing `(session_id, seq)` — sessions purge
--                           at 90 days (0047's `purge_expired_tutor_sessions`)
--                           and a kept board that went dangling the moment
--                           its source session aged out would silently
--                           break "collected", the entire point of this
--                           table. `session_id`/`turn_seq` are kept anyway,
--                           as plain columns with NO foreign key, purely for
--                           provenance ("kept during this conversation") —
--                           the same posture `learner_memory_ledger.session_id`
--                           (0053) and `learner_memory_proposals.session_id`
--                           (0068) already take for the identical reason.
--                           No new moderation surface either: the copied
--                           payload already passed moderation and was
--                           already guardian-visible before it was ever
--                           kept.
--
-- Both tables follow the SAME RLS shape every kid-authored, parent-visible
-- table in this schema already uses (`learner_memory`, `tutor_sessions`,
-- `tutor_preferences`): `user_id = auth.uid() OR
-- public.is_verified_guardian_of(user_id)` for SELECT, and NO client
-- INSERT/UPDATE/DELETE policy — only the service role (Core) writes, after
-- validating in application code that the session/turn being saved or kept
-- actually belongs to the authenticated learner.

-- ──────────────────────────────── tutor_plans ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.tutor_plans (
    user_id     uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    -- A whiteboard JSONB snapshot — same shape as tutor_turns.whiteboard
    -- (0058). Not constrained to one `kind`: whichever chart best fits the
    -- goal being discussed (goal_bar, sequence, whatif...) is the model's
    -- own call, the same freedom it already has when drawing any board.
    content     jsonb NOT NULL,
    -- The session that produced the CURRENT content. Plain uuid, NO foreign
    -- key: sessions purge at 90 days and the plan must outlive them.
    session_id  uuid NULL,
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_plans_select_own ON public.tutor_plans;
CREATE POLICY tutor_plans_select_own ON public.tutor_plans
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
-- No INSERT/UPDATE/DELETE policies: only the service role writes, via
-- write_tutor_plan below.

CREATE OR REPLACE FUNCTION public.write_tutor_plan(
    p_user_id     uuid,
    p_content     jsonb,
    p_session_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- A different salt from every other atomic path for the same user
    -- (0/1/2/3 already claimed by 0055/0057/0059/0064) so an unrelated
    -- write for the same learner never contends here.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 4));

    INSERT INTO public.tutor_plans (user_id, content, session_id, updated_at)
    VALUES (p_user_id, p_content, p_session_id, now())
    ON CONFLICT (user_id) DO UPDATE
        SET content = EXCLUDED.content,
            session_id = EXCLUDED.session_id,
            updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.write_tutor_plan(uuid, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.write_tutor_plan(uuid, jsonb, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.write_tutor_plan(uuid, jsonb, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.write_tutor_plan(uuid, jsonb, uuid) TO service_role;

-- ───────────────────────── tutor_notebook_entries ───────────────────────────

CREATE TABLE IF NOT EXISTS public.tutor_notebook_entries (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    -- Copied at "keep" time — see the file header for why this is a copy,
    -- never a reference.
    whiteboard  jsonb NOT NULL,
    session_id  uuid NULL,
    turn_seq    integer NULL,
    kept_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_notebook_entries_user
    ON public.tutor_notebook_entries (user_id, kept_at DESC);

ALTER TABLE public.tutor_notebook_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_notebook_entries_select_own ON public.tutor_notebook_entries;
CREATE POLICY tutor_notebook_entries_select_own ON public.tutor_notebook_entries
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
-- No INSERT/UPDATE/DELETE policies: only the service role writes, after Core
-- has checked in application code that the session/turn being kept belongs
-- to the authenticated learner. A plain INSERT — unlike tutor_plans, each
-- "keep" creates its own new row rather than upserting a shared one, so
-- there is no concurrent-write question here to design against.
