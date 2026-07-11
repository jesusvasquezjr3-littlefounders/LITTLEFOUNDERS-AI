-- 0002_content_skeleton.sql
-- ⚠️ PROVISIONAL — the content domain (courses/lessons/tasks/avatars) will be
-- redesigned in a dedicated schema session. Do NOT build deep logic on these
-- shapes yet; they exist so day-1 vertical slices are possible.
-- Idempotent. RLS enabled on every table in this migration.

CREATE TABLE IF NOT EXISTS public.courses (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       text NOT NULL UNIQUE,
    title      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { "en-US": ..., "es-MX": ..., "pt-BR": ... }
    status     text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lessons (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id      uuid NOT NULL REFERENCES public.courses (id) ON DELETE CASCADE,
    position       integer NOT NULL DEFAULT 0,
    schema_version integer NOT NULL DEFAULT 1,
    content        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- client-safe; answer keys live server-side only
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   uuid NOT NULL REFERENCES public.families (id) ON DELETE CASCADE,
    assigned_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    assigned_to uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title       text NOT NULL,
    reward      jsonb NOT NULL DEFAULT '{}'::jsonb,
    status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'approved', 'cancelled')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.avatars (
    user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    seed       text NOT NULL DEFAULT '',
    options    jsonb NOT NULL DEFAULT '{}'::jsonb,   -- DiceBear avataaars options
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

-- published content is readable by any authenticated user
DROP POLICY IF EXISTS courses_select_published ON public.courses;
CREATE POLICY courses_select_published ON public.courses
    FOR SELECT USING (status = 'published' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS lessons_select_published ON public.lessons;
CREATE POLICY lessons_select_published ON public.lessons
    FOR SELECT USING (auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.status = 'published'
    ));

-- tasks: family members involved can read; parents manage via service role for now (provisional)
DROP POLICY IF EXISTS tasks_select_party ON public.tasks;
CREATE POLICY tasks_select_party ON public.tasks
    FOR SELECT USING (assigned_by = auth.uid() OR assigned_to = auth.uid()
        OR public.is_verified_guardian_of(assigned_to));

-- avatars: self read/write; guardians read their kids'
DROP POLICY IF EXISTS avatars_select_own ON public.avatars;
CREATE POLICY avatars_select_own ON public.avatars
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
DROP POLICY IF EXISTS avatars_upsert_own ON public.avatars;
CREATE POLICY avatars_upsert_own ON public.avatars
    FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS avatars_update_own ON public.avatars;
CREATE POLICY avatars_update_own ON public.avatars
    FOR UPDATE USING (user_id = auth.uid());
