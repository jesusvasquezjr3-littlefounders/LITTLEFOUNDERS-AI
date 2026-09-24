-- @phase: expand
-- E.1: only a current approved relationship with a live edge grants outsider visibility.
CREATE OR REPLACE FUNCTION public.has_current_social_approval(p_viewer uuid, p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT p_viewer IS NOT NULL AND p_subject IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.social_connection_requests request
        WHERE request.requester_id = p_viewer AND request.kid_user_id = p_subject
          AND request.status = 'approved'
          AND public.social_guardian_is_current(request.decided_by, p_subject)
          AND EXISTS (SELECT 1 FROM public.follows
              WHERE follower_id = p_viewer AND followed_id = p_subject)
      )
      AND NOT EXISTS (SELECT 1 FROM public.blocks
          WHERE (blocker_id = p_viewer AND blocked_id = p_subject)
             OR (blocker_id = p_subject AND blocked_id = p_viewer));
$$;
-- Core uses its authenticated viewer identity; browsers cannot query arbitrary pairs.
REVOKE ALL ON FUNCTION public.has_current_social_approval(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_current_social_approval(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.social_subject_visible(p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT auth.uid() IS NOT NULL AND (
        auth.uid() = p_subject OR (
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_subject)
            AND (
                NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_subject AND role = 'kid')
                OR public.has_current_social_approval(auth.uid(), p_subject)
                OR EXISTS (
                    SELECT 1 FROM public.guardian_links subject_link
                    WHERE subject_link.kid_user_id = p_subject
                      AND subject_link.verification_status = 'verified'
                      AND (
                          subject_link.parent_user_id = auth.uid()
                          OR EXISTS (
                              SELECT 1 FROM public.guardian_links viewer_link
                              WHERE viewer_link.kid_user_id = auth.uid()
                                AND viewer_link.verification_status = 'verified'
                                AND viewer_link.parent_user_id = subject_link.parent_user_id
                          )
                      )
                )
            )
        )
    );
$$;
REVOKE ALL ON FUNCTION public.social_subject_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_subject_visible(uuid) TO authenticated;
