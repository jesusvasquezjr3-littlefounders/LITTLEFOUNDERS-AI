-- game_records_functions — the service-role functions behind Core's /learn/games routes.
-- @phase: expand
-- Tables and registry rows: game_records. Wire contract: docs/games/KRV1-CONTRACT.md.
--
-- Every function is SECURITY DEFINER, service role only, and raises named
-- refusals (P0001, SCREAMING_SNAKE) that Core maps to one answer each. The
-- atomic ones serialize on a per-learner advisory lock, with a different salt
-- for each kind of operation, so two operations of the same kind contend and
-- nothing else does.

-- ─────────────────────────────────────────────────────────────
-- Atomic session start (the shape of 0057), in two steps under one per-learner
-- lock, so a double tap or two tabs cannot exceed the daily cap.
--
-- 1. REOPEN. A refresh, a crash or a quick trip away and back must not cost a
--    slot of the day. The learner's most recent session is reopened (same row,
--    same id, not a new session, allowed even at the cap) when it is still open
--    or was closed as 'left', its last heartbeat is under 10 minutes old, it
--    has active time left (under the guardian's current minutes, which may only
--    be lower) and its wall-clock life (started_at + its minutes + 10) has not
--    passed. Closed as 'soft', 'hard' or 'idle' it is never reopened: those
--    ended the play on purpose. Reopening gives it the remaining active budget
--    plus 60 seconds of slack as its new expiry, never beyond that same
--    wall-clock life, and starts the heartbeat clock afresh so the time away is
--    not credited as play. It is NOT activity: last_active_at keeps its value,
--    so refreshing cannot reset the idle clock.
-- 2. OTHERWISE a new session, if fewer than p_cap were started since p_since;
--    an empty result means the cap was reached and nothing was inserted. Any
--    earlier session still open (a stale one, past the 10 minutes) is closed.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_game_session_checked(
    p_user_id uuid, p_game_id text, p_since timestamptz, p_cap int, p_session_ref text,
    p_mentor text, p_locale text, p_band text, p_client_build text, p_max_minutes int, p_expires_at timestamptz
) RETURNS SETOF public.game_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_last public.game_sessions;
    v_max int;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_game_id, 59));
    SELECT * INTO v_last FROM public.game_sessions
     WHERE user_id = p_user_id AND game_id = p_game_id ORDER BY started_at DESC LIMIT 1;
    IF FOUND THEN
        v_max := LEAST(v_last.max_minutes, p_max_minutes);
        IF (v_last.ended_at IS NULL OR v_last.close_reason = 'left')
           AND v_last.last_heartbeat_at > now() - interval '10 minutes'
           AND v_last.active_seconds < v_max * 60
           AND v_last.expires_at > now()
           AND v_last.started_at + make_interval(mins => v_max + 10) > now() THEN
            RETURN QUERY
            UPDATE public.game_sessions
               SET ended_at = NULL, close_reason = NULL, max_minutes = v_max,
                   expires_at = LEAST(now() + make_interval(secs => v_max * 60 - v_last.active_seconds + 60),
                                      v_last.started_at + make_interval(mins => v_max + 10)),
                   last_heartbeat_at = now(), session_ref = p_session_ref,
                   mentor = p_mentor, locale = p_locale, band = p_band, client_build = p_client_build
             WHERE id = v_last.id
            RETURNING *;
            RETURN;
        END IF;
    END IF;
    IF (SELECT count(*) FROM public.game_sessions
        WHERE user_id = p_user_id AND game_id = p_game_id AND started_at >= p_since) >= p_cap THEN
        RETURN;
    END IF;
    UPDATE public.game_sessions SET ended_at = now(), close_reason = 'left'
     WHERE user_id = p_user_id AND game_id = p_game_id AND ended_at IS NULL;
    RETURN QUERY
    INSERT INTO public.game_sessions (user_id, game_id, session_ref, expires_at, max_minutes, mentor, locale, band, client_build)
    VALUES (p_user_id, p_game_id, p_session_ref, p_expires_at, p_max_minutes, p_mentor, p_locale, p_band, p_client_build)
    RETURNING *;
END;
$$;

-- Heartbeat accounting: credits min(elapsed, cap) seconds only when the tab is
-- visible and the frame focused, under the row lock. Returns the session as it
-- stood BEFORE this heartbeat's activity stamp (prev_active_at) so Core can
-- judge idleness on the gap this heartbeat ends, plus the database clock.
CREATE OR REPLACE FUNCTION public.credit_game_session(p_session_id uuid, p_user_id uuid, p_credit boolean, p_max_credit_seconds int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    s public.game_sessions;
    v_now timestamptz := clock_timestamp();
    v_credit int := 0;
BEGIN
    SELECT * INTO s FROM public.game_sessions WHERE id = p_session_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'GAME_SESSION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    IF s.ended_at IS NULL THEN
        IF p_credit THEN
            v_credit := GREATEST(0, LEAST(p_max_credit_seconds, floor(extract(epoch FROM (v_now - s.last_heartbeat_at)))::int));
        END IF;
        UPDATE public.game_sessions
           SET active_seconds = active_seconds + v_credit, last_heartbeat_at = v_now,
               last_active_at = CASE WHEN p_credit THEN v_now ELSE last_active_at END
         WHERE id = s.id;
    END IF;
    RETURN jsonb_build_object(
        'active_seconds', s.active_seconds + v_credit, 'prev_active_at', s.last_active_at, 'now', v_now,
        'expires_at', s.expires_at, 'ended_at', s.ended_at, 'close_reason', s.close_reason, 'max_minutes', s.max_minutes);
END;
$$;

-- Closing is idempotent: the first reason wins and a second call changes nothing.
CREATE OR REPLACE FUNCTION public.end_game_session(p_session_id uuid, p_user_id uuid, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_reason IS NULL OR p_reason NOT IN ('soft', 'hard', 'idle', 'left') THEN
        RAISE EXCEPTION 'GAME_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM 1 FROM public.game_sessions WHERE id = p_session_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'GAME_SESSION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.game_sessions SET ended_at = now(), close_reason = p_reason WHERE id = p_session_id AND ended_at IS NULL;
    RETURN true;
END;
$$;

-- Records one finished run and its best, exactly once per (user, game, run key):
-- a repeat returns the stored run (duplicate = true), even after the session
-- closed, so a retried request after a dropped response is never an error.
CREATE OR REPLACE FUNCTION public.record_game_run(
    p_session_id uuid, p_user_id uuid, p_game_id text, p_run_key text, p_mode text, p_track_id text,
    p_character text, p_kart_body text, p_speed_class text, p_finish_ms int, p_best_lap_ms int,
    p_lap_ms int[], p_rank int, p_lens text, p_metrics jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    s public.game_sessions;
    r public.game_runs;
    v_best public.game_progress;
    v_new_best boolean;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_game_id, 61));
    SELECT * INTO r FROM public.game_runs WHERE user_id = p_user_id AND game_id = p_game_id AND run_key = p_run_key;
    IF FOUND THEN
        RETURN jsonb_build_object('run_id', r.id, 'duplicate', true, 'new_best', r.new_best, 'lens', r.lens, 'ai_line_at', r.ai_line_at);
    END IF;
    SELECT * INTO s FROM public.game_sessions WHERE id = p_session_id AND user_id = p_user_id AND game_id = p_game_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'GAME_SESSION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    IF s.ended_at IS NOT NULL THEN RAISE EXCEPTION 'GAME_SESSION_CLOSED' USING ERRCODE = 'P0001'; END IF;
    IF s.expires_at <= now() THEN RAISE EXCEPTION 'GAME_SESSION_EXPIRED' USING ERRCODE = 'P0001'; END IF;
    -- A session is a bounded stretch of play (about 25 minutes of races): 40 runs is far beyond any real one.
    IF (SELECT count(*) FROM public.game_runs WHERE session_id = p_session_id) >= 40 THEN
        RAISE EXCEPTION 'GAME_RUN_LIMIT' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_best FROM public.game_progress
     WHERE user_id = p_user_id AND game_id = p_game_id AND track_id = p_track_id AND character = p_character AND speed_class = p_speed_class
     FOR UPDATE;
    v_new_best := NOT FOUND OR p_finish_ms < v_best.best_finish_ms;

    INSERT INTO public.game_runs (session_id, user_id, game_id, run_key, mode, track_id, character, kart_body, speed_class,
                                  finish_ms, best_lap_ms, lap_ms, rank, lens, metrics, new_best)
    VALUES (p_session_id, p_user_id, p_game_id, p_run_key, p_mode, p_track_id, p_character, p_kart_body, p_speed_class,
            p_finish_ms, p_best_lap_ms, p_lap_ms, p_rank, p_lens, p_metrics, v_new_best)
    RETURNING * INTO r;

    INSERT INTO public.game_progress (user_id, game_id, track_id, character, speed_class, best_finish_ms, best_lap_ms)
    VALUES (p_user_id, p_game_id, p_track_id, p_character, p_speed_class, p_finish_ms, p_best_lap_ms)
    ON CONFLICT (user_id, game_id, track_id, character, speed_class) DO UPDATE
       SET best_finish_ms = LEAST(public.game_progress.best_finish_ms, EXCLUDED.best_finish_ms),
           best_lap_ms = LEAST(public.game_progress.best_lap_ms, EXCLUDED.best_lap_ms),
           runs = public.game_progress.runs + 1,
           last_played_at = now();
    RETURN jsonb_build_object('run_id', r.id, 'duplicate', false, 'new_best', v_new_best, 'lens', r.lens, 'ai_line_at', NULL);
END;
$$;

-- Compare-and-set save. The caller names the revision it last saw (0 = none);
-- success stores the next revision, a mismatch returns the current one. Core caps
-- the compact JSON at 64 KB; jsonb's text form adds spaces after every colon and
-- comma, so this measures it with an allowance (96,000 bytes) and a legal save
-- near the cap is never refused.
CREATE OR REPLACE FUNCTION public.save_game_snapshot(p_user_id uuid, p_game_id text, p_revision int, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_current int;
BEGIN
    IF p_revision IS NULL OR p_revision < 0 OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR octet_length(p_data::text) > 96000 THEN
        RAISE EXCEPTION 'GAME_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_game_id, 67));
    SELECT revision INTO v_current FROM public.game_saves WHERE user_id = p_user_id AND game_id = p_game_id;
    IF NOT FOUND THEN
        IF p_revision <> 0 THEN RETURN jsonb_build_object('ok', false, 'revision', 0); END IF;
        INSERT INTO public.game_saves (user_id, game_id, revision, save) VALUES (p_user_id, p_game_id, 1, p_data);
        RETURN jsonb_build_object('ok', true, 'revision', 1);
    END IF;
    IF v_current <> p_revision THEN RETURN jsonb_build_object('ok', false, 'revision', v_current); END IF;
    UPDATE public.game_saves SET revision = v_current + 1, save = p_data, updated_at = now()
     WHERE user_id = p_user_id AND game_id = p_game_id;
    RETURN jsonb_build_object('ok', true, 'revision', v_current + 1);
END;
$$;

-- The AI debrief's per-learner daily cap, atomically: a run may claim its one
-- line only while fewer than p_cap lines were claimed since p_since.
CREATE OR REPLACE FUNCTION public.claim_game_ai_line(p_user_id uuid, p_run_id uuid, p_since timestamptz, p_cap int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 71));
    IF (SELECT count(*) FROM public.game_runs WHERE user_id = p_user_id AND ai_line_at >= p_since) >= p_cap THEN
        RETURN false;
    END IF;
    UPDATE public.game_runs SET ai_line_at = now() WHERE id = p_run_id AND user_id = p_user_id AND ai_line_at IS NULL;
    RETURN FOUND;
END;
$$;

-- The verified guardian's read and lowering of a child's limits. The database
-- re-derives the verified link; the platform ceiling is the column CHECK.
CREATE OR REPLACE FUNCTION public.game_play_limits_read(p_guardian uuid, p_kid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_guardian IS NULL OR p_kid IS NULL THEN RAISE EXCEPTION 'GAME_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.guardian_links WHERE parent_user_id = p_guardian AND kid_user_id = p_kid
                   AND verification_status = 'verified') THEN
        RAISE EXCEPTION 'GAME_GUARDIAN_NOT_LINKED' USING ERRCODE = 'P0001';
    END IF;
    RETURN COALESCE(
        (SELECT jsonb_build_object('maxSessionsPerDay', max_sessions_per_day, 'maxSessionMinutes', max_session_minutes)
           FROM public.learner_play_limits WHERE user_id = p_kid),
        jsonb_build_object('maxSessionsPerDay', 2, 'maxSessionMinutes', 25));
END;
$$;

CREATE OR REPLACE FUNCTION public.game_play_limits_write(p_guardian uuid, p_kid uuid, p_sessions int, p_minutes int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_guardian IS NULL OR p_kid IS NULL OR p_sessions IS NULL OR p_minutes IS NULL
       OR p_sessions NOT BETWEEN 0 AND 2 OR p_minutes NOT BETWEEN 5 AND 25 THEN
        RAISE EXCEPTION 'GAME_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.guardian_links WHERE parent_user_id = p_guardian AND kid_user_id = p_kid
                   AND verification_status = 'verified') THEN
        RAISE EXCEPTION 'GAME_GUARDIAN_NOT_LINKED' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.learner_play_limits (user_id, max_sessions_per_day, max_session_minutes, set_by)
    VALUES (p_kid, p_sessions, p_minutes, p_guardian)
    ON CONFLICT (user_id) DO UPDATE
       SET max_sessions_per_day = EXCLUDED.max_sessions_per_day, max_session_minutes = EXCLUDED.max_session_minutes,
           set_by = EXCLUDED.set_by, updated_at = now();
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_guardian, 'games.play_limits_set', p_kid::text,
            jsonb_build_object('origin', 'database-function', 'sessions', p_sessions, 'minutes', p_minutes));
    RETURN jsonb_build_object('maxSessionsPerDay', p_sessions, 'maxSessionMinutes', p_minutes);
END;
$$;

-- Service role only, for every function above.
REVOKE ALL ON FUNCTION public.start_game_session_checked(uuid, text, timestamptz, int, text, text, text, text, text, int, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_game_session(uuid, uuid, boolean, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.end_game_session(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_game_run(uuid, uuid, text, text, text, text, text, text, text, int, int, int[], int, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_game_snapshot(uuid, text, int, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_game_ai_line(uuid, uuid, timestamptz, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_play_limits_read(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_play_limits_write(uuid, uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_game_session_checked(uuid, text, timestamptz, int, text, text, text, text, text, int, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_game_session(uuid, uuid, boolean, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.end_game_session(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_game_run(uuid, uuid, text, text, text, text, text, text, text, int, int, int[], int, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_game_snapshot(uuid, text, int, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_game_ai_line(uuid, uuid, timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.game_play_limits_read(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.game_play_limits_write(uuid, uuid, int, int) TO service_role;

