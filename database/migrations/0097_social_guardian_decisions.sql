-- @phase: expand
-- E.1/E.2: decision, approved edge and decision audit share one transaction.
CREATE OR REPLACE FUNCTION public.social_guardian_is_current(p_guardian uuid, p_kid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (SELECT 1 FROM public.guardian_links WHERE parent_user_id = p_guardian
        AND kid_user_id = p_kid AND verification_status = 'verified')
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_guardian AND role = 'parent')
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_guardian AND role = 'kid')
    AND EXISTS (SELECT 1 FROM (
        SELECT status, method, birth_date FROM public.parent_verifications WHERE user_id = p_guardian
        ORDER BY created_at DESC, id DESC LIMIT 1
    ) latest WHERE status = 'verified' AND method = 'local-ocr'
        AND birth_date <= ((now() AT TIME ZONE 'UTC')::date - interval '18 years')::date);
$$;
REVOKE ALL ON FUNCTION public.social_guardian_is_current(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.social_guardian_is_current(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_social_follow_admission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.followed_id) THEN
        RAISE EXCEPTION 'SOCIAL_ROLE_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.blocks WHERE
        (blocker_id = NEW.follower_id AND blocked_id = NEW.followed_id)
        OR (blocker_id = NEW.followed_id AND blocked_id = NEW.follower_id)) THEN
        RAISE EXCEPTION 'SOCIAL_CONNECTION_BLOCKED' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.followed_id AND role = 'kid')
       AND (current_setting('role', true) IS DISTINCT FROM 'service_role' OR NOT EXISTS (SELECT 1 FROM public.social_connection_requests request
            WHERE requester_id = NEW.follower_id AND kid_user_id = NEW.followed_id
              AND status = 'approved'
              AND public.social_guardian_is_current(request.decided_by, request.kid_user_id))) THEN
        RAISE EXCEPTION 'GUARDIAN_APPROVAL_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_social_follow_admission() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.decide_social_connection(p_request_id uuid, p_guardian_id uuid, p_approve boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request public.social_connection_requests%ROWTYPE; decision text;
BEGIN
    IF p_request_id IS NULL OR p_guardian_id IS NULL OR p_approve IS NULL THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_DECISION' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO request FROM public.social_connection_requests WHERE id = p_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'SOCIAL_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    -- Lock the guardian evidence before deciding; revocation cannot acknowledge mid-decision.
    PERFORM id FROM auth.users WHERE id = p_guardian_id FOR UPDATE;
    PERFORM user_id FROM public.user_roles WHERE user_id = p_guardian_id FOR SHARE;
    PERFORM user_id FROM public.parent_verifications WHERE user_id = p_guardian_id FOR SHARE;
    PERFORM parent_user_id FROM public.guardian_links WHERE parent_user_id = p_guardian_id
        AND kid_user_id = request.kid_user_id FOR SHARE;
    IF NOT public.social_guardian_is_current(p_guardian_id, request.kid_user_id) THEN
        RAISE EXCEPTION 'GUARDIAN_DECISION_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'social-request:' || request.requester_id::text || ':' || request.kid_user_id::text, 0));
    SELECT * INTO request FROM public.social_connection_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'SOCIAL_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    decision := CASE WHEN p_approve THEN 'approved' ELSE 'denied' END;
    IF request.status = decision THEN RETURN decision; END IF;
    IF request.status <> 'pending' THEN
        RAISE EXCEPTION 'SOCIAL_DECISION_CONFLICT' USING ERRCODE = 'P0001';
    END IF;
    IF p_approve AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = request.kid_user_id AND role = 'kid') THEN
        RAISE EXCEPTION 'SOCIAL_REQUEST_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    IF p_approve AND EXISTS (SELECT 1 FROM public.blocks WHERE
        (blocker_id = request.requester_id AND blocked_id = request.kid_user_id)
        OR (blocker_id = request.kid_user_id AND blocked_id = request.requester_id)) THEN
        RAISE EXCEPTION 'SOCIAL_CONNECTION_BLOCKED' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.social_connection_requests SET status = decision, decided_at = now(), decided_by = p_guardian_id
        WHERE id = p_request_id;
    IF p_approve THEN
        INSERT INTO public.follows(follower_id, followed_id) VALUES (request.requester_id, request.kid_user_id)
            ON CONFLICT DO NOTHING;
    END IF;
    INSERT INTO public.audit_logs(actor_id, action, subject, detail)
        VALUES (p_guardian_id, 'social.connection_' || decision, request.kid_user_id::text,
            jsonb_build_object('request_id', p_request_id, 'requester_id', request.requester_id,
                'kid_user_id', request.kid_user_id, 'origin', 'database-function'));
    RETURN decision;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_social_connection(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_social_connection(uuid, uuid, boolean) TO service_role;
