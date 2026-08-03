-- 0029_game_attempt_integrity.sql — one run is paid exactly once.
--
-- Delta over 0027 (never edit an applied migration). Idempotent.
--
-- THE DEFECT THIS CLOSES. `POST /api/v1/games/:gameId/complete` credits XP,
-- `plays` and `minutes_learned` for a run, and it deduplicates by asking
-- `game_attempts` whether that run id was already recorded. That question and the
-- INSERT that answers it are separated by several awaits (the document read, the
-- replay, the attempt write), so two concurrent POSTs carrying ONE run id both
-- read zero rows, both insert, and both credit — the same play-through paid twice.
-- 0027 had no constraint that could stop it: `run_id` was `uuid NOT NULL` and
-- nothing more.
--
-- An application-level check cannot fix this, because the window it has to close
-- is exactly the window between its own read and its own write. Only the database
-- can decide "this row already exists" atomically, so the invariant lives here and
-- Core reads the DB's verdict (`ON CONFLICT DO NOTHING` + `RETURNING`) instead of
-- trusting a count it took earlier.
--
-- WHY (user_id, game_id, run_id) AND NOT run_id ALONE.
--   * It is EXACTLY the key Core deduplicates on (services/gameData.ts
--     `countAttemptsForRun`), so the constraint and the application check cannot
--     drift into disagreeing about what "the same run" means.
--   * A run id is minted by the browser, and this is a reward path: a global
--     UNIQUE (run_id) would let one account's row deny another account credit for
--     a genuinely different play-through that happened to carry the same id.
--     Denying a child their earned XP is a worse failure than tolerating an id
--     reused across two different games, which pays for two different runs of two
--     different games and inflates nothing.
--   * Uniqueness per (user, game) is all the "paid once" claim needs: XP,
--     `plays` and `minutes_learned` are credited per attempt row, and an attempt
--     row is per user and per game.
--
-- A UNIQUE INDEX rather than a table CONSTRAINT: `CREATE UNIQUE INDEX IF NOT
-- EXISTS` is the idempotent form for a delta (0012's precedent), and `ON CONFLICT
-- (user_id, game_id, run_id)` infers a unique index just as well as a named
-- constraint.
--
-- No RLS change: `game_attempts` stays service-role-written only (0027). This
-- migration adds no policy and no column, and touches no existing row.

-- ─────────────────────────────────────────────────────────────
-- The backstop: a run is recorded at most once per (user, game).
-- ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_game_attempts_user_game_run
    ON public.game_attempts (user_id, game_id, run_id);

COMMENT ON INDEX public.uq_game_attempts_user_game_run IS
    'One play-through is credited once. Core POSTs attempts with ON CONFLICT DO NOTHING against this index and refuses (422 RESULT_REJECTED) when no row comes back, so two concurrent completions of one run_id cannot both pay XP, plays and minutes_learned.';

-- ─────────────────────────────────────────────────────────────
-- idx_game_attempts_user_game (0027) is now redundant: (user_id, game_id) is a
-- leading prefix of the unique index above, which serves the same "this user's
-- attempts at this game" access path. Dropping it removes a second btree that
-- every attempt insert would otherwise have to maintain, and 0027's own note
-- ("UNIQUE is btree-backed and already serves that access path — no separate
-- index") is the same reasoning applied to `games`.
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_game_attempts_user_game;

-- NOTE ON PRE-EXISTING DUPLICATES. The unique index cannot be created over rows
-- that already violate it, and this migration deliberately deletes NOTHING: a
-- `game_attempts` row is a record of a child's play, and silently discarding one
-- to make a DDL statement succeed is not a reconciliation — the XP it already
-- paid into `learning_stats` would stay paid either way. 0027 ships on the same
-- unreleased branch as this file, so no environment can hold duplicates yet; if a
-- future environment ever does, reconcile them by hand (RUNBOOK) before applying.
