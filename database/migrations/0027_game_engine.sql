-- 0027_game_engine.sql — the Game Engine content + play tables (GAME_ENGINE.md §6).
-- Delta over 0001-0026 (never edit an applied migration). Idempotent.
--
--   topics ── games ── game_documents (×3 locales)
--                   └─ game_attempts / game_progress (per user, Core-written)
--
-- Games are prebuilt deterministic MECHANICS (code) skinned per instance by a
-- generated GameDocument manifest (data), exactly as lessons are a fixed segment
-- runtime skinned by a generated lesson document. A game reinforces ONE topic's
-- concept, so it hangs off `topics` — the same anchor lessons use — and inherits
-- the identical published-chain read posture.
--
-- `game_documents` splits the manifest in two for the SAME reason
-- `lesson_documents` splits out its answer keys: `document` is CLIENT-SAFE, while
-- `validation` is a SERVER-ONLY sidecar (theoretical max score, minimum duration,
-- event caps, item values) that Core uses to reject forged results when it
-- replays a player's input log. Anything that leaks the sidecar hands a client
-- the numbers it needs to fabricate a perfect run, so the split is only worth as
-- much as the RLS posture that protects it (see the RLS section below).
--
-- Rewards are derived server-side by replaying the run; `game_attempts` and
-- `game_progress` are therefore service-role-written only. Verified guardians can
-- read their kid's rows — parent visibility into kid activity is a product
-- invariant (/AGENTS.md §1.9), not a feature flag.

-- ─────────────────────────────────────────────────────────────
-- games — play metadata; the playable manifest lives in game_documents
-- (one row per locale). `status` includes 'review': Arcade-generated games land
-- there awaiting a human publish — generated content never auto-publishes.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.games (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id           uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
    position           integer NOT NULL,
    slug               text NOT NULL,
    mechanic           text NOT NULL CHECK (mechanic IN ('sorter', 'launcher', 'runner', 'stacker', 'autobattler', 'explorer', 'defender', 'flyer')),
    title              jsonb NOT NULL DEFAULT '{}'::jsonb,
    tier               integer NOT NULL CHECK (tier BETWEEN 1 AND 3),
    xp_max             integer NOT NULL DEFAULT 10 CHECK (xp_max BETWEEN 5 AND 50),
    estimated_minutes  integer NOT NULL DEFAULT 3,
    status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    created_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT games_topic_slug_unique UNIQUE (topic_id, slug),
    CONSTRAINT games_topic_position_unique UNIQUE (topic_id, position)
);
-- UNIQUE (topic_id, position) is btree-backed and already serves "a topic's games
-- ordered by position" — no separate index for that access path (0007's note).

-- ─────────────────────────────────────────────────────────────
-- game_documents — the GAME_ENGINE.md contract split in two:
--   `document`   CLIENT-SAFE manifest (meta, skin, config, content, scoring).
--   `validation` SERVER-ONLY: { max_score, min_duration_seconds, max_events,
--                item_values }. Core replays the input log against it and strips
--                it via stripValidation() before serving `document` to a browser.
-- No RLS SELECT policy exists for this table at all — see the RLS section below
-- for why that omission is deliberate, not an oversight.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_documents (
    game_id        uuid NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
    locale         text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    schema_version integer NOT NULL DEFAULT 1,
    document       jsonb NOT NULL,
    validation     jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, locale)
);

-- ─────────────────────────────────────────────────────────────
-- game_attempts — one row per completed run (Core-written only).
-- `stats` holds DERIVED AGGREGATES only. The raw input log is replayed in memory
-- and discarded; it is never persisted here.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_attempts (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    game_id          uuid NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
    run_id           uuid NOT NULL,
    score            integer NOT NULL CHECK (score BETWEEN 0 AND 100),
    duration_seconds integer NOT NULL,
    stats            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_attempts_user_game
    ON public.game_attempts (user_id, game_id);

-- ─────────────────────────────────────────────────────────────
-- game_progress — per-user rollup (Core-written only; feeds learning_stats XP
-- and minutes, never lessons_completed — games are not lessons).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_progress (
    user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    game_id        uuid NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
    best_score     integer NOT NULL DEFAULT 0,
    plays          integer NOT NULL DEFAULT 0,
    passed         boolean NOT NULL DEFAULT false,
    xp_earned      integer NOT NULL DEFAULT 0,
    last_played_at timestamptz,
    updated_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game_id)
);
-- PRIMARY KEY (user_id, game_id) already indexes user_id as its leading column —
-- a separate idx_game_progress_user would be redundant.

-- ─────────────────────────────────────────────────────────────
-- updated_at maintenance (reuses touch_updated_at() from 0003)
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_game_documents_touch ON public.game_documents;
CREATE TRIGGER trg_game_documents_touch
    BEFORE UPDATE ON public.game_documents
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_game_progress_touch ON public.game_progress;
CREATE TRIGGER trg_game_progress_touch
    BEFORE UPDATE ON public.game_progress
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.games          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_progress  ENABLE ROW LEVEL SECURITY;

-- games: the published-content read chain (identical in shape to 0007's
-- lessons_select_published — games hang off `topics` exactly as lessons do). A
-- row is readable only when it is itself published AND every ancestor up to the
-- course is published.
DROP POLICY IF EXISTS games_select_published ON public.games;
CREATE POLICY games_select_published ON public.games
    FOR SELECT USING (
        status = 'published' AND auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.topics t
            JOIN public.sagas s ON s.id = t.saga_id
            JOIN public.adventures a ON a.id = s.adventure_id
            JOIN public.courses c ON c.id = a.course_id
            WHERE t.id = topic_id AND t.status = 'published' AND s.status = 'published'
              AND a.status = 'published' AND c.status = 'published'
        )
    );

-- game_documents: DELIBERATELY NO SELECT POLICY.
-- RLS is row-level, not column-level — a "published game chain" policy on this
-- table would still expose `validation` (jsonb) on the very same row to any
-- authenticated client, handing it the theoretical max score, the minimum
-- plausible duration, the event cap and the per-item values: precisely the
-- numbers needed to forge a perfect run past the server-side replay. That
-- defeats the split contract, so instead of a narrower policy we grant NONE:
-- RLS with zero permissive policies denies every row to `authenticated`/`anon`.
-- Core (service role, which bypasses RLS entirely) is the only reader; it fetches
-- the row, strips the sidecar via stripValidation() (GAME_ENGINE.md §3) and
-- serves only `document` to the browser. Do not add a SELECT policy here — split
-- the validation sidecar out of the table first if that ever needs to change.
-- Same rule, same reasoning as lesson_documents.answer_keys (0007).

-- game_attempts: no client INSERT/UPDATE/DELETE (Core/service role writes every
-- attempt, with the score DERIVED from a server-side replay — a client-writable
-- score column would make the whole replay path pointless). Self and verified
-- guardians may read.
DROP POLICY IF EXISTS game_attempts_select_own ON public.game_attempts;
CREATE POLICY game_attempts_select_own ON public.game_attempts
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- game_progress: no client INSERT/UPDATE/DELETE (Core/service role is the only
-- writer — it also feeds learning_stats on completion). Self and verified
-- guardians may read.
DROP POLICY IF EXISTS game_progress_select_own ON public.game_progress;
CREATE POLICY game_progress_select_own ON public.game_progress
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
