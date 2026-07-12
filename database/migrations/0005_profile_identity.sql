-- 0005_profile_identity.sql — public profile identity: @username, cover
-- customization, and the follows social graph. Idempotent delta.
--
-- Design constraints (Jesús, 2026-07-12):
--  * Covers are TOKEN GRADIENTS ONLY — `cover` stores a tiny jsonb config
--    (preset id). No image uploads exist anywhere in this schema, for
--    covers OR avatars — avatars are DiceBear option sets (0002.avatars).
--  * Avatar + cover + username + display_name are PUBLIC to signed-in users,
--    but exposure happens through Core (service role, whitelisted fields) —
--    profiles RLS stays self+guardian only.

-- ─────────────────────────────────────────────────────────────
-- profiles: @username (unique handle) + cover config
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_username_format
        CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

-- ─────────────────────────────────────────────────────────────
-- follows — "sígueme en LittleFounders": user → user edges
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    followed_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id),
    CONSTRAINT follows_not_self CHECK (follower_id <> followed_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_followed ON public.follows (followed_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- You see the edges you're part of; you only manage edges where YOU follow.
-- (Aggregated public counts flow through Core with the service role.)
DROP POLICY IF EXISTS follows_select_party ON public.follows;
CREATE POLICY follows_select_party ON public.follows
    FOR SELECT USING (follower_id = auth.uid() OR followed_id = auth.uid());
DROP POLICY IF EXISTS follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own ON public.follows
    FOR INSERT WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS follows_delete_own ON public.follows;
CREATE POLICY follows_delete_own ON public.follows
    FOR DELETE USING (follower_id = auth.uid());
