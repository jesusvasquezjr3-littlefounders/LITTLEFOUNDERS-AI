-- @phase: expand
-- E.1/E.2: pending requests confer no graph edge or profile visibility.
CREATE TABLE IF NOT EXISTS public.social_connection_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kid_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'revoked')),
    requested_at timestamptz NOT NULL DEFAULT now(),
    decided_at timestamptz,
    decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT social_request_not_self CHECK (requester_id <> kid_user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS social_request_one_pending
    ON public.social_connection_requests(requester_id, kid_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS social_request_family_queue
    ON public.social_connection_requests(kid_user_id, requested_at, id) WHERE status = 'pending';
ALTER TABLE public.social_connection_requests ENABLE ROW LEVEL SECURITY;
-- No browser policies. Even Core writes must use a reviewed transaction function.
REVOKE ALL ON public.social_connection_requests FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.social_connection_requests TO service_role;

CREATE OR REPLACE FUNCTION public.request_social_connection(p_requester_id uuid, p_kid_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE request_id uuid;
BEGIN
    IF p_requester_id IS NULL OR p_kid_user_id IS NULL OR p_requester_id = p_kid_user_id THEN
        RAISE EXCEPTION 'INVALID_SOCIAL_REQUEST' USING ERRCODE = 'P0001';
    END IF;
    -- The same pair lock must be acquired by future decisions and revocations.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'social-request:' || p_requester_id::text || ':' || p_kid_user_id::text, 0));
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_requester_id)
       OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_kid_user_id AND role = 'kid')
       OR NOT EXISTS (SELECT 1 FROM public.guardian_links WHERE kid_user_id = p_kid_user_id AND verification_status = 'verified') THEN
        RAISE EXCEPTION 'SOCIAL_REQUEST_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.blocks WHERE
        (blocker_id = p_requester_id AND blocked_id = p_kid_user_id)
        OR (blocker_id = p_kid_user_id AND blocked_id = p_requester_id)) THEN
        RAISE EXCEPTION 'SOCIAL_REQUEST_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    SELECT id INTO request_id FROM public.social_connection_requests
        WHERE requester_id = p_requester_id AND kid_user_id = p_kid_user_id AND status = 'pending';
    IF request_id IS NOT NULL THEN RETURN request_id; END IF;
    INSERT INTO public.social_connection_requests(requester_id, kid_user_id)
        VALUES (p_requester_id, p_kid_user_id) RETURNING id INTO request_id;
    INSERT INTO public.audit_logs(actor_id, action, subject, detail)
        VALUES (p_requester_id, 'social.connection_requested', p_kid_user_id::text,
            jsonb_build_object('request_id', request_id, 'requester_id', p_requester_id,
                'kid_user_id', p_kid_user_id, 'origin', 'database-function'));
    RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.request_social_connection(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_social_connection(uuid, uuid) TO service_role;
