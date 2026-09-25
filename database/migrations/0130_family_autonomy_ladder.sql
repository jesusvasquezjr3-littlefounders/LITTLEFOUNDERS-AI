-- family_autonomy_ladder — S07.5, part 1 of 6 (D.17, D.18): the independence
-- levels a child in a family climbs, and the decision record that every level
-- rule and every D.18 rule reads. Parts: family_autonomy_ladder (tables,
-- thresholds, the actionable-reason rule, backfill), family_autonomy_rules
-- (the level in force, eligibility, the decision guard), family_autonomy_flows
-- (who changes a level), family_decision_guards and family_decision_flows
-- (chores and rewards through the ladder), family_talk_nudges (the nudge,
-- the step-down and the metrics). Split so each file stays under the Windows
-- command-line limit of the operator transport (railway-migrate.test.mjs).
-- @phase: expand
--
-- WHY (Appendix G §4.1, §4.3, §4.4): approval-gating was identical for an
-- 8-year-old and a 17-year-old. D.17 mandates an explicit independence ladder
-- tied to age and an accumulated track record, and the evidence says the
-- fading must be a deliberate, volitional decision, never automatic (Li et al.
-- 2019 found no age-moderation of structure; Beyers et al. 2024 found gradual,
-- volitionally granted independence works best). So:
--
--   Level 1  Ask first     every chore and every reward waits for a Tutor
--                          (the previous flat model; every child starts here)
--   Level 2  Small steps   family contributions (D.10) are self-logged and
--                          counted at once, the Tutor looks afterwards; rewards
--                          up to the Tutor's pre-approved amount (at most 20
--                          coins) need no tap
--   Level 3  Trusted       every chore up to 100 coins is self-logged (a chore
--                          that asks for a photo once the photo is in); rewards
--                          up to the Tutor's pre-approved amount (at most 100)
--
-- The spending limit and the freeze stay unilateral at every level: they are
-- the safety boundary Appendix G §4.4 reserves for the parent.
--
-- WHO CHANGES A LEVEL. A verified Tutor promotes, only when the documented
-- rule says the child is eligible (age AND track record, below), and chooses
-- the pre-approved amount. A Tutor may lower a level at any time with an
-- actionable reason the child reads (D.18). The child may ask for the next
-- level (their own words, the child-voice mechanism) and may step down on
-- their own. Staff holding manage_support may lower a level with a reason
-- (the product-team rollback of Appendix H's D.17 Definition of Done (d)). The
-- system lowers a level by one when a Tutor questions three self-directed
-- items within 30 days: the Appendix D demotion precedent (a level is
-- re-testable, never a permanent one-way flag). Nobody else, and no writer,
-- skips the rule: the guards below check every insert, whoever makes it.
--
-- THE DECISION RECORD (D.18). Every decision on a chore, a reward request or a
-- level request is one immutable row: who decided, the outcome, and for every
-- "not yet" a reason code plus a reason specific enough to act on. It is the
-- track record the ladder reads, the history the child reads, and the source
-- of the Appendix H metrics. Past decisions are backfilled (OD-9: no evidence
-- is lost), marked legacy, before the guard exists.
--
-- Thresholds live in family_autonomy_threshold() and in the Block D threshold
-- log; a gate keeps the log, Core and this file equal.

-- ── Thresholds (one place; the Block D threshold log pins every value) ──────
CREATE OR REPLACE FUNCTION public.family_autonomy_threshold(p_key text)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT (jsonb_build_object(
        'level2_min_age', 8,
        'level2_min_approved', 10,
        'level2_max_not_approved_pct', 25,
        'level2_preapproved_cap', 20,
        'level3_min_age', 12,
        'level3_min_approved', 20,
        'level3_max_not_approved_pct', 20,
        'level3_min_days_at_level2', 28,
        'level3_preapproved_cap', 100,
        'level3_self_log_max_coins', 100,
        'record_window_days', 60,
        'reason_min_chars', 12,
        'reason_min_words', 3,
        'revisit_max_days', 90,
        'child_note_max_chars', 140,
        'auto_step_down_questioned', 3,
        'auto_step_down_window_days', 30,
        'talk_nudge_denials', 3,
        'talk_nudge_window_days', 14,
        'progression_window_days', 30,
        -- Not a threshold: keeps every threshold line above in one shape.
        'thresholds_version', 1
    ) ->> p_key)::int;
$$;
REVOKE ALL ON FUNCTION public.family_autonomy_threshold(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_autonomy_threshold(text) TO service_role;

-- ── D.18: is a reason specific enough to act on? ────────────────────────────
-- A pure function, mirrored by Core and the client and pinned by one fixture
-- (database/scripts/fixtures/denial-reasons.json): 12 to 240 characters, at
-- least three different words, and not one of the generic brush-offs the
-- SPEC names ("not now") in any of the three locales. It cannot judge
-- meaning; Appendix H's human-scored sample (family_talk_nudges) does.
CREATE OR REPLACE FUNCTION public.family_reason_actionable(p_reason text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
    v_raw   text := btrim(coalesce(p_reason, ''));
    v_norm  text;
    v_words text[];
BEGIN
    IF char_length(v_raw) < 12 OR char_length(v_raw) > 240 THEN
        RETURN false;
    END IF;
    -- Accents first (both cases, so the result never depends on the
    -- database locale's lower()), then ASCII lower case.
    v_norm := lower(translate(v_raw, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
                                     'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'));
    v_norm := btrim(regexp_replace(regexp_replace(v_norm, '[^a-z0-9]+', ' ', 'g'), ' +', ' ', 'g'));
    IF v_norm = '' THEN
        RETURN false;
    END IF;
    v_words := regexp_split_to_array(v_norm, ' ');
    IF (SELECT count(DISTINCT w) FROM unnest(v_words) AS w) < 3 THEN
        RETURN false;
    END IF;
    IF v_norm = ANY (ARRAY[
        'not now', 'not right now', 'not today', 'not this time', 'maybe later', 'maybe another time', 'some other time',
        'because i said so', 'because i say so', 'we will see', 'ask me later', 'ask again later', 'no thank you', 'just because',
        'i said no', 'no not now', 'not at the moment', 'we ll see',
        'ahora no', 'ahorita no', 'hoy no', 'mas tarde', 'tal vez despues', 'quizas despues', 'en otro momento', 'otro dia',
        'porque si', 'porque no', 'porque lo digo yo', 'porque yo lo digo', 'ya veremos', 'no por ahora', 'por ahora no',
        'luego vemos', 'despues vemos', 'pregunta despues', 'ahora no se puede',
        'agora nao', 'hoje nao', 'mais tarde', 'talvez depois', 'outro dia', 'outra hora', 'porque sim', 'porque nao',
        'porque eu disse', 'porque eu quero', 'vamos ver', 'depois a gente ve', 'por enquanto nao', 'agora nao da',
        'pergunta depois', 'nao agora'
    ]) THEN
        RETURN false;
    END IF;
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.family_reason_actionable(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_reason_actionable(text) TO service_role;

-- ── Who is a child in a family, and how old ─────────────────────────────────
-- A wallet holder (a parent-created child or an eligible teen) with at least
-- one verified guardian. An unlinked teen has no family mechanics at all
-- (OD-3 Option B), so the ladder does not apply to them.
CREATE OR REPLACE FUNCTION public.family_child_in_family(p_kid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT public.wallet_holder_kind(p_kid) IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.guardian_links gl
                   WHERE gl.kid_user_id = p_kid AND gl.verification_status = 'verified');
$$;

-- Whole years from the stored birth date. A linked teen with no birth date is
-- at least 13 by their locked age declaration. A parent-created child with no
-- birth date has no known age: the conservative answer is NULL, which opens
-- no level above the first (the Tutor can add the birth date).
CREATE OR REPLACE FUNCTION public.family_child_age(p_kid uuid)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_birth date;
BEGIN
    SELECT birth_date INTO v_birth FROM public.profiles WHERE user_id = p_kid;
    IF v_birth IS NOT NULL THEN
        RETURN date_part('year', age(current_date, v_birth))::int;
    END IF;
    IF public.wallet_holder_kind(p_kid) = 'teen' THEN
        RETURN 13;
    END IF;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.family_child_in_family(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_child_age(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_child_in_family(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_child_age(uuid) TO service_role;

-- Staff who may act on a family's account: a superadmin, or an admin holding
-- the manage_support grant (the same grant Core's /admin/family-autonomy
-- routes require).
CREATE OR REPLACE FUNCTION public.family_staff_may_support(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'superadmin')
        OR (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'admin')
            AND EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = p_user AND permission = 'manage_support'));
$$;
REVOKE ALL ON FUNCTION public.family_staff_may_support(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_staff_may_support(uuid) TO service_role;

-- ── Tables ──────────────────────────────────────────────────────────────────
-- A child's current level. No row = Level 1 with nothing pre-approved.
CREATE TABLE IF NOT EXISTS public.family_autonomy_levels (
    kid_user_id       uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    level             smallint NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
    preapproved_limit integer NOT NULL DEFAULT 0 CHECK (preapproved_limit BETWEEN 0 AND 100),
    level_since       timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

-- The child's own ask for the next level, in their own words.
CREATE TABLE IF NOT EXISTS public.family_autonomy_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kid_user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    requested_level smallint NOT NULL CHECK (requested_level BETWEEN 2 AND 3),
    child_note      text CHECK (child_note IS NULL OR (char_length(child_note) BETWEEN 1 AND 140 AND child_note = btrim(child_note))),
    status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'granted', 'declined')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    decided_at      timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS family_autonomy_requests_one_pending ON public.family_autonomy_requests (kid_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS family_autonomy_requests_kid_idx ON public.family_autonomy_requests (kid_user_id, created_at DESC);

-- Every decision on a chore, a reward request or a level request (D.18).
CREATE TABLE IF NOT EXISTS public.family_decisions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kid_user_id         uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    subject             text NOT NULL CHECK (subject IN ('task', 'redemption', 'level_request')),
    task_id             uuid REFERENCES public.tasks (id) ON DELETE CASCADE,
    redemption_id       uuid REFERENCES public.redemptions (id) ON DELETE CASCADE,
    level_request_id    uuid REFERENCES public.family_autonomy_requests (id) ON DELETE CASCADE,
    prior_status        text NOT NULL,
    outcome             text NOT NULL CHECK (outcome IN ('approved', 'self_logged', 'preapproved', 'sent_back', 'cancelled', 'denied', 'granted', 'declined', 'confirmed', 'questioned')),
    reviews_decision_id uuid REFERENCES public.family_decisions (id) ON DELETE CASCADE,
    actor_user_id       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    actor_kind          text NOT NULL CHECK (actor_kind IN ('tutor', 'child')),
    reason_code         text CHECK (reason_code IN ('not_finished', 'redo', 'save_more', 'later_date', 'not_suitable', 'talk_first', 'practice_more')),
    reason              text CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 240),
    revisit_on          date,
    legacy              boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT family_decisions_one_subject CHECK (
        (subject = 'task' AND task_id IS NOT NULL AND redemption_id IS NULL AND level_request_id IS NULL)
        OR (subject = 'redemption' AND redemption_id IS NOT NULL AND task_id IS NULL AND level_request_id IS NULL)
        OR (subject = 'level_request' AND level_request_id IS NOT NULL AND task_id IS NULL AND redemption_id IS NULL))
);
CREATE INDEX IF NOT EXISTS family_decisions_kid_idx ON public.family_decisions (kid_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS family_decisions_task_idx ON public.family_decisions (task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS family_decisions_redemption_idx ON public.family_decisions (redemption_id) WHERE redemption_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS family_decisions_one_review ON public.family_decisions (reviews_decision_id) WHERE reviews_decision_id IS NOT NULL;

-- The decision that answered a request (added once both tables exist).
ALTER TABLE public.family_autonomy_requests
    ADD COLUMN IF NOT EXISTS decision_id uuid REFERENCES public.family_decisions (id) ON DELETE SET NULL;

-- Every level change, append-only: the independence-tier event log.
CREATE TABLE IF NOT EXISTS public.family_autonomy_changes (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kid_user_id   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    from_level    smallint NOT NULL CHECK (from_level BETWEEN 1 AND 3),
    to_level      smallint NOT NULL CHECK (to_level BETWEEN 1 AND 3),
    from_limit    integer NOT NULL,
    to_limit      integer NOT NULL,
    actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    actor_kind    text NOT NULL CHECK (actor_kind IN ('tutor', 'child', 'staff', 'system')),
    reason_code   text CHECK (reason_code IN ('practice_more', 'talk_first', 'not_suitable', 'staff_review', 'questioned_pattern')),
    reason        text CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 240),
    request_id    uuid REFERENCES public.family_autonomy_requests (id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS family_autonomy_changes_kid_idx ON public.family_autonomy_changes (kid_user_id, created_at DESC);

-- When a child first became eligible for a level (the denominator of
-- Appendix H's Independence-Tier Progression Rate). Bookkeeping, not
-- behaviour: one row per child and level, never a count of anything done.
CREATE TABLE IF NOT EXISTS public.family_autonomy_eligibility_log (
    kid_user_id       uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    level             smallint NOT NULL CHECK (level BETWEEN 2 AND 3),
    first_eligible_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (kid_user_id, level)
);

-- ── Row-level security: reads for the child and their verified guardians;
-- no browser writes anywhere (every write is a service-role flow below) ─────
ALTER TABLE public.family_autonomy_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_autonomy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_autonomy_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_autonomy_eligibility_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_autonomy_levels_select_party ON public.family_autonomy_levels;
CREATE POLICY family_autonomy_levels_select_party ON public.family_autonomy_levels
    FOR SELECT USING (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));
DROP POLICY IF EXISTS family_autonomy_requests_select_party ON public.family_autonomy_requests;
CREATE POLICY family_autonomy_requests_select_party ON public.family_autonomy_requests
    FOR SELECT USING (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));
DROP POLICY IF EXISTS family_decisions_select_party ON public.family_decisions;
CREATE POLICY family_decisions_select_party ON public.family_decisions
    FOR SELECT USING (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));
DROP POLICY IF EXISTS family_autonomy_changes_select_party ON public.family_autonomy_changes;
CREATE POLICY family_autonomy_changes_select_party ON public.family_autonomy_changes
    FOR SELECT USING (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));
-- The eligibility log has no browser policy: only the metric reads it.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON
    public.family_autonomy_levels, public.family_autonomy_requests, public.family_decisions,
    public.family_autonomy_changes, public.family_autonomy_eligibility_log FROM anon, authenticated;
REVOKE ALL ON public.family_autonomy_eligibility_log FROM anon, authenticated;
-- Every write goes through the functions below (SECURITY DEFINER); the
-- service role reads, and writes only what the guards admit.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.family_autonomy_levels, public.family_autonomy_changes,
    public.family_autonomy_eligibility_log FROM service_role;

-- ── Backfill the track record (OD-9: no evidence lost), before the guard ────
DROP TRIGGER IF EXISTS family_decision_guard ON public.family_decisions;
INSERT INTO public.family_decisions (kid_user_id, subject, task_id, prior_status, outcome, actor_user_id, actor_kind, legacy, created_at)
SELECT t.assigned_to, 'task', t.id, 'done', 'approved', t.decided_by, 'tutor', true, coalesce(t.decided_at, t.created_at)
FROM public.tasks t
WHERE t.status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM public.family_decisions d WHERE d.task_id = t.id);
INSERT INTO public.family_decisions (kid_user_id, subject, redemption_id, prior_status, outcome, actor_user_id, actor_kind, legacy, created_at)
SELECT r.kid_user_id, 'redemption', r.id, 'requested', CASE WHEN r.status = 'denied' THEN 'denied' ELSE 'approved' END,
       r.decided_by, 'tutor', true, coalesce(r.decided_at, r.created_at)
FROM public.redemptions r
WHERE r.status IN ('approved', 'denied', 'fulfilled')
  AND NOT EXISTS (SELECT 1 FROM public.family_decisions d WHERE d.redemption_id = r.id);

SELECT 'family_autonomy_ladder_ok' AS sentinel;
