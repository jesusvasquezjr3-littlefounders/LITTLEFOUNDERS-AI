-- 0007_course_hierarchy.sql — the real content hierarchy (COURSE_ENGINE.md §2).
-- Delta over 0001-0006 (never edit an applied migration). Idempotent.
--
-- courses ── adventures ── sagas ── topics ── lessons ── lesson_documents (×3 locales)
--
-- The 0002-provisional `lessons` table (course_id + raw `content` jsonb) was a
-- day-1 placeholder — DEV-ONLY demo seeds, no real data, never deepened past
-- its original shape (database/AGENTS.md: "0002_content_skeleton.sql is
-- PROVISIONAL"). It is replaced here by a real 5-level hierarchy; `courses`
-- is kept and extended (it already carries real published rows).

-- ─────────────────────────────────────────────────────────────
-- Retire the 0002-provisional `lessons` table. CASCADE also drops its RLS
-- policy, its 0003 index (idx_lessons_course_position), and any dev rows —
-- all of it was placeholder data, never real content.
-- ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.lessons CASCADE;

-- ─────────────────────────────────────────────────────────────
-- courses: extend with subject/description/position (kept, not dropped —
-- 0002's published demo rows stay valid and are re-seeded with the new
-- columns in dev_seed.sql).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'money';
DO $$
BEGIN
    ALTER TABLE public.courses
        ADD CONSTRAINT courses_subject_check
        CHECK (subject IN ('money', 'math', 'science', 'economics', 'code', 'mixed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS description jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- adventures — top-level worlds of a course (theme-scened, per COURSE_ENGINE §2)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.adventures (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id      uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    position       integer NOT NULL,
    slug           text NOT NULL,
    title          jsonb NOT NULL DEFAULT '{}'::jsonb,
    description    jsonb NOT NULL DEFAULT '{}'::jsonb,
    narrative_arc  text,
    theme          text NOT NULL CHECK (theme IN ('archipelago', 'forest', 'city', 'valley', 'kingdom', 'cosmos')),
    age_tier       text NOT NULL DEFAULT 'tier1' CHECK (age_tier IN ('tier1', 'tier2')),
    status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT adventures_course_slug_unique UNIQUE (course_id, slug),
    CONSTRAINT adventures_course_position_unique UNIQUE (course_id, position)
);

-- ─────────────────────────────────────────────────────────────
-- sagas — chapters of an adventure
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sagas (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    adventure_id uuid NOT NULL REFERENCES public.adventures (id) ON DELETE CASCADE,
    position     integer NOT NULL,
    slug         text NOT NULL,
    title        jsonb NOT NULL DEFAULT '{}'::jsonb,
    description  jsonb NOT NULL DEFAULT '{}'::jsonb,
    icon         text NOT NULL DEFAULT 'auto_stories',
    status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sagas_adventure_slug_unique UNIQUE (adventure_id, slug),
    CONSTRAINT sagas_adventure_position_unique UNIQUE (adventure_id, position)
);

-- ─────────────────────────────────────────────────────────────
-- topics — the pedagogy unit: concept, objective, vocabulary, prior knowledge
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.topics (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    saga_id            uuid NOT NULL REFERENCES public.sagas (id) ON DELETE CASCADE,
    position           integer NOT NULL,
    slug               text NOT NULL,
    title              jsonb NOT NULL DEFAULT '{}'::jsonb,
    concept_md         text NOT NULL DEFAULT '',
    learning_objective jsonb NOT NULL DEFAULT '{}'::jsonb,
    key_vocabulary     jsonb NOT NULL DEFAULT '[]'::jsonb,
    prior_knowledge    text NOT NULL DEFAULT '',
    status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT topics_saga_slug_unique UNIQUE (saga_id, slug),
    CONSTRAINT topics_saga_position_unique UNIQUE (saga_id, position)
);

-- ─────────────────────────────────────────────────────────────
-- lessons — play metadata; the actual playable content lives in
-- lesson_documents (one row per locale). `status` includes 'review':
-- Forge-generated content lands here awaiting a human publish (COURSE_ENGINE
-- §4/§6 — generated lessons never auto-publish).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lessons (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id           uuid NOT NULL REFERENCES public.topics (id) ON DELETE CASCADE,
    position           integer NOT NULL,
    slug               text NOT NULL,
    title              jsonb NOT NULL DEFAULT '{}'::jsonb,
    difficulty         integer NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    xp_total           integer NOT NULL DEFAULT 0,
    estimated_minutes  integer NOT NULL DEFAULT 5,
    "cast"             jsonb NOT NULL DEFAULT '[]'::jsonb, -- "cast" is a reserved word in Postgres; must stay quoted everywhere
    status             text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
    created_at         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT lessons_topic_slug_unique UNIQUE (topic_id, slug),
    CONSTRAINT lessons_topic_position_unique UNIQUE (topic_id, position)
);

-- ─────────────────────────────────────────────────────────────
-- lesson_documents — the LESSON_ENGINE.md contract split in two:
--   `document`    CLIENT-SAFE, stripped of every `answer` field.
--   `answer_keys` SERVER-ONLY: { segment_id → answer }. Core grades with it
--                 and applies stripAnswers() (LESSON_ENGINE.md §3) — Vault
--                 never even hands this table's rows to a browser.
-- No RLS SELECT policy exists for this table at all — see the RLS section
-- below for why that omission is deliberate, not an oversight.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_documents (
    lesson_id      uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
    locale         text NOT NULL CHECK (locale IN ('en-US', 'es-MX', 'pt-BR')),
    schema_version integer NOT NULL DEFAULT 1,
    document       jsonb NOT NULL,
    answer_keys    jsonb NOT NULL DEFAULT '{}'::jsonb,
    audio          jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (lesson_id, locale)
);

-- ─────────────────────────────────────────────────────────────
-- lesson_segment_attempts — one row per graded attempt (Core-written only)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_segment_attempts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    lesson_id       uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
    segment_id      text NOT NULL,
    attempt_number  integer NOT NULL,
    score           integer NOT NULL CHECK (score BETWEEN 0 AND 100),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_segment_attempts_user_lesson
    ON public.lesson_segment_attempts (user_id, lesson_id);

-- ─────────────────────────────────────────────────────────────
-- lesson_progress — per-user rollup (Core-written only; feeds learning_stats)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lesson_progress (
    user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    lesson_id     uuid NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
    best_score    integer NOT NULL DEFAULT 0,
    passed        boolean NOT NULL DEFAULT false,
    attempts      integer NOT NULL DEFAULT 0,
    xp_earned     integer NOT NULL DEFAULT 0,
    completed_at  timestamptz,
    updated_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);
-- PRIMARY KEY (user_id, lesson_id) already indexes user_id as its leading
-- column — a separate idx_lesson_progress_user would be redundant.

-- Note: adventures/sagas/topics/lessons each already carry a
-- UNIQUE (parent_id, position) constraint (above), which Postgres backs with
-- a btree index — that index already serves "children ordered by position"
-- lookups; no separate index is added for that access path.

-- ─────────────────────────────────────────────────────────────
-- updated_at maintenance (reuses touch_updated_at() from 0003)
-- ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_lesson_documents_touch ON public.lesson_documents;
CREATE TRIGGER trg_lesson_documents_touch
    BEFORE UPDATE ON public.lesson_documents
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_lesson_progress_touch ON public.lesson_progress;
CREATE TRIGGER trg_lesson_progress_touch
    BEFORE UPDATE ON public.lesson_progress
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.adventures              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sagas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_segment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress         ENABLE ROW LEVEL SECURITY;

-- Published-content read chain (mirrors 0002's courses/lessons EXISTS
-- pattern, extended one level per table): a row is readable only when it is
-- itself published AND every ancestor up to the course is published.
DROP POLICY IF EXISTS adventures_select_published ON public.adventures;
CREATE POLICY adventures_select_published ON public.adventures
    FOR SELECT USING (
        status = 'published' AND auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.courses c
            WHERE c.id = course_id AND c.status = 'published'
        )
    );

DROP POLICY IF EXISTS sagas_select_published ON public.sagas;
CREATE POLICY sagas_select_published ON public.sagas
    FOR SELECT USING (
        status = 'published' AND auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.adventures a
            JOIN public.courses c ON c.id = a.course_id
            WHERE a.id = adventure_id AND a.status = 'published' AND c.status = 'published'
        )
    );

DROP POLICY IF EXISTS topics_select_published ON public.topics;
CREATE POLICY topics_select_published ON public.topics
    FOR SELECT USING (
        status = 'published' AND auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.sagas s
            JOIN public.adventures a ON a.id = s.adventure_id
            JOIN public.courses c ON c.id = a.course_id
            WHERE s.id = saga_id AND s.status = 'published' AND a.status = 'published' AND c.status = 'published'
        )
    );

DROP POLICY IF EXISTS lessons_select_published ON public.lessons;
CREATE POLICY lessons_select_published ON public.lessons
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

-- lesson_documents: DELIBERATELY NO SELECT POLICY.
-- RLS is row-level, not column-level — a "published lesson chain" policy on
-- this table would still expose `answer_keys` (jsonb) on the very same row
-- to any authenticated client, defeating the split contract. So instead of a
-- narrower policy we grant NONE: RLS with zero permissive policies denies
-- every row to `authenticated`/`anon`. Core (service role, which bypasses
-- RLS entirely) is the only reader; it fetches the row, strips answer_keys
-- via stripAnswers()-equivalent logic, and serves only `document` to the
-- browser. Do not add a SELECT policy here — see database/AGENTS.md.

-- lesson_segment_attempts: no client INSERT (Core/service role writes every
-- graded attempt). Self and verified guardians may read.
DROP POLICY IF EXISTS lesson_segment_attempts_select_own ON public.lesson_segment_attempts;
CREATE POLICY lesson_segment_attempts_select_own ON public.lesson_segment_attempts
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- lesson_progress: no client INSERT/UPDATE (Core/service role is the only
-- writer — it also feeds learning_stats on completion). Self and verified
-- guardians may read.
DROP POLICY IF EXISTS lesson_progress_select_own ON public.lesson_progress;
CREATE POLICY lesson_progress_select_own ON public.lesson_progress
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
