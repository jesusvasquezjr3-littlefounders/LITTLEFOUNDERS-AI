-- chore_streak_rest_days — S07.3 (D.2): the chore streak stops resetting to
-- zero on one missed day.
-- @phase: expand
--
-- WHAT CHANGES. 0080's kid_task_streaks stored a running counter maintained
-- with the learning streak's all-or-nothing arithmetic (any gap restarts at
-- 1). D.2 extends B.21's lapse-tolerant model to this entity; the model the
-- product applies is Frontend Bible 02 §9.6: two rest days a week are free and
-- automatic, the best streak and the total days practised are permanent, and
-- a Tutor can pause the streak for a holiday. A counter cannot express that,
-- so the database now keeps the FACTS the model is computed from:
--
--   * chore_streak_days: one row per child per local calendar day on which at
--     least one chore was marked done. It is written ONLY by a trigger on the
--     task itself (open -> done adds one, a Tutor cancelling that done task
--     takes it back), so no writer can put a practised day on the record
--     without a chore behind it.
--   * tasks.completed_on: the child's local calendar day of the completion,
--     set once at open -> done and bounded to the server's UTC day plus or
--     minus one (every real time zone), so a day cannot be backdated to pad
--     or rescue a streak.
--   * chore_streak_pauses: a Tutor's holiday pause. Paused days neither count
--     nor break the streak. Every rule is enforced by a trigger for every
--     writer; the functions below only give Core one atomic call.
--
-- The streak itself (current run, rest days used, best, total) is computed by
-- the pure model in backend/src/services/choreStreak.ts from these rows.
--
-- Backfill: each existing counter becomes its run of consecutive days ending
-- on last_completed_date (the legacy arithmetic guaranteed they were
-- consecutive), marked legacy, so no family loses a current streak (owner log
-- §4: streaks, current and best, are never lost). kid_task_streaks stays as
-- the permanent floor for the best streak and is no longer written.
--
-- Expand: a new nullable column, new tables, new triggers that only act on
-- the new column and tables. A completion from an older Core (no
-- completed_on) is stamped with the server's UTC day, exactly what that Core
-- already used as its fallback.

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_on date;

-- ── Practised days ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chore_streak_days (
    kid_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    local_date  date NOT NULL,
    completions integer NOT NULL DEFAULT 0 CHECK (completions >= 0),
    legacy      boolean NOT NULL DEFAULT false,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (kid_user_id, local_date)
);

ALTER TABLE public.chore_streak_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chore_streak_days_select_party ON public.chore_streak_days;
CREATE POLICY chore_streak_days_select_party ON public.chore_streak_days
    FOR SELECT USING (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.chore_streak_days FROM anon, authenticated;

-- ── Holiday pauses ───────────────────────────────────────────────────────────
-- A pause covers starts_on..ends_on inclusive, 1 to 21 days. It is cancelled
-- (before it starts) or ended early (while it runs), never deleted, so the
-- record of who paused what stays readable to the family.
CREATE TABLE IF NOT EXISTS public.chore_streak_pauses (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kid_user_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    starts_on    date NOT NULL,
    ends_on      date NOT NULL,
    created_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    cancelled_at timestamptz,
    -- The Tutor who cancelled the pause or ended it early.
    changed_by   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    CONSTRAINT chore_streak_pauses_length CHECK (ends_on >= starts_on AND ends_on - starts_on < 21)
);

CREATE INDEX IF NOT EXISTS chore_streak_pauses_kid_idx ON public.chore_streak_pauses (kid_user_id, starts_on);

ALTER TABLE public.chore_streak_pauses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chore_streak_pauses_select_party ON public.chore_streak_pauses;
CREATE POLICY chore_streak_pauses_select_party ON public.chore_streak_pauses
    FOR SELECT USING (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.chore_streak_pauses FROM anon, authenticated;

-- ── Backfill (before the guards exist; on a replay the guard is dropped first
-- and re-created below) ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS chore_streak_day_guard ON public.chore_streak_days;
INSERT INTO public.chore_streak_days (kid_user_id, local_date, completions, legacy)
SELECT s.kid_user_id, s.last_completed_date - i, 0, true
FROM public.kid_task_streaks s
CROSS JOIN LATERAL generate_series(0, s.current_streak_days - 1) AS i
WHERE s.last_completed_date IS NOT NULL AND s.current_streak_days > 0
ON CONFLICT (kid_user_id, local_date) DO NOTHING;

-- ── The completion day on the task ───────────────────────────────────────────
-- Fires before task_state_guard (triggers run in name order), so the state
-- guard sees the stamped day. Refusals use the S07.1 vocabulary.
CREATE OR REPLACE FUNCTION public.guard_task_completion_day()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.completed_on IS NOT NULL THEN
            RAISE EXCEPTION 'TASK_STATE_INVALID' USING ERRCODE = 'P0001',
                DETAIL = 'A task is created without a completion day.';
        END IF;
        RETURN NEW;
    END IF;
    IF OLD.status = 'open' AND NEW.status = 'done' THEN
        NEW.completed_on := coalesce(NEW.completed_on, v_today);
        IF NEW.completed_on NOT BETWEEN v_today - 1 AND v_today + 1 THEN
            RAISE EXCEPTION 'TASK_COMPLETION_DAY_INVALID' USING ERRCODE = 'P0001',
                DETAIL = 'The completion day must be the local day of the completion.';
        END IF;
    ELSIF NEW.completed_on IS DISTINCT FROM OLD.completed_on THEN
        RAISE EXCEPTION 'TASK_IMMUTABLE_FIELD' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_task_completion_day() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS task_completion_day_guard ON public.tasks;
CREATE TRIGGER task_completion_day_guard BEFORE INSERT OR UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.guard_task_completion_day();

-- ── Practised days follow the task, never a direct write ─────────────────────
CREATE OR REPLACE FUNCTION public.record_chore_streak_day()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF OLD.status = 'open' AND NEW.status = 'done' THEN
        INSERT INTO public.chore_streak_days (kid_user_id, local_date, completions)
        VALUES (NEW.assigned_to, NEW.completed_on, 1)
        ON CONFLICT (kid_user_id, local_date)
        DO UPDATE SET completions = public.chore_streak_days.completions + 1, updated_at = now();
    ELSIF OLD.status = 'done' AND NEW.status = 'cancelled' AND NEW.completed_on IS NOT NULL THEN
        -- A Tutor who cancels a chore marked done says it did not happen.
        UPDATE public.chore_streak_days
        SET completions = greatest(completions - 1, 0), updated_at = now()
        WHERE kid_user_id = NEW.assigned_to AND local_date = NEW.completed_on;
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.record_chore_streak_day() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS task_chore_streak_day ON public.tasks;
CREATE TRIGGER task_chore_streak_day AFTER UPDATE OF status ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.record_chore_streak_day();

-- Only the task trigger above (trigger depth 2) may add or change a day. A
-- direct insert or update, from any role including the service role, is a
-- day with no chore behind it. Deletes stay possible (account erasure
-- cascades; removing a day can only shorten a streak, never pad it).
CREATE OR REPLACE FUNCTION public.guard_chore_streak_day()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF pg_trigger_depth() < 2 THEN
        RAISE EXCEPTION 'CHORE_DAY_WRITE_FORBIDDEN' USING ERRCODE = 'P0001',
            DETAIL = 'A practised day is recorded only by marking a chore done.';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_chore_streak_day() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS chore_streak_day_guard ON public.chore_streak_days;
CREATE TRIGGER chore_streak_day_guard BEFORE INSERT OR UPDATE ON public.chore_streak_days
    FOR EACH ROW EXECUTE FUNCTION public.guard_chore_streak_day();

-- ── Pause rules, for every writer ────────────────────────────────────────────
-- Insert: by a verified guardian of the child, 1 to 21 days, starting no
-- earlier than 7 days ago (a pause set after a trip is still honest: paused
-- days never ADD to a streak) and no later than 120 days ahead, never
-- overlapping another live pause, at most 3 pauses not yet over.
-- Update: only cancelling a pause that has not started, or ending a running
-- pause early (ends_on moves back to yesterday), by a verified guardian.
CREATE OR REPLACE FUNCTION public.guard_chore_streak_pause()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_today   date := (now() AT TIME ZONE 'utc')::date;
    v_changed text[];
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('chore_streak:' || NEW.kid_user_id::text, 1));
    IF TG_OP = 'INSERT' THEN
        IF NEW.cancelled_at IS NOT NULL OR NEW.changed_by IS NOT NULL
           OR NEW.starts_on < v_today - 7 OR NEW.starts_on > v_today + 120
           OR NEW.ends_on < NEW.starts_on OR NEW.ends_on - NEW.starts_on >= 21 THEN
            RAISE EXCEPTION 'STREAK_PAUSE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        IF NOT public.family_is_verified_guardian(NEW.created_by, NEW.kid_user_id) THEN
            RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
        END IF;
        IF EXISTS (SELECT 1 FROM public.chore_streak_pauses p
                   WHERE p.kid_user_id = NEW.kid_user_id AND p.cancelled_at IS NULL
                     AND p.starts_on <= NEW.ends_on AND p.ends_on >= NEW.starts_on) THEN
            RAISE EXCEPTION 'STREAK_PAUSE_OVERLAP' USING ERRCODE = 'P0001';
        END IF;
        IF (SELECT count(*) FROM public.chore_streak_pauses p
            WHERE p.kid_user_id = NEW.kid_user_id AND p.cancelled_at IS NULL AND p.ends_on >= v_today) >= 3 THEN
            RAISE EXCEPTION 'STREAK_PAUSE_LIMIT' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;

    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['created_by', 'changed_by'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF v_changed && ARRAY['id', 'kid_user_id', 'starts_on', 'created_by', 'created_at'] OR OLD.cancelled_at IS NOT NULL
       OR OLD.ends_on < v_today THEN
        RAISE EXCEPTION 'STREAK_PAUSE_OVER' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.family_is_verified_guardian(NEW.changed_by, NEW.kid_user_id) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.cancelled_at IS NOT NULL THEN
        IF v_changed && ARRAY['ends_on'] OR OLD.starts_on < v_today THEN
            RAISE EXCEPTION 'STREAK_PAUSE_INVALID' USING ERRCODE = 'P0001',
                DETAIL = 'A running pause is ended early, not cancelled.';
        END IF;
    ELSIF NOT (v_changed <@ ARRAY['ends_on', 'changed_by']) OR OLD.starts_on >= v_today OR NEW.ends_on <> v_today - 1 THEN
        RAISE EXCEPTION 'STREAK_PAUSE_INVALID' USING ERRCODE = 'P0001',
            DETAIL = 'A running pause can only end yesterday.';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_chore_streak_pause() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS chore_streak_pause_guard ON public.chore_streak_pauses;
CREATE TRIGGER chore_streak_pause_guard BEFORE INSERT OR UPDATE ON public.chore_streak_pauses
    FOR EACH ROW EXECUTE FUNCTION public.guard_chore_streak_pause();

-- ── Core's atomic calls ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guardian_pause_chore_streak(p_kid uuid, p_actor uuid, p_starts_on date, p_ends_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_id uuid;
BEGIN
    IF p_kid IS NULL OR p_actor IS NULL OR p_starts_on IS NULL OR p_ends_on IS NULL THEN
        RAISE EXCEPTION 'STREAK_PAUSE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.chore_streak_pauses (kid_user_id, starts_on, ends_on, created_by)
    VALUES (p_kid, p_starts_on, p_ends_on, p_actor)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- 'cancelled' when the pause had not started, 'ended' when it was running.
CREATE OR REPLACE FUNCTION public.guardian_end_chore_streak_pause(p_pause uuid, p_actor uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_pause public.chore_streak_pauses%ROWTYPE;
    v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
    SELECT * INTO v_pause FROM public.chore_streak_pauses WHERE id = p_pause;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'STREAK_PAUSE_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('chore_streak:' || v_pause.kid_user_id::text, 1));
    SELECT * INTO v_pause FROM public.chore_streak_pauses WHERE id = p_pause FOR UPDATE;
    IF NOT public.family_is_verified_guardian(p_actor, v_pause.kid_user_id) THEN
        RAISE EXCEPTION 'NOT_A_GUARDIAN' USING ERRCODE = 'P0001';
    END IF;
    IF v_pause.cancelled_at IS NOT NULL OR v_pause.ends_on < v_today THEN
        RAISE EXCEPTION 'STREAK_PAUSE_OVER' USING ERRCODE = 'P0001';
    END IF;
    IF v_pause.starts_on >= v_today THEN
        UPDATE public.chore_streak_pauses SET cancelled_at = now(), changed_by = p_actor WHERE id = p_pause;
        RETURN 'cancelled';
    END IF;
    UPDATE public.chore_streak_pauses SET ends_on = v_today - 1, changed_by = p_actor WHERE id = p_pause;
    RETURN 'ended';
END;
$$;

REVOKE ALL ON FUNCTION public.guardian_pause_chore_streak(uuid, uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guardian_end_chore_streak_pause(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guardian_pause_chore_streak(uuid, uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.guardian_end_chore_streak_pause(uuid, uuid) TO service_role;

SELECT 'chore_streak_rest_days_ok' AS sentinel;
