-- @phase: expand
-- E.8 age-tiered social layer, E.13 profile-content safety review (S08.6).
--
-- Additive half. Nothing here refuses a write an older Core makes: it adds the
-- tier classifier, the self-managed consent queue for independent teens, the
-- profile-field classifier and its review record, and the metric reader. The
-- enforcement that narrows behaviour (follow admission by tier, tier-aware
-- visibility, the profile-field write guard) is the companion contract
-- migration `social_tier_enforcement`, applied after the Core release that
-- uses these functions.
--
-- Tiers (every minor safeguard follows age, not role: OD-3):
--   guardian  a parent-created child (kid role), or an under-13-origin account
--             that a verified guardian has linked. Strictest tier: not
--             discoverable, every connection needs a guardian (E.1).
--   teen      a self-registered account whose age screen said 13 to 17 and
--             that holds no verified adult evidence. Private profile; the teen
--             accepts or declines each connection (E.8's lighter tier).
--   adult     a screened adult, or a parent with current ID verification.
--   closed    everything else: guests, under-13 origins with no guardian, an
--             account with no role evidence or no age screen yet. No social
--             layer at all (OD-3 gives guests none); fail closed.

CREATE OR REPLACE FUNCTION public.social_tier(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT CASE
        WHEN p_user IS NULL
          OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user)
          OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user) THEN 'closed'
        WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'kid') THEN 'guardian'
        WHEN EXISTS (SELECT 1 FROM public.account_safety_origins WHERE user_id = p_user) THEN
            CASE WHEN EXISTS (SELECT 1 FROM public.guardian_links
                    WHERE kid_user_id = p_user AND verification_status = 'verified')
                 THEN 'guardian' ELSE 'closed' END
        WHEN (SELECT is_anonymous FROM auth.users WHERE id = p_user) IS TRUE THEN 'closed'
        WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user AND role = 'parent')
          AND EXISTS (SELECT 1 FROM (
                SELECT status, method, birth_date FROM public.parent_verifications WHERE user_id = p_user
                ORDER BY created_at DESC, id DESC LIMIT 1
            ) latest WHERE latest.status = 'verified' AND latest.method = 'local-ocr'
                AND latest.birth_date <= ((now() AT TIME ZONE 'UTC')::date - interval '18 years')::date) THEN 'adult'
        WHEN (SELECT declared_age_band FROM public.account_age_declarations WHERE user_id = p_user) = 'adult' THEN 'adult'
        WHEN (SELECT declared_age_band FROM public.account_age_declarations WHERE user_id = p_user) = '13_to_17' THEN 'teen'
        ELSE 'closed'
    END;
$$;
REVOKE ALL ON FUNCTION public.social_tier(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_tier(uuid) TO service_role;

-- The linked family of a guardian-tier account: its verified guardians and the
-- accounts that share one of them. Symmetric.
CREATE OR REPLACE FUNCTION public.social_family(p_a uuid, p_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_a IS NOT NULL AND p_b IS NOT NULL AND p_a <> p_b AND (
        EXISTS (SELECT 1 FROM public.guardian_links WHERE verification_status = 'verified'
            AND ((parent_user_id = p_a AND kid_user_id = p_b) OR (parent_user_id = p_b AND kid_user_id = p_a)))
        OR EXISTS (SELECT 1 FROM public.guardian_links a JOIN public.guardian_links b
            ON a.parent_user_id = b.parent_user_id
            WHERE a.kid_user_id = p_a AND b.kid_user_id = p_b
              AND a.verification_status = 'verified' AND b.verification_status = 'verified')
    );
$$;
REVOKE ALL ON FUNCTION public.social_family(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_family(uuid, uuid) TO service_role;

-- ── E.13: profile-field classifier ──────────────────────────────────────────
-- Mirrored exactly by backend/src/services/profileFieldSafety.ts; both run the
-- shared corpus database/scripts/fixtures/profile-field-safety-cases.json.
-- Accented letters are matched with '.' so the result does not depend on the
-- database collation's lower() for non-ASCII capitals.
CREATE OR REPLACE FUNCTION public.profile_field_flags(p_value text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
    v text := lower(coalesce(p_value, ''));
    flags text[] := '{}';
BEGIN
    IF v ~ '[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}'
       OR length(regexp_replace(v, '[^0-9]', '', 'g')) >= 7 THEN
        flags := array_append(flags, 'contact');
    END IF;
    IF v ~ '(https?://|www\.|\.(com|net|org|io|gg|tv|me|app|ly|link|mx|br|co)([^a-z]|$))' THEN
        flags := array_append(flags, 'link');
    END IF;
    IF position('@' IN v) > 0 THEN
        flags := array_append(flags, 'handle');
    END IF;
    IF regexp_split_to_array(v, '[^a-z]+') && ARRAY['ig', 'yt', 'fb', 'ttv', 'psn', 'rblx', 'snap', 'insta', 'xbl']
       OR v ~ '(instagram|tiktok|snapchat|youtube|discord|roblox|fortnite|twitch|twitter|facebook|whatsapp|telegram|playstation|xbox|minecraft|pinterest|reddit|kwai|likee|zepeto)' THEN
        flags := array_append(flags, 'platform');
    END IF;
    IF v ~ '(school|escuela|escola|colegio|col.gio|primaria|prim.ria|secundaria|secund.ria|elementary|kinder|preescolar|liceo|instituto|academy|academia|class ?of|grade ?[0-9]|[0-9](st|nd|rd|th) ?grade|grado|s.rie ?[0-9])' THEN
        flags := array_append(flags, 'school');
    END IF;
    IF v ~ '(street|avenue|avenida|apartment|apartamento|c.digo postal|zip ?code|(^|[^a-z])(calle|rua|road|cep|apt|depto|colonia|bairro|barrio)([^a-z]|$)|(^|[^0-9])[0-9]{5}([^0-9]|$))' THEN
        flags := array_append(flags, 'location');
    END IF;
    IF v ~ '(^|[^0-9])(19[5-9][0-9]|20[0-3][0-9])([^0-9]|$)' THEN
        flags := array_append(flags, 'year');
    END IF;
    RETURN flags;
END;
$$;
REVOKE ALL ON FUNCTION public.profile_field_flags(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_field_flags(text) TO service_role;

-- One current review per account in scope. Written at creation and on every
-- edit (triggers below), and when an account enters scope. Minimal by design:
-- the flag vocabulary, never the reviewed text itself.
CREATE TABLE IF NOT EXISTS public.profile_safety_reviews (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username_flags text[] NOT NULL DEFAULT '{}',
    display_name_flags text[] NOT NULL DEFAULT '{}',
    rules_version integer NOT NULL,
    reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_safety_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_safety_reviews FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.profile_safety_reviews TO service_role;

-- In scope: every minor tier, plus an account a verified guardian has linked
-- (a child in the middle of being created has its link before its role).
CREATE OR REPLACE FUNCTION public.profile_review_in_scope(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT public.social_tier(p_user) IN ('guardian', 'teen')
        OR EXISTS (SELECT 1 FROM public.guardian_links WHERE kid_user_id = p_user AND verification_status = 'verified');
$$;
REVOKE ALL ON FUNCTION public.profile_review_in_scope(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_review_in_scope(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.review_profile_fields(p_user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE profile record; name_flags text[]; handle_flags text[];
BEGIN
    IF p_user IS NULL OR NOT public.profile_review_in_scope(p_user) THEN RETURN NULL; END IF;
    SELECT username, display_name INTO profile FROM public.profiles WHERE user_id = p_user;
    IF NOT FOUND THEN RETURN NULL; END IF;
    handle_flags := public.profile_field_flags(profile.username);
    name_flags := public.profile_field_flags(profile.display_name);
    INSERT INTO public.profile_safety_reviews(user_id, username_flags, display_name_flags, rules_version, reviewed_at)
    VALUES (p_user, handle_flags, name_flags, 1, now())
    ON CONFLICT (user_id) DO UPDATE SET username_flags = EXCLUDED.username_flags,
        display_name_flags = EXCLUDED.display_name_flags, rules_version = EXCLUDED.rules_version,
        reviewed_at = EXCLUDED.reviewed_at;
    RETURN cardinality(handle_flags) > 0 OR cardinality(name_flags) > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.review_profile_fields(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_profile_fields(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.profile_fields_flagged(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.profile_safety_reviews
        WHERE user_id = p_user AND (cardinality(username_flags) > 0 OR cardinality(display_name_flags) > 0));
$$;
REVOKE ALL ON FUNCTION public.profile_fields_flagged(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.profile_fields_flagged(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.review_profile_fields_on_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF TG_TABLE_NAME = 'profiles' OR TG_TABLE_NAME = 'account_age_declarations' THEN
        PERFORM public.review_profile_fields(NEW.user_id);
    ELSIF TG_TABLE_NAME = 'user_roles' THEN
        PERFORM public.review_profile_fields(NEW.user_id);
    ELSIF TG_TABLE_NAME = 'guardian_links' THEN
        PERFORM public.review_profile_fields(NEW.kid_user_id);
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.review_profile_fields_on_change() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER profile_safety_review_profiles
AFTER INSERT OR UPDATE OF username, display_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.review_profile_fields_on_change();
CREATE OR REPLACE TRIGGER profile_safety_review_age
AFTER INSERT ON public.account_age_declarations
FOR EACH ROW EXECUTE FUNCTION public.review_profile_fields_on_change();
CREATE OR REPLACE TRIGGER profile_safety_review_roles
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.review_profile_fields_on_change();
CREATE OR REPLACE TRIGGER profile_safety_review_links
AFTER INSERT OR UPDATE OF verification_status ON public.guardian_links
FOR EACH ROW EXECUTE FUNCTION public.review_profile_fields_on_change();

-- The audit of every existing profile: E.13 applies to accounts that exist
-- today, not only to the next edit.
SELECT public.review_profile_fields(user_id) FROM public.profiles;

-- ── E.8: the independent teen's own consent queue ───────────────────────────
-- Separate from social_connection_requests (whose decider is a guardian):
-- here the decider is the teen the request targets, and nobody else.
CREATE TABLE IF NOT EXISTS public.social_consent_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'removed')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    decided_at timestamptz,
    CONSTRAINT social_consent_not_self CHECK (requester_id <> subject_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS social_consent_one_open
    ON public.social_consent_requests(requester_id, subject_id) WHERE status IN ('pending', 'accepted');
CREATE INDEX IF NOT EXISTS social_consent_subject_queue
    ON public.social_consent_requests(subject_id, requested_at, id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS social_consent_requester_pending
    ON public.social_consent_requests(requester_id) WHERE status = 'pending';
ALTER TABLE public.social_consent_requests ENABLE ROW LEVEL SECURITY;
-- No browser policies; Core reads with the service role and writes only
-- through the functions below.
REVOKE ALL ON public.social_consent_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.social_consent_requests TO service_role;

CREATE OR REPLACE FUNCTION public.has_current_teen_consent(p_viewer uuid, p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_viewer IS NOT NULL AND p_subject IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.social_consent_requests
          WHERE requester_id = p_viewer AND subject_id = p_subject AND status = 'accepted')
      AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id = p_viewer AND followed_id = p_subject)
      AND NOT EXISTS (SELECT 1 FROM public.blocks
          WHERE (blocker_id = p_viewer AND blocked_id = p_subject)
             OR (blocker_id = p_subject AND blocked_id = p_viewer));
$$;
REVOKE ALL ON FUNCTION public.has_current_teen_consent(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_current_teen_consent(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.request_teen_connection(p_requester_id uuid, p_subject_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request_id uuid; requester_tier text;
BEGIN
    IF p_requester_id IS NULL OR p_subject_id IS NULL OR p_requester_id = p_subject_id THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    -- The same pair lock every other social transition takes.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'social-request:' || p_requester_id::text || ':' || p_subject_id::text, 0));
    IF public.social_tier(p_subject_id) <> 'teen' OR public.profile_fields_flagged(p_subject_id) THEN
        RAISE EXCEPTION 'SOCIAL_REQUEST_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    requester_tier := public.social_tier(p_requester_id);
    IF requester_tier = 'closed' THEN
        RAISE EXCEPTION 'SOCIAL_REQUEST_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    IF requester_tier = 'guardian' THEN
        RAISE EXCEPTION 'GUARDIAN_MANAGED_CONNECTIONS' USING ERRCODE = 'P0001';
    END IF;
    IF public.profile_fields_flagged(p_requester_id) THEN
        RAISE EXCEPTION 'PROFILE_REVIEW_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.blocks WHERE
        (blocker_id = p_requester_id AND blocked_id = p_subject_id)
        OR (blocker_id = p_subject_id AND blocked_id = p_requester_id)) THEN
        RAISE EXCEPTION 'SOCIAL_REQUEST_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    SELECT id INTO request_id FROM public.social_consent_requests
        WHERE requester_id = p_requester_id AND subject_id = p_subject_id AND status = 'pending';
    IF request_id IS NOT NULL THEN RETURN request_id; END IF;
    IF EXISTS (SELECT 1 FROM public.social_consent_requests
        WHERE requester_id = p_requester_id AND subject_id = p_subject_id AND status = 'accepted') THEN
        RAISE EXCEPTION 'SOCIAL_ALREADY_CONNECTED' USING ERRCODE = 'P0001';
    END IF;
    -- A decline is respected: the same requester waits 30 days to ask again.
    IF EXISTS (SELECT 1 FROM public.social_consent_requests
        WHERE requester_id = p_requester_id AND subject_id = p_subject_id AND status = 'declined'
          AND decided_at > now() - interval '30 days') THEN
        RAISE EXCEPTION 'SOCIAL_REQUEST_COOLDOWN' USING ERRCODE = 'P0001';
    END IF;
    -- One account cannot flood teens with requests.
    IF (SELECT count(*) FROM public.social_consent_requests
        WHERE requester_id = p_requester_id AND status = 'pending') >= 20 THEN
        RAISE EXCEPTION 'SOCIAL_REQUEST_LIMIT' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.social_consent_requests(requester_id, subject_id)
        VALUES (p_requester_id, p_subject_id) RETURNING id INTO request_id;
    INSERT INTO public.audit_logs(actor_id, action, subject, detail)
        VALUES (p_requester_id, 'social.connection_requested', p_subject_id::text,
            jsonb_build_object('request_id', request_id, 'requester_id', p_requester_id,
                'subject_id', p_subject_id, 'tier', 'teen', 'origin', 'database-function'));
    RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_teen_connection(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_teen_connection(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.decide_teen_connection(p_request_id uuid, p_subject_id uuid, p_accept boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request public.social_consent_requests%ROWTYPE; decision text; requester_tier text;
BEGIN
    IF p_request_id IS NULL OR p_subject_id IS NULL OR p_accept IS NULL THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_DECISION' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO request FROM public.social_consent_requests WHERE id = p_request_id;
    -- Only the teen the request targets decides; anyone else sees "not found".
    IF NOT FOUND OR request.subject_id <> p_subject_id THEN
        RAISE EXCEPTION 'SOCIAL_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'social-request:' || request.requester_id::text || ':' || request.subject_id::text, 0));
    SELECT * INTO request FROM public.social_consent_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'SOCIAL_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    decision := CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
    IF request.status = decision THEN RETURN decision; END IF;
    IF request.status <> 'pending' THEN
        RAISE EXCEPTION 'SOCIAL_DECISION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    IF p_accept THEN
        IF public.social_tier(p_subject_id) <> 'teen' THEN
            RAISE EXCEPTION 'SOCIAL_REQUEST_UNAVAILABLE' USING ERRCODE = 'P0001';
        END IF;
        IF public.profile_fields_flagged(p_subject_id) THEN
            RAISE EXCEPTION 'PROFILE_REVIEW_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        requester_tier := public.social_tier(request.requester_id);
        IF requester_tier IN ('closed', 'guardian') OR public.profile_fields_flagged(request.requester_id) THEN
            RAISE EXCEPTION 'SOCIAL_REQUEST_UNAVAILABLE' USING ERRCODE = 'P0001';
        END IF;
        IF EXISTS (SELECT 1 FROM public.blocks WHERE
            (blocker_id = request.requester_id AND blocked_id = request.subject_id)
            OR (blocker_id = request.subject_id AND blocked_id = request.requester_id)) THEN
            RAISE EXCEPTION 'SOCIAL_CONNECTION_BLOCKED' USING ERRCODE = 'P0001';
        END IF;
    END IF;
    UPDATE public.social_consent_requests SET status = decision, decided_at = now() WHERE id = p_request_id;
    IF p_accept THEN
        INSERT INTO public.follows(follower_id, followed_id) VALUES (request.requester_id, request.subject_id)
            ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO public.audit_logs(actor_id, action, subject, detail)
        VALUES (p_subject_id, 'social.connection_' || decision, request.subject_id::text,
            jsonb_build_object('request_id', p_request_id, 'requester_id', request.requester_id,
                'subject_id', request.subject_id, 'tier', 'teen', 'origin', 'database-function'));
    RETURN decision;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_teen_connection(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_teen_connection(uuid, uuid, boolean) TO service_role;

-- ── Appendix J metrics (E.8 tier coverage, E.13 review coverage) ────────────
-- Counts only; no identifier leaves this function.
CREATE OR REPLACE FUNCTION public.social_safety_metrics()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH tiers AS (
        SELECT p.user_id, public.social_tier(p.user_id) AS tier,
               public.profile_review_in_scope(p.user_id) AS in_scope
        FROM public.profiles p
    ), reviewed AS (
        SELECT t.tier, t.in_scope, r.user_id IS NOT NULL AS has_review,
               coalesce(cardinality(r.username_flags) > 0 OR cardinality(r.display_name_flags) > 0, false) AS flagged
        FROM tiers t LEFT JOIN public.profile_safety_reviews r ON r.user_id = t.user_id
    )
    SELECT jsonb_build_object(
        'accountsByTier', jsonb_build_object(
            'guardian', (SELECT count(*) FROM tiers WHERE tier = 'guardian'),
            'teen', (SELECT count(*) FROM tiers WHERE tier = 'teen'),
            'adult', (SELECT count(*) FROM tiers WHERE tier = 'adult'),
            'closed', (SELECT count(*) FROM tiers WHERE tier = 'closed')),
        'profileReview', jsonb_build_object(
            'inScope', (SELECT count(*) FROM reviewed WHERE in_scope),
            'reviewed', (SELECT count(*) FROM reviewed WHERE in_scope AND has_review),
            'flagged', (SELECT count(*) FROM reviewed WHERE in_scope AND flagged),
            'guardianTierInScope', (SELECT count(*) FROM reviewed WHERE in_scope AND tier = 'guardian'),
            'guardianTierReviewed', (SELECT count(*) FROM reviewed WHERE in_scope AND tier = 'guardian' AND has_review)),
        'teenConsent', jsonb_build_object(
            'pending', (SELECT count(*) FROM public.social_consent_requests WHERE status = 'pending'),
            'accepted', (SELECT count(*) FROM public.social_consent_requests WHERE status = 'accepted'),
            'declined', (SELECT count(*) FROM public.social_consent_requests WHERE status = 'declined'),
            'withdrawnOrRemoved', (SELECT count(*) FROM public.social_consent_requests WHERE status IN ('withdrawn', 'removed')))
    );
$$;
REVOKE ALL ON FUNCTION public.social_safety_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_safety_metrics() TO service_role;
