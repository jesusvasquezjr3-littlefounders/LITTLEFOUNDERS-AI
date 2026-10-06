-- game_records — learner records for games embedded in /learn (first: KartRush).
-- @phase: expand
-- Design: docs/games/KARTRUSH-INTEGRATION-DESIGN.md section 6; wire contract: docs/games/KRV1-CONTRACT.md.
--
-- Games award no XP, coins or streak credit and never write kc_attempt (design
-- principle 4), so these tables are plain first-party learner records like
-- lesson_progress, not analytics and not mastery evidence. Core is the only
-- writer (service role); the browser never reads them directly. Everything
-- cascades from auth.users, so the E.6 erasure needs no new step.
--
-- This file only ADDS: tables and registry rows (the functions follow in
-- game_records_functions). The retention sweep deletes rows, which the phase
-- classifier counts as a contraction, so it is a separate contract file
-- (game_records_retention) that an operator applies by hand. Until it is
-- applied nothing is deleted; the tables just grow.
--
-- Rules every table follows (the 0208 convention): RLS on, no API-role
-- privilege, service role only, self-or-verified-guardian SELECT policy (inert
-- until a GRANT exists, kept so a later grant cannot widen the read).

-- A numeric-only jsonb object with a bounded key set: the game metrics column
-- stays generic across games and can never carry text (design 6.1, as 0028).
CREATE OR REPLACE FUNCTION public.game_metrics_valid(p jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
    SELECT CASE WHEN jsonb_typeof(p) = 'object' THEN
        (SELECT count(*) FROM jsonb_each(p)) <= 24
        AND NOT EXISTS (
            SELECT 1 FROM jsonb_each(p) e
            WHERE e.key !~ '^[A-Za-z][A-Za-z0-9_]{0,31}$'
               OR jsonb_typeof(e.value) <> 'number'
               OR abs((e.value #>> '{}')::numeric) > 1000000000000)
    ELSE false END
$$;

CREATE TABLE IF NOT EXISTS public.game_catalog (
    game_id              text PRIMARY KEY CHECK (game_id ~ '^[a-z][a-z0-9_]{1,31}$'),
    status               text NOT NULL DEFAULT 'hidden' CHECK (status IN ('live', 'hidden', 'retired')),
    min_band             text NOT NULL DEFAULT '6-9' CHECK (min_band IN ('6-9', '10-12', '13-17', 'adult')),
    content_pack_version smallint NOT NULL DEFAULT 1 CHECK (content_pack_version >= 1),
    updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.game_catalog TO service_role;

INSERT INTO public.game_catalog (game_id, status) VALUES ('kartrush', 'live') ON CONFLICT (game_id) DO NOTHING;

-- One row per play session. active_seconds is the only clock: heartbeats credit
-- visible, focused time; last_active_at is the last such heartbeat (idle).
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    game_id           text NOT NULL REFERENCES public.game_catalog (game_id),
    -- Opaque handle the game receives instead of any account identifier.
    session_ref       text NOT NULL UNIQUE CHECK (session_ref ~ '^[A-Za-z0-9_-]{8,64}$'),
    started_at        timestamptz NOT NULL DEFAULT now(),
    expires_at        timestamptz NOT NULL,
    last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
    last_active_at    timestamptz NOT NULL DEFAULT now(),
    ended_at          timestamptz,
    close_reason      text CHECK (close_reason IN ('soft', 'hard', 'idle', 'left')),
    active_seconds    integer NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
    max_minutes       smallint NOT NULL DEFAULT 25 CHECK (max_minutes BETWEEN 5 AND 25),
    mentor            text CHECK (mentor ~ '^[a-z]{2,16}$'),
    locale            text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    band              text NOT NULL CHECK (band IN ('6-9', '10-12', '13-17', 'adult')),
    client_build      text CHECK (char_length(client_build) <= 40),
    CONSTRAINT game_sessions_closed_has_reason CHECK ((ended_at IS NULL) = (close_reason IS NULL))
);
CREATE INDEX IF NOT EXISTS game_sessions_user_started ON public.game_sessions (user_id, game_id, started_at DESC);
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.game_sessions TO service_role;
DROP POLICY IF EXISTS game_sessions_select_own ON public.game_sessions;
CREATE POLICY game_sessions_select_own ON public.game_sessions
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- One row per finished race. Identifiers are shaped, not enumerated, so a new
-- track or kart is an application change and not a CHECK that must be narrowed
-- and re-added later. ai_line_at marks the single AI debrief a run may claim.
CREATE TABLE IF NOT EXISTS public.game_runs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    uuid NOT NULL REFERENCES public.game_sessions (id) ON DELETE CASCADE,
    user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    game_id       text NOT NULL REFERENCES public.game_catalog (game_id),
    run_key       text NOT NULL CHECK (run_key ~ '^[A-Za-z0-9_-]{8,64}$'),
    mode          text NOT NULL CHECK (mode IN ('single', 'timeTrial')),
    track_id      text NOT NULL CHECK (track_id ~ '^[A-Za-z][A-Za-z0-9]{1,31}$'),
    character     text NOT NULL CHECK (character ~ '^[a-z]{2,16}$'),
    kart_body     text NOT NULL CHECK (kart_body ~ '^[A-Za-z][A-Za-z0-9]{0,23}$'),
    speed_class   text NOT NULL CHECK (speed_class ~ '^[0-9]{2,3}cc$'),
    finish_ms     integer NOT NULL CHECK (finish_ms BETWEEN 1 AND 1800000),
    best_lap_ms   integer NOT NULL CHECK (best_lap_ms BETWEEN 1 AND 1800000),
    lap_ms        integer[] NOT NULL CHECK (cardinality(lap_ms) BETWEEN 1 AND 5),
    rank          smallint NOT NULL CHECK (rank BETWEEN 1 AND 8),
    lens          text NOT NULL CHECK (lens ~ '^[a-z_]{2,24}$'),
    metrics       jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (public.game_metrics_valid(metrics)),
    new_best      boolean NOT NULL DEFAULT false,
    reflection    text CHECK (reflection IN ('a', 'b', 'unsure')),
    verification  text NOT NULL DEFAULT 'reported' CHECK (verification IN ('reported', 'replay_verified')),
    ai_line_at    timestamptz,
    ai_cost_usd   numeric(10, 6) NOT NULL DEFAULT 0 CHECK (ai_cost_usd >= 0),
    created_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT game_runs_run_key_once UNIQUE (user_id, game_id, run_key)
);
CREATE INDEX IF NOT EXISTS game_runs_user_created ON public.game_runs (user_id, game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_runs_ai_line ON public.game_runs (user_id, ai_line_at) WHERE ai_line_at IS NOT NULL;
ALTER TABLE public.game_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.game_runs TO service_role;
DROP POLICY IF EXISTS game_runs_select_own ON public.game_runs;
CREATE POLICY game_runs_select_own ON public.game_runs
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- Server-side bests per (track, character, speed class); never a ranking between people.
CREATE TABLE IF NOT EXISTS public.game_progress (
    user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    game_id        text NOT NULL REFERENCES public.game_catalog (game_id),
    track_id       text NOT NULL CHECK (track_id ~ '^[A-Za-z][A-Za-z0-9]{1,31}$'),
    character      text NOT NULL CHECK (character ~ '^[a-z]{2,16}$'),
    speed_class    text NOT NULL CHECK (speed_class ~ '^[0-9]{2,3}cc$'),
    best_finish_ms integer NOT NULL CHECK (best_finish_ms BETWEEN 1 AND 1800000),
    best_lap_ms    integer NOT NULL CHECK (best_lap_ms BETWEEN 1 AND 1800000),
    runs           integer NOT NULL DEFAULT 1 CHECK (runs >= 1),
    last_played_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game_id, track_id, character, speed_class)
);
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_progress FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.game_progress TO service_role;
DROP POLICY IF EXISTS game_progress_select_own ON public.game_progress;
CREATE POLICY game_progress_select_own ON public.game_progress
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- The game's own save, compare-and-set on revision. 64 KB; ghosts stay on the device.
CREATE TABLE IF NOT EXISTS public.game_saves (
    user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    game_id        text NOT NULL REFERENCES public.game_catalog (game_id),
    schema_version smallint NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
    revision       integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
    save           jsonb NOT NULL CHECK (jsonb_typeof(save) = 'object' AND octet_length(save::text) <= 65536),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game_id)
);
ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.game_saves FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.game_saves TO service_role;
DROP POLICY IF EXISTS game_saves_select_own ON public.game_saves;
CREATE POLICY game_saves_select_own ON public.game_saves
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- What a verified guardian lowered. Absent row = the platform ceiling (2 / 25).
CREATE TABLE IF NOT EXISTS public.learner_play_limits (
    user_id              uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    max_sessions_per_day smallint NOT NULL DEFAULT 2 CHECK (max_sessions_per_day BETWEEN 0 AND 2),
    max_session_minutes  smallint NOT NULL DEFAULT 25 CHECK (max_session_minutes BETWEEN 5 AND 25),
    set_by               uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.learner_play_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.learner_play_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.learner_play_limits TO service_role;
DROP POLICY IF EXISTS learner_play_limits_select_own ON public.learner_play_limits;
CREATE POLICY learner_play_limits_select_own ON public.learner_play_limits
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- ─────────────────────────────────────────────────────────────
-- Data practices (OD-9 4.2; 0186 and 0202 precedent). A migrated child needs a
-- fresh, specific consent from a verified Tutor, never the teen alone. The
-- requirement label stays within the 16 characters Core's registry read allows.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.data_practices (key, kind, introduced_by, requirement, consent_source, teen_self_consent, summary) VALUES
    ('game_play_records', 'learner_record', 'game_records', 'G6/OD-9', 'data_practice_consents', false,
     'Race results, bests, play time and the game save kept per learner for games in the learning area; never XP, coins or a streak.'),
    ('game_ai_debrief', 'learner_record', 'game_records', 'G8/OD-9', 'data_practice_consents', false,
     'One short Mentor line written by an AI model from a race''s closed profile (no name, no id, no free text), within a daily cap.')
ON CONFLICT (key) DO NOTHING;
