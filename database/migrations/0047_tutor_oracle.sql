-- 0047_tutor_oracle.sql — the AI Tutor (Oracle) runtime schema.
--
-- Authoritative design: /ORACLE.md. Owner decision record: /ORACLE.md §0.
-- Seven tables, one retention function, one consent predicate.
--
-- POSTURE. Everything here is written by Core or Oracle with the service
-- role; no client INSERT/UPDATE/DELETE policy exists on any of these tables,
-- the same shape as course_placements (0043), generation telemetry (0017) and
-- the picture/speech caches (0014/0015). Clients READ their own rows, and a
-- verified guardian reads their child's — that is the parent-visibility
-- product invariant (/AGENTS.md §1.9), not a feature flag, so it is expressed
-- as an RLS policy rather than as application code that could forget.
--
-- WHAT IS DELIBERATELY ABSENT. There is no column anywhere in this migration
-- for the learner's audio. /ORACLE.md §0 decision 8: a child's voice transits
-- to the speech-to-text provider and is never stored by us. A nullable
-- `learner_audio_path` would be an invitation; the absence of the column is
-- the enforcement.

-- ─────────────────────────────────────────────────────────────
-- tutor_preferences — the personalized stage, one row per user
-- ─────────────────────────────────────────────────────────────
-- `nickname` is the ONLY name-shaped value that ever reaches the model
-- (/ORACLE.md §4.1). It is learner-chosen and moderated at write time by
-- Core, never derived from profiles.display_name — deriving it would put a
-- real name in front of a third-party API through the back door.
CREATE TABLE IF NOT EXISTS public.tutor_preferences (
    user_id     uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    character   text NOT NULL DEFAULT 'rho'
                    CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    companion   text NULL
                    CHECK (companion IS NULL OR companion IN ('dina', 'liruf', 'rho', 'zara')),
    diorama     text NOT NULL DEFAULT 'diorama-a',
    backdrop    text NOT NULL DEFAULT 'auto'
                    CHECK (backdrop IN ('auto', 'dawn', 'day', 'dusk', 'night')),
    nickname    text NULL CHECK (nickname IS NULL OR char_length(nickname) BETWEEN 1 AND 24),
    -- Closed vocabulary (/ORACLE.md §11). A learner-chosen array, never
    -- inferred: the Tutor may OFFER to adapt, and may never label anyone.
    adaptations text[] NOT NULL DEFAULT ARRAY[]::text[],
    updated_at  timestamptz NOT NULL DEFAULT now(),
    -- A companion that is also the lead would render the same character twice.
    CONSTRAINT tutor_preferences_companion_differs CHECK (companion IS NULL OR companion <> character),
    CONSTRAINT tutor_preferences_adaptations_closed CHECK (
        adaptations <@ ARRAY[
            'slower_pacing', 'more_examples', 'less_text',
            'more_visual', 'repeat_before_advancing'
        ]::text[]
    )
);

ALTER TABLE public.tutor_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_preferences_select_own ON public.tutor_preferences;
CREATE POLICY tutor_preferences_select_own ON public.tutor_preferences
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- ─────────────────────────────────────────────────────────────
-- tutor_voice_consent — the blocking gate on a minor's microphone
-- ─────────────────────────────────────────────────────────────
-- /ORACLE.md §4.3. Append-only in spirit and in policy: a revocation writes
-- `revoked_at` on the live row and nothing is ever deleted, because "was
-- consent in force at 14:32 on the 3rd?" is a question this table must be
-- able to answer years later.
--
-- WHY A DEDICATED TABLE and not a profile column: consent is granted BY a
-- specific verified guardian, FOR a specific scope, AT a specific time, and
-- all three are evidentiary. A boolean on `profiles` records none of them.
CREATE TABLE IF NOT EXISTS public.tutor_voice_consent (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    granted_by    uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
    -- Specific, never a general terms acceptance (/ORACLE.md §4.3).
    scope         text NOT NULL DEFAULT 'tutor_voice' CHECK (scope = 'tutor_voice'),
    -- The exact wording the guardian was shown, so a later dispute is
    -- resolvable against what was actually on screen rather than against
    -- whatever the current build says.
    consent_text  text NOT NULL,
    locale        text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    granted_at    timestamptz NOT NULL DEFAULT now(),
    revoked_at    timestamptz NULL,
    revoked_by    uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL
);

-- One LIVE consent per (user, scope). A revoked row does not block a new
-- grant, which is what makes revoke-then-re-grant work.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tutor_voice_consent_live
    ON public.tutor_voice_consent (user_id, scope)
    WHERE revoked_at IS NULL;

ALTER TABLE public.tutor_voice_consent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_voice_consent_select_own ON public.tutor_voice_consent;
CREATE POLICY tutor_voice_consent_select_own ON public.tutor_voice_consent
    FOR SELECT USING (
        user_id = auth.uid()
        OR granted_by = auth.uid()
        OR public.is_verified_guardian_of(user_id)
    );

-- The one predicate the whole microphone gate hangs on. SECURITY DEFINER with
-- an empty search_path, matching every other privileged helper in this schema.
CREATE OR REPLACE FUNCTION public.has_active_tutor_voice_consent(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.tutor_voice_consent c
        WHERE c.user_id = p_user_id
          AND c.scope = 'tutor_voice'
          AND c.revoked_at IS NULL
    );
$$;

REVOKE ALL ON FUNCTION public.has_active_tutor_voice_consent(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_tutor_voice_consent(uuid) TO service_role;

-- ─────────────────────────────────────────────────────────────
-- tutor_sessions — one row per conversation
-- ─────────────────────────────────────────────────────────────
-- `tier` is stored, `birth_date` is not: the session record must carry what
-- was actually sent to the model (/ORACLE.md §4.1), and an exact age was
-- never sent. Storing the derived band keeps the audit honest AND keeps this
-- table from becoming a second, unregulated copy of a minor's date of birth.
CREATE TABLE IF NOT EXISTS public.tutor_sessions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    locale         text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    tier           smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
    character      text NOT NULL CHECK (character IN ('dina', 'liruf', 'rho', 'zara')),
    companion      text NULL CHECK (companion IS NULL OR companion IN ('dina', 'liruf', 'rho', 'zara')),
    diorama        text NOT NULL,
    -- The closed intent vocabulary from the offer screen (/ORACLE.md §9.2).
    intent         text NOT NULL CHECK (intent IN
                       ('course_topic', 'weak_skill', 'faq', 'open', 'diagnostic')),
    course_id      uuid NULL REFERENCES public.courses (id) ON DELETE SET NULL,
    topic_id       uuid NULL REFERENCES public.topics (id) ON DELETE SET NULL,
    skill_key      text NULL,
    -- Whether the microphone was actually used, and under which consent row.
    -- NULL consent with voice_used = true must never happen for a kid; the
    -- constraint below is the last line of defence behind Core and Oracle.
    voice_used     boolean NOT NULL DEFAULT false,
    consent_id     uuid NULL REFERENCES public.tutor_voice_consent (id) ON DELETE SET NULL,
    started_at     timestamptz NOT NULL DEFAULT now(),
    ended_at       timestamptz NULL,
    -- How the session ended. 'abandoned' is written by the retention/janitor
    -- pass, never by a client: a socket that simply died is not a graceful
    -- close and must not be recorded as one.
    close_reason   text NULL CHECK (close_reason IN
                       ('completed', 'soft_budget', 'hard_budget', 'learner_left',
                        'abandoned', 'consent_revoked', 'safety_stop', 'error')),
    turn_count     integer NOT NULL DEFAULT 0 CHECK (turn_count >= 0),
    segment_count  integer NOT NULL DEFAULT 0 CHECK (segment_count >= 0),
    xp_awarded     integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
    -- Measured, like Forge's ledger, so the economics are visible before they
    -- are a surprise (/ORACLE.md §15).
    cost_usd       numeric(10, 6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
    -- Retention (/ORACLE.md §12). Written at creation so the janitor never
    -- has to re-derive a policy that may have changed since.
    purge_after    timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

CREATE INDEX IF NOT EXISTS idx_tutor_sessions_user_started
    ON public.tutor_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_sessions_purge
    ON public.tutor_sessions (purge_after);

ALTER TABLE public.tutor_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_sessions_select_own ON public.tutor_sessions;
CREATE POLICY tutor_sessions_select_own ON public.tutor_sessions
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- ─────────────────────────────────────────────────────────────
-- tutor_turns — the transcript, both sides
-- ─────────────────────────────────────────────────────────────
-- The tutor's audio IS stored (a Depot path); the learner's is NOT, and there
-- is no column for it. `moderation` records the verdict that let this turn
-- through, so an incident can be reconstructed without re-running anything.
CREATE TABLE IF NOT EXISTS public.tutor_turns (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   uuid NOT NULL REFERENCES public.tutor_sessions (id) ON DELETE CASCADE,
    seq          integer NOT NULL CHECK (seq >= 0),
    speaker      text NOT NULL CHECK (speaker IN ('learner', 'tutor', 'system')),
    text         text NOT NULL,
    -- Canonical Character Control vocabulary; NULL on a learner turn.
    emotion      text NULL CHECK (emotion IS NULL OR emotion IN
                     ('neutral', 'happy', 'excited', 'thinking',
                      'surprised', 'encouraging', 'proud')),
    action       text NULL CHECK (action IS NULL OR action IN
                     ('idle', 'jump', 'hop', 'wave', 'point', 'celebrate',
                      'nod', 'shake', 'think', 'dance', 'peek', 'bow')),
    -- Depot path for the TUTOR's synthesized audio only.
    audio_path   text NULL,
    -- Whether this turn came from the model or from a scripted safe response.
    source       text NOT NULL DEFAULT 'model'
                     CHECK (source IN ('model', 'scripted', 'stt')),
    moderation   jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_tutor_turns_session_seq
    ON public.tutor_turns (session_id, seq);

ALTER TABLE public.tutor_turns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_turns_select_own ON public.tutor_turns;
CREATE POLICY tutor_turns_select_own ON public.tutor_turns
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.tutor_sessions s
        WHERE s.id = tutor_turns.session_id
          AND (s.user_id = auth.uid() OR public.is_verified_guardian_of(s.user_id))
    ));

-- ─────────────────────────────────────────────────────────────
-- tutor_segments — what the Lesson Engine actually ran, live
-- ─────────────────────────────────────────────────────────────
-- `answer` is the server-only key and MUST NOT have a client SELECT path.
-- That is why this table's read policy is column-blind but the API never
-- serves the raw row: Core strips it (stripAnswers) exactly as it does for
-- course lessons. Belt AND braces — the policy below excludes clients from
-- the table entirely, and only a guardian/owner read of the REDACTED view is
-- offered for replay.
CREATE TABLE IF NOT EXISTS public.tutor_segments (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    uuid NOT NULL REFERENCES public.tutor_sessions (id) ON DELETE CASCADE,
    seq           integer NOT NULL CHECK (seq >= 0),
    -- Which rung of the content ladder produced this (/ORACLE.md §7).
    origin        text NOT NULL CHECK (origin IN ('catalog', 'bank', 'live')),
    -- Present only for `catalog`: the published lesson this came from, so a
    -- content fix propagates and provenance is never guessed.
    lesson_id     uuid NULL REFERENCES public.lessons (id) ON DELETE SET NULL,
    segment_type  text NOT NULL,
    payload       jsonb NOT NULL,
    -- SERVICE ROLE ONLY. Never served to a client, ever.
    answer        jsonb NULL,
    -- Whether Core could independently re-derive the key. XP is payable only
    -- when this is true (/ORACLE.md §8) — a generated segment whose key
    -- cannot be verified still teaches, but pays nothing.
    key_verified  boolean NOT NULL DEFAULT false,
    score         integer NULL CHECK (score IS NULL OR score BETWEEN 0 AND 100),
    xp_awarded    integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
    attempts      integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    -- Full generation record for `live`: model, prompt hash, gate results,
    -- judge verdict. A defect found later must be traceable to every learner
    -- who saw it (/ORACLE.md §7.3).
    provenance    jsonb NOT NULL DEFAULT '{}'::jsonb,
    -- Post-hoc sampled human review (/ORACLE.md §7.3). NULL = not sampled.
    review_status text NULL CHECK (review_status IN ('pending', 'approved', 'rejected')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_tutor_segments_session_seq
    ON public.tutor_segments (session_id, seq);

CREATE INDEX IF NOT EXISTS idx_tutor_segments_review
    ON public.tutor_segments (review_status, created_at DESC)
    WHERE review_status IS NOT NULL;

ALTER TABLE public.tutor_segments ENABLE ROW LEVEL SECURITY;
-- No client policy at all: this table holds answer keys. Reads for replay go
-- through Core, which strips them. Same posture as lesson_documents.

-- ─────────────────────────────────────────────────────────────
-- tutor_packs — the pre-generated bank (ladder tier 2)
-- ─────────────────────────────────────────────────────────────
-- Generated offline by Forge, published by a HUMAN. This is /ORACLE.md §7.2
-- and it is the v1 "Money Moments" pack mechanism generalized from eight
-- hand-written situations to skill x tier x locale.
CREATE TABLE IF NOT EXISTS public.tutor_packs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_key   text NOT NULL CHECK (char_length(skill_key) BETWEEN 1 AND 128),
    tier        smallint NOT NULL CHECK (tier BETWEEN 1 AND 3),
    locale      text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    pack        jsonb NOT NULL,
    status      text NOT NULL DEFAULT 'review'
                    CHECK (status IN ('review', 'published', 'archived')),
    -- Same human-release gate as lessons (COURSE_ENGINE.md §6).
    released_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
    released_at timestamptz NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (skill_key, tier, locale)
);

CREATE INDEX IF NOT EXISTS idx_tutor_packs_lookup
    ON public.tutor_packs (skill_key, tier, locale)
    WHERE status = 'published';

ALTER TABLE public.tutor_packs ENABLE ROW LEVEL SECURITY;
-- No client policy: packs carry answer keys, like lesson_documents.

-- ─────────────────────────────────────────────────────────────
-- tutor_safety_flags — what the input classifier caught
-- ─────────────────────────────────────────────────────────────
-- /ORACLE.md §5 layer 4. A flagged utterance is routed to a scripted safe
-- response and NEVER to the model. The flag is guardian-visible on purpose:
-- a child disclosing distress to a tutor is precisely the case where a
-- parent must find out, and burying it in an admin table would be a product
-- failure dressed up as privacy.
CREATE TABLE IF NOT EXISTS public.tutor_safety_flags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  uuid NOT NULL REFERENCES public.tutor_sessions (id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    turn_seq    integer NULL,
    category    text NOT NULL CHECK (category IN
                    ('self_harm', 'abuse_disclosure', 'adult_content',
                     'grooming_pattern', 'personal_data', 'injection_attempt',
                     'model_output_blocked')),
    -- Deliberately NOT the utterance. A flag is a signal to a human, not a
    -- second unregulated copy of what a distressed child said.
    severity    text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    handled     text NOT NULL CHECK (handled IN ('scripted_response', 'turn_blocked', 'session_stopped')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tutor_safety_flags_user
    ON public.tutor_safety_flags (user_id, created_at DESC);

ALTER TABLE public.tutor_safety_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tutor_safety_flags_select_own ON public.tutor_safety_flags;
CREATE POLICY tutor_safety_flags_select_own ON public.tutor_safety_flags
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- ─────────────────────────────────────────────────────────────
-- Retention (/ORACLE.md §12) — 90 days, enforced, not aspirational
-- ─────────────────────────────────────────────────────────────
-- A retention policy nobody runs is not a retention policy. This function is
-- called by the nightly maintenance workflow. It returns what it deleted so
-- the run has evidence rather than a silent success.
--
-- Deleting the SESSION cascades to turns, segments and flags. Audio blobs in
-- Depot are removed by the caller from the returned paths — a database
-- function has no business making HTTP calls.
CREATE OR REPLACE FUNCTION public.purge_expired_tutor_sessions(p_limit integer DEFAULT 500)
RETURNS TABLE (session_id uuid, audio_paths text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    WITH expired AS (
        SELECT s.id
        FROM public.tutor_sessions s
        WHERE s.purge_after <= now()
        ORDER BY s.purge_after ASC
        LIMIT GREATEST(p_limit, 0)
    ),
    paths AS (
        SELECT e.id,
               COALESCE(array_agg(t.audio_path) FILTER (WHERE t.audio_path IS NOT NULL),
                        ARRAY[]::text[]) AS audio
        FROM expired e
        LEFT JOIN public.tutor_turns t ON t.session_id = e.id
        GROUP BY e.id
    ),
    gone AS (
        DELETE FROM public.tutor_sessions s
        USING expired e
        WHERE s.id = e.id
        RETURNING s.id
    )
    SELECT g.id, p.audio
    FROM gone g
    JOIN paths p ON p.id = g.id;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_tutor_sessions(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_tutor_sessions(integer) TO service_role;
