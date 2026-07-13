-- 0006_social_and_stats.sql — birth date, learning stats, and the social
-- graph's second edge (blocks). Idempotent delta.
--
-- Design (Jesús, 2026-07-12):
--  * birth_date is personal profile data for ANY user (not the adult-only
--    field verified in parent_verifications — those stay separate and
--    unrelated).
--  * learning_stats is a dedicated table so the future lesson/game engines
--    have one obvious place to increment XP/minutes/streak — never derived
--    ad hoc, never stored on `profiles`.
--  * Blocking is enforced at the DB level: a block prevents new follow rows
--    in EITHER direction (is_blocked() in the follows INSERT policy) and
--    Core clears any existing follow edges when a block is created.

-- ─────────────────────────────────────────────────────────────
-- profiles: personal birth date (any user, distinct from Guardian's
-- verified adult birth_date in parent_verifications)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

-- ─────────────────────────────────────────────────────────────
-- learning_stats — 1:1 with auth.users; system-written only (no client
-- INSERT/UPDATE policies). Bootstrapped by trigger + backfilled here.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.learning_stats (
    user_id           uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    xp_points         integer NOT NULL DEFAULT 0 CHECK (xp_points >= 0),
    minutes_learned   integer NOT NULL DEFAULT 0 CHECK (minutes_learned >= 0),
    lessons_completed integer NOT NULL DEFAULT 0 CHECK (lessons_completed >= 0),
    streak_days       integer NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learning_stats_select_own ON public.learning_stats;
CREATE POLICY learning_stats_select_own ON public.learning_stats
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

CREATE OR REPLACE FUNCTION public.handle_new_user_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.learning_stats (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_user_stats ON auth.users;
CREATE TRIGGER trg_handle_new_user_stats
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_stats();

-- Backfill existing users (0001-era accounts predate this trigger).
INSERT INTO public.learning_stats (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- blocks — one-directional; blocker manages their own edges only.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocks (
    blocker_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks (blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blocks_select_own ON public.blocks;
CREATE POLICY blocks_select_own ON public.blocks
    FOR SELECT USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS blocks_insert_own ON public.blocks;
CREATE POLICY blocks_insert_own ON public.blocks
    FOR INSERT WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS blocks_delete_own ON public.blocks;
CREATE POLICY blocks_delete_own ON public.blocks
    FOR DELETE USING (blocker_id = auth.uid());

-- Either direction blocked?
CREATE OR REPLACE FUNCTION public.is_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.blocks
        WHERE (blocker_id = a AND blocked_id = b)
           OR (blocker_id = b AND blocked_id = a)
    );
$$;

-- Harden follows: a block (either direction) prevents new follow rows.
DROP POLICY IF EXISTS follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own ON public.follows
    FOR INSERT WITH CHECK (follower_id = auth.uid() AND NOT public.is_blocked(follower_id, followed_id));
