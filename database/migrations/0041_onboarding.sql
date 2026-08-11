-- 0041_onboarding.sql — guest onboarding record (Duolingo-style guest
-- accounts + onboarding + placement feature).
--
-- Onboarding collects a discovery-channel survey and an offer to create a
-- real account, then activates day-1 streak. Name and age are NOT columns
-- here: name PATCHes the existing profiles.display_name, and age reuses the
-- existing profiles.birth_date (0006) — this table only records that
-- onboarding happened and its two closed-choice answers, so age is never
-- stored in more than one place (AGENTS.md §1.9 minimization).
--
-- Idempotent. RLS enabled, same posture as learning_stats/lesson_progress:
-- this is a system record ("onboarding happened"), not a self-managed table
-- like `blocks` — Core (service role) is the only writer.

CREATE TABLE IF NOT EXISTS public.onboarding_responses (
    user_id               uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    discovery_channel     text CHECK (discovery_channel IN
                             ('friend', 'social_media', 'search', 'app_store', 'school', 'ad', 'other')),
    account_offer_choice  text NOT NULL CHECK (account_offer_choice IN ('created_now', 'later')),
    completed_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_responses_select_own ON public.onboarding_responses;
CREATE POLICY onboarding_responses_select_own ON public.onboarding_responses
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));

-- No INSERT/UPDATE policy: Core (service role) is the only writer.
