-- @phase: contract
-- @after-release: none — coordinated unfollow replaces browser DELETE; operator review required.
-- E.1/E.2: withdrawing a connection also withdraws its reusable approval.
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
    DELETE FROM public.follows WHERE follower_id = p_follower_id AND followed_id = p_followed_id;
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_social_connection(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_social_connection(uuid, uuid) TO authenticated;
-- A raw DELETE cannot coordinate a pending, not-yet-visible approval transaction.
REVOKE DELETE ON public.follows FROM authenticated, anon, PUBLIC;
