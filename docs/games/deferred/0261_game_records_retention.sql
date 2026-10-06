-- game_records_retention — the retention sweep for the game_records tables.
-- @phase: contract
-- @after-release: none required in practice; the phase classifier flags the DELETE statements in the sweep body, which only trim the tables game_records creates (sessions and runs after 400 days, saves and progress 24 months after the last play). Applying it deletes nothing an older Core reads. Apply by hand, after game_records, once the game release is live; it is held out of the automatic path on purpose (COPPA written retention schedule, design 6.4).
--
-- Sessions and runs are kept 400 days (the 0208 precedent); the save and the
-- bests are kept 24 months after the learner last played. An operator, or the
-- scheduled retention job once it calls this, runs the function. Account
-- deletion needs none of it: every row cascades from auth.users.
CREATE OR REPLACE FUNCTION public.sweep_game_records()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_runs int;
    v_sessions int;
    v_progress int;
    v_saves int;
BEGIN
    WITH gone AS (
        DELETE FROM public.game_runs WHERE created_at < now() - interval '400 days' RETURNING 1
    ) SELECT count(*) INTO v_runs FROM gone;
    WITH gone AS (
        DELETE FROM public.game_sessions WHERE started_at < now() - interval '400 days' RETURNING 1
    ) SELECT count(*) INTO v_sessions FROM gone;
    WITH gone AS (
        DELETE FROM public.game_progress WHERE last_played_at < now() - interval '24 months' RETURNING 1
    ) SELECT count(*) INTO v_progress FROM gone;
    WITH gone AS (
        DELETE FROM public.game_saves WHERE updated_at < now() - interval '24 months' RETURNING 1
    ) SELECT count(*) INTO v_saves FROM gone;
    RETURN jsonb_build_object('runs', v_runs, 'sessions', v_sessions, 'progress', v_progress, 'saves', v_saves);
END;
$$;
REVOKE ALL ON FUNCTION public.sweep_game_records() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_game_records() TO service_role;
