-- @phase: contract
-- @after-release: the Core release that ships the S08.6 social tiers (Core routes /profiles and /profile call social_tier, request_teen_connection, decide_teen_connection and remove_social_follower); apply after it is live.
-- E.8 age-tiered enforcement and E.13 profile-field write guard (S08.6).
--
-- Contract because it narrows what an older Core can do: follows into a
-- self-registered teen now need that teen's recorded consent, a guardian-tier
-- child can no longer follow an account outside its family or its approved
-- connections, closed-tier accounts (guests, unscreened) get no social layer,
-- and a minor's username or display name can no longer be changed to a value
-- the E.13 classifier flags. The block and withdrawal functions are replaced
-- so they also close teen consents; their bodies delete follow rows exactly
-- as 0098/0099 already did.

-- Follow admission, by tier. Every writer (browser, service, the decision
-- functions) goes through this trigger.
CREATE OR REPLACE FUNCTION public.guard_social_follow_admission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE follower_tier text; followed_tier text;
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'social-request:' || NEW.follower_id::text || ':' || NEW.followed_id::text, 0));
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.followed_id) THEN
        RAISE EXCEPTION 'SOCIAL_ROLE_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.blocks WHERE
        (blocker_id = NEW.follower_id AND blocked_id = NEW.followed_id)
        OR (blocker_id = NEW.followed_id AND blocked_id = NEW.follower_id)) THEN
        RAISE EXCEPTION 'SOCIAL_CONNECTION_BLOCKED' USING ERRCODE = 'P0001';
    END IF;
    follower_tier := public.social_tier(NEW.follower_id);
    followed_tier := public.social_tier(NEW.followed_id);
    IF follower_tier = 'closed' OR followed_tier = 'closed' THEN
        RAISE EXCEPTION 'SOCIAL_TIER_CLOSED' USING ERRCODE = 'P0001';
    END IF;
    -- E.1 / E.8 strictest tier, inbound: only a current guardian's approval.
    IF followed_tier = 'guardian'
       AND (current_setting('role', true) IS DISTINCT FROM 'service_role' OR NOT EXISTS (SELECT 1 FROM public.social_connection_requests request
            WHERE requester_id = NEW.follower_id AND kid_user_id = NEW.followed_id
              AND status = 'approved'
              AND public.social_guardian_is_current(request.decided_by, request.kid_user_id))) THEN
        RAISE EXCEPTION 'GUARDIAN_APPROVAL_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    -- E.8 lighter tier, inbound: only the teen's own recorded consent.
    IF followed_tier = 'teen' AND NOT EXISTS (SELECT 1 FROM public.social_consent_requests
            WHERE requester_id = NEW.follower_id AND subject_id = NEW.followed_id AND status = 'accepted') THEN
        RAISE EXCEPTION 'SUBJECT_CONSENT_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    -- E.8 strictest tier, outbound: a child connects only inside its family or
    -- back to an account its guardian already approved. No independent loosening.
    IF follower_tier = 'guardian'
       AND NOT public.social_family(NEW.follower_id, NEW.followed_id)
       AND NOT public.has_current_social_approval(NEW.followed_id, NEW.follower_id) THEN
        RAISE EXCEPTION 'GUARDIAN_MANAGED_CONNECTIONS' USING ERRCODE = 'P0001';
    END IF;
    -- E.13: a minor whose name or handle is flagged makes no new outside connection.
    IF follower_tier IN ('guardian', 'teen') AND public.profile_fields_flagged(NEW.follower_id)
       AND NOT public.social_family(NEW.follower_id, NEW.followed_id) THEN
        RAISE EXCEPTION 'PROFILE_REVIEW_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_social_follow_admission() FROM PUBLIC, anon, authenticated, service_role;

-- Browser-side visibility (the restrictive follows policy from 0094 calls it).
-- Mirrors Core's profileAccess 'full' verdict.
CREATE OR REPLACE FUNCTION public.social_subject_visible(p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT auth.uid() IS NOT NULL AND (
        auth.uid() = p_subject OR (
            public.social_tier(auth.uid()) <> 'closed'
            AND CASE public.social_tier(p_subject)
                WHEN 'adult' THEN true
                WHEN 'guardian' THEN
                    public.social_family(auth.uid(), p_subject)
                    OR (NOT public.profile_fields_flagged(p_subject)
                        AND public.has_current_social_approval(auth.uid(), p_subject))
                WHEN 'teen' THEN
                    EXISTS (SELECT 1 FROM public.guardian_links WHERE kid_user_id = p_subject
                        AND parent_user_id = auth.uid() AND verification_status = 'verified')
                    OR (NOT public.profile_fields_flagged(p_subject) AND (
                        public.has_current_teen_consent(auth.uid(), p_subject)
                        OR EXISTS (SELECT 1 FROM public.follows
                            WHERE follower_id = p_subject AND followed_id = auth.uid())))
                ELSE false
            END
        )
    );
$$;
REVOKE ALL ON FUNCTION public.social_subject_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_subject_visible(uuid) TO authenticated;

-- A block also closes any teen consent between the pair.
CREATE OR REPLACE FUNCTION public.finish_social_block()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item record; actor uuid;
BEGIN
    SELECT id INTO actor FROM auth.users WHERE id = auth.uid();
    DELETE FROM public.follows WHERE
        (follower_id = NEW.blocker_id AND followed_id = NEW.blocked_id)
        OR (follower_id = NEW.blocked_id AND followed_id = NEW.blocker_id);
    FOR item IN UPDATE public.social_connection_requests SET status = 'revoked'
        WHERE status IN ('pending', 'approved') AND (
            (requester_id = NEW.blocker_id AND kid_user_id = NEW.blocked_id)
            OR (requester_id = NEW.blocked_id AND kid_user_id = NEW.blocker_id))
        RETURNING id, requester_id, kid_user_id
    LOOP
        INSERT INTO public.audit_logs(actor_id, action, subject, detail)
            VALUES (actor, 'social.connection_revoked', item.kid_user_id::text,
                jsonb_build_object('request_id', item.id, 'requester_id', item.requester_id,
                    'kid_user_id', item.kid_user_id, 'reason', 'block', 'origin', 'database-trigger'));
    END LOOP;
    FOR item IN UPDATE public.social_consent_requests SET status = 'removed', decided_at = now()
        WHERE status IN ('pending', 'accepted') AND (
            (requester_id = NEW.blocker_id AND subject_id = NEW.blocked_id)
            OR (requester_id = NEW.blocked_id AND subject_id = NEW.blocker_id))
        RETURNING id, requester_id, subject_id
    LOOP
        INSERT INTO public.audit_logs(actor_id, action, subject, detail)
            VALUES (actor, 'social.connection_revoked', item.subject_id::text,
                jsonb_build_object('request_id', item.id, 'requester_id', item.requester_id,
                    'subject_id', item.subject_id, 'tier', 'teen', 'reason', 'block', 'origin', 'database-trigger'));
    END LOOP;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_social_block() FROM PUBLIC, anon, authenticated, service_role;

-- Unfollowing also withdraws the follower's consent record, so a later follow
-- needs the teen to accept again.
CREATE OR REPLACE FUNCTION public.withdraw_social_connection(p_follower_id uuid, p_followed_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item record;
BEGIN
    IF auth.uid() IS NULL OR p_follower_id IS DISTINCT FROM auth.uid()
       OR p_followed_id IS NULL OR p_follower_id = p_followed_id THEN
        RAISE EXCEPTION 'SOCIAL_WITHDRAWAL_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'social-request:' || p_follower_id::text || ':' || p_followed_id::text, 0));
    FOR item IN UPDATE public.social_connection_requests SET status = 'revoked'
        WHERE requester_id = p_follower_id AND kid_user_id = p_followed_id
          AND status IN ('pending', 'approved')
        RETURNING id
    LOOP
        INSERT INTO public.audit_logs(actor_id, action, subject, detail)
            VALUES (auth.uid(), 'social.connection_revoked', p_followed_id::text,
                jsonb_build_object('request_id', item.id, 'requester_id', p_follower_id,
                    'kid_user_id', p_followed_id, 'reason', 'unfollow', 'origin', 'database-function'));
    END LOOP;
    FOR item IN UPDATE public.social_consent_requests SET status = 'withdrawn', decided_at = now()
        WHERE requester_id = p_follower_id AND subject_id = p_followed_id
          AND status IN ('pending', 'accepted')
        RETURNING id
    LOOP
        INSERT INTO public.audit_logs(actor_id, action, subject, detail)
            VALUES (auth.uid(), 'social.connection_revoked', p_followed_id::text,
                jsonb_build_object('request_id', item.id, 'requester_id', p_follower_id,
                    'subject_id', p_followed_id, 'tier', 'teen', 'reason', 'unfollow', 'origin', 'database-function'));
    END LOOP;
    DELETE FROM public.follows WHERE follower_id = p_follower_id AND followed_id = p_followed_id;
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_social_connection(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_social_connection(uuid, uuid) TO authenticated;

-- E.8: the account being followed removes a follower (the teen manages its
-- own connections; a child or adult may also tighten). Core passes the
-- session identity as p_subject_id.
CREATE OR REPLACE FUNCTION public.remove_social_follower(p_subject_id uuid, p_follower_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE item record;
BEGIN
    IF p_subject_id IS NULL OR p_follower_id IS NULL OR p_subject_id = p_follower_id THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_REMOVAL' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'social-request:' || p_follower_id::text || ':' || p_subject_id::text, 0));
    IF NOT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = p_follower_id AND followed_id = p_subject_id) THEN
        RETURN false;
    END IF;
    FOR item IN UPDATE public.social_consent_requests SET status = 'removed', decided_at = now()
        WHERE requester_id = p_follower_id AND subject_id = p_subject_id AND status IN ('pending', 'accepted')
        RETURNING id
    LOOP
        INSERT INTO public.audit_logs(actor_id, action, subject, detail)
            VALUES (p_subject_id, 'social.connection_revoked', p_subject_id::text,
                jsonb_build_object('request_id', item.id, 'requester_id', p_follower_id,
                    'subject_id', p_subject_id, 'tier', 'teen', 'reason', 'removed_by_subject', 'origin', 'database-function'));
    END LOOP;
    FOR item IN UPDATE public.social_connection_requests SET status = 'revoked'
        WHERE requester_id = p_follower_id AND kid_user_id = p_subject_id AND status IN ('pending', 'approved')
        RETURNING id
    LOOP
        INSERT INTO public.audit_logs(actor_id, action, subject, detail)
            VALUES (p_subject_id, 'social.connection_revoked', p_subject_id::text,
                jsonb_build_object('request_id', item.id, 'requester_id', p_follower_id,
                    'kid_user_id', p_subject_id, 'reason', 'removed_by_subject', 'origin', 'database-function'));
    END LOOP;
    DELETE FROM public.follows WHERE follower_id = p_follower_id AND followed_id = p_subject_id;
    INSERT INTO public.audit_logs(actor_id, action, subject, detail)
        VALUES (p_subject_id, 'social.follower_removed', p_subject_id::text,
            jsonb_build_object('follower_id', p_follower_id, 'followed_id', p_subject_id, 'origin', 'database-function'));
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_social_follower(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_social_follower(uuid, uuid) TO service_role;

-- E.13 write guard: a minor's username or display name cannot be set to a
-- value the classifier flags, whoever writes it (browser, Core, service).
-- Values that were already there are not refused on unrelated edits; the
-- review record keeps them flagged and every outside surface hides them.
CREATE OR REPLACE FUNCTION public.guard_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NOT public.profile_review_in_scope(NEW.user_id) THEN RETURN NEW; END IF;
    IF (TG_OP = 'INSERT' OR NEW.username IS DISTINCT FROM OLD.username)
       AND cardinality(public.profile_field_flags(NEW.username)) > 0 THEN
        RAISE EXCEPTION 'PROFILE_FIELD_UNSAFE' USING ERRCODE = 'P0001', DETAIL = 'username';
    END IF;
    IF (TG_OP = 'INSERT' OR NEW.display_name IS DISTINCT FROM OLD.display_name)
       AND cardinality(public.profile_field_flags(NEW.display_name)) > 0 THEN
        RAISE EXCEPTION 'PROFILE_FIELD_UNSAFE' USING ERRCODE = 'P0001', DETAIL = 'display_name';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_fields() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER profile_fields_guard
BEFORE INSERT OR UPDATE OF username, display_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_fields();
