-- clean_slate_drop_games — drop the KartRush game records: tables, functions, policies and data-practice rows.
-- @phase: contract
-- @after-release: the clean-slate Core and Oracle that removed the game routes, services and debrief
--
-- Undoes game_records (0259) and game_records_functions (0260), which stay as
-- applied history. Games never wrote XP, coins, streak or kc_attempt, so nothing
-- outside these objects depends on them. The old game schema of 0027 was already
-- retired by 0033 and is not touched.
--
-- No surviving function reads these objects, so none is rewritten:
-- erase_account_data erases everything else by its own steps, and the game rows
-- went with auth.users through ON DELETE CASCADE. data_practice_applies and
-- has_data_practice_consent already answer false for a key that is not
-- registered, so the two removed keys need no special case.
--
-- No CASCADE: every dependency is dropped by name, so an object this file does
-- not know about fails the migration instead of disappearing with it.
-- Idempotent. The audit_logs rows written as 'games.play_limits_set' stay: the
-- audit trail is append-only and holds no game data beyond two numbers.

-- Functions first: the session starter returns a row of game_sessions.
DROP FUNCTION IF EXISTS public.start_game_session_checked(uuid, text, timestamptz, int, text, text, text, text, text, int, timestamptz);
DROP FUNCTION IF EXISTS public.credit_game_session(uuid, uuid, boolean, int);
DROP FUNCTION IF EXISTS public.end_game_session(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.record_game_run(uuid, uuid, text, text, text, text, text, text, text, int, int, int[], int, text, jsonb);
DROP FUNCTION IF EXISTS public.save_game_snapshot(uuid, text, int, jsonb);
DROP FUNCTION IF EXISTS public.claim_game_ai_line(uuid, uuid, timestamptz, int);
DROP FUNCTION IF EXISTS public.game_play_limits_read(uuid, uuid);
DROP FUNCTION IF EXISTS public.game_play_limits_write(uuid, uuid, int, int);

-- The consents hold a foreign key to the registry (ON DELETE RESTRICT), so they go first.
DELETE FROM public.data_practice_consents WHERE practice_key IN ('game_play_records', 'game_ai_debrief');
DELETE FROM public.data_practices WHERE key IN ('game_play_records', 'game_ai_debrief');

DROP POLICY IF EXISTS game_runs_select_own ON public.game_runs;
DROP POLICY IF EXISTS game_progress_select_own ON public.game_progress;
DROP POLICY IF EXISTS game_saves_select_own ON public.game_saves;
DROP POLICY IF EXISTS game_sessions_select_own ON public.game_sessions;
DROP POLICY IF EXISTS learner_play_limits_select_own ON public.learner_play_limits;

-- Children before parents: runs reference sessions and the catalog.
DROP TABLE IF EXISTS public.game_runs;
DROP TABLE IF EXISTS public.game_progress;
DROP TABLE IF EXISTS public.game_saves;
DROP TABLE IF EXISTS public.game_sessions;
DROP TABLE IF EXISTS public.learner_play_limits;
DROP TABLE IF EXISTS public.game_catalog;

-- The metrics validator was the CHECK of game_runs.metrics, so it goes after the table.
DROP FUNCTION IF EXISTS public.game_metrics_valid(jsonb);
