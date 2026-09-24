-- @phase: expand
-- E.1 interim containment. Historical follows are not guardian approvals.
-- A later approval workflow must replace admission explicitly; do not infer consent.
CREATE OR REPLACE FUNCTION public.social_subject_visible(p_subject uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT auth.uid() IS NOT NULL AND (
        auth.uid() = p_subject OR (
            EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_subject)
            AND (
                NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_subject AND role = 'kid')
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

-- Restrictive policies intersect existing party-only policies; they never expand access.
DROP POLICY IF EXISTS follows_private_subjects ON public.follows;
CREATE POLICY follows_private_subjects ON public.follows AS RESTRICTIVE
FOR SELECT TO authenticated USING (
    public.social_subject_visible(follower_id) AND public.social_subject_visible(followed_id)
);

CREATE OR REPLACE FUNCTION public.guard_social_follow_admission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.followed_id) THEN
        RAISE EXCEPTION 'SOCIAL_ROLE_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.followed_id AND role = 'kid') THEN
        RAISE EXCEPTION 'GUARDIAN_APPROVAL_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_social_follow_admission() FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE TRIGGER social_follow_admission
BEFORE INSERT OR UPDATE OF followed_id, follower_id ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.guard_social_follow_admission();
