-- learning_practice_days — the weekly streak strip's per-day record
-- (GAP-FIX-R1 learning; Bible 02 §9.6 rules 4-5, §4.4 item 2; Bible 04 §4.3).
-- @phase: expand
--
-- The habit streak (0133) keeps counts only: the live run, the best run, the
-- rest days used this ISO week and the last practised local date. The strip
-- needs which days of the current week were practised. Every practised day
-- already passes through learning_stats.last_active_date (complete_lesson and
-- record_learning_practice_day both set it to the learner's LOCAL date), so a
-- trigger records each new value here; nothing else writes the table.
--
-- One row per learner and local date, nothing else (no lesson, no score).
-- Service role reads it through Core; RLS on, no browser policy. Rows follow
-- the account (ON DELETE CASCADE) and are kept 400 days: the strip reads one
-- week, and a year covers any rest-day or pause question about the run. The
-- trigger trims a learner's older rows each time a new day is recorded.

CREATE TABLE IF NOT EXISTS public.learning_practice_days (
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    local_date  date NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, local_date)
);
ALTER TABLE public.learning_practice_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.learning_practice_days FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.learning_practice_days TO service_role;

CREATE OR REPLACE FUNCTION public.record_practice_day_from_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.last_active_date IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.last_active_date IS DISTINCT FROM OLD.last_active_date) THEN
        INSERT INTO public.learning_practice_days (user_id, local_date)
        VALUES (NEW.user_id, NEW.last_active_date)
        ON CONFLICT (user_id, local_date) DO NOTHING;
        -- Retention without a scheduler: each new day drops this learner's rows past the window.
        DELETE FROM public.learning_practice_days
        WHERE user_id = NEW.user_id AND local_date < NEW.last_active_date - 400;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.record_practice_day_from_stats() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS learning_stats_practice_day ON public.learning_stats;
CREATE TRIGGER learning_stats_practice_day
    AFTER INSERT OR UPDATE OF last_active_date ON public.learning_stats
    FOR EACH ROW EXECUTE FUNCTION public.record_practice_day_from_stats();

-- Backfill the one day the stats already know about.
INSERT INTO public.learning_practice_days (user_id, local_date)
SELECT user_id, last_active_date FROM public.learning_stats WHERE last_active_date IS NOT NULL
ON CONFLICT (user_id, local_date) DO NOTHING;

-- Retention for learners who stopped practising: an operator (or a scheduled
-- job) calls this; the trigger above already trims each active learner's rows.
CREATE OR REPLACE FUNCTION public.sweep_learning_practice_days()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    WITH gone AS (DELETE FROM public.learning_practice_days WHERE local_date < current_date - 400 RETURNING 1)
    SELECT count(*)::int FROM gone;
$$;
REVOKE ALL ON FUNCTION public.sweep_learning_practice_days() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_learning_practice_days() TO service_role;
