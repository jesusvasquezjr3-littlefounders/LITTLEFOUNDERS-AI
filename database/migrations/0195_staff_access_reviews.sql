-- staff_access_reviews — G.4 (a periodic review cadence for Admin/Superadmin
-- role holders and staff permissions) and Appendix N 1.1 (Access-Review
-- Cadence Compliance, target 100%; Stale-Grant Rate, trending to zero), both
-- computed from an access-review LOG.
-- @phase: expand
--
-- Before this migration the Roles & Access review card listed every family
-- role (parent, kid, bigfounder), never listed the four staff permissions,
-- aged a grant from granted_at only and had no way to record a completed
-- review, so a grant stayed "due" forever and neither metric existed.
--
-- 1. staff_access_reviews: one row per completed review of one elevated grant
--    (kind 'role' with grant_key admin|superadmin, or kind 'permission' with
--    one of the four staff permissions), the reviewer, when, the outcome
--    ('kept' | 'revoked') and an optional note. Staff-only: RLS on, no client
--    policy, service_role reads and inserts through the function below.
--    reviewed_by is kept as a plain id (no second account reference), like
--    audit_logs.actor_id, so the review log outlives a reviewer's account.
-- 2. record_staff_access_review(...): superadmin actor only; a 'kept' review
--    requires the grant to be held right now. Writes the review row and the
--    audit row 'admin.access.reviewed' in one transaction.
-- 3. staff_access_review_status(cadence_days): every elevated grant held
--    now, its granted_at, its last review, whether it is past the cadence
--    (age measured from max(granted_at, last reviewed_at)), and the two
--    Appendix N numbers. Family roles are never listed.
--
-- Proven on native PostgreSQL by database/scripts/verify-staff-ops-postgres.py.

CREATE TABLE IF NOT EXISTS public.staff_access_reviews (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    kind            text NOT NULL CHECK (kind IN ('role', 'permission')),
    grant_key       text NOT NULL CHECK (grant_key IN ('admin', 'superadmin', 'manage_users', 'manage_content', 'view_analytics', 'manage_support')),
    reviewed_by     uuid NOT NULL,
    reviewed_at     timestamptz NOT NULL DEFAULT now(),
    outcome         text NOT NULL CHECK (outcome IN ('kept', 'revoked')),
    note            text NULL CHECK (note IS NULL OR (char_length(note) BETWEEN 1 AND 300 AND note !~ '[<>]')),
    CONSTRAINT staff_access_reviews_kind_key CHECK (
        (kind = 'role' AND grant_key IN ('admin', 'superadmin'))
        OR (kind = 'permission' AND grant_key IN ('manage_users', 'manage_content', 'view_analytics', 'manage_support'))
    )
);

CREATE INDEX IF NOT EXISTS idx_staff_access_reviews_grant
    ON public.staff_access_reviews (subject_user_id, kind, grant_key, reviewed_at DESC);

ALTER TABLE public.staff_access_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_access_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.staff_access_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.record_staff_access_review(
    p_subject   uuid,
    p_kind      text,
    p_grant_key text,
    p_actor     uuid,
    p_outcome   text,
    p_note      text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_note text := nullif(btrim(coalesce(p_note, '')), '');
    v_held boolean;
BEGIN
    IF p_subject IS NULL OR p_actor IS NULL THEN
        RAISE EXCEPTION 'ACCESS_REVIEW_INVALID: subject and actor are required' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_actor AND role = 'superadmin') THEN
        RAISE EXCEPTION 'ACCESS_REVIEW_FORBIDDEN: only a superadmin records an access review' USING ERRCODE = '42501';
    END IF;
    IF p_outcome NOT IN ('kept', 'revoked') THEN
        RAISE EXCEPTION 'ACCESS_REVIEW_INVALID: unknown outcome' USING ERRCODE = '22023';
    END IF;

    IF p_kind = 'role' AND p_grant_key IN ('admin', 'superadmin') THEN
        v_held := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_subject AND role = p_grant_key);
    ELSIF p_kind = 'permission' AND p_grant_key IN ('manage_users', 'manage_content', 'view_analytics', 'manage_support') THEN
        v_held := EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = p_subject AND permission = p_grant_key);
    ELSE
        RAISE EXCEPTION 'ACCESS_REVIEW_INVALID: only elevated grants are reviewed' USING ERRCODE = '22023';
    END IF;
    IF p_outcome = 'kept' AND NOT v_held THEN
        RETURN 'not_held';
    END IF;

    INSERT INTO public.staff_access_reviews (subject_user_id, kind, grant_key, reviewed_by, outcome, note)
    VALUES (p_subject, p_kind, p_grant_key, p_actor, p_outcome, v_note);

    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'admin.access.reviewed', p_subject::text,
            jsonb_build_object('kind', p_kind, 'grant', p_grant_key, 'outcome', p_outcome, 'noted', v_note IS NOT NULL));

    RETURN 'recorded';
END;
$$;

REVOKE ALL ON FUNCTION public.record_staff_access_review(uuid, text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_staff_access_review(uuid, text, text, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.staff_access_review_status(p_cadence_days integer DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result jsonb;
BEGIN
    IF p_cadence_days IS NULL OR p_cadence_days < 1 OR p_cadence_days > 366 THEN
        RAISE EXCEPTION 'cadence must be 1-366 days' USING ERRCODE = '22023';
    END IF;
    WITH grants AS (
        SELECT r.user_id, 'role'::text AS kind, r.role AS grant_key, r.granted_at
        FROM public.user_roles r WHERE r.role IN ('admin', 'superadmin')
        UNION ALL
        SELECT p.user_id, 'permission', p.permission, p.granted_at
        FROM public.admin_permissions p
        WHERE p.permission IN ('manage_users', 'manage_content', 'view_analytics', 'manage_support')
    ), reviewed AS (
        SELECT g.*, (
            SELECT max(s.reviewed_at) FROM public.staff_access_reviews s
            WHERE s.subject_user_id = g.user_id AND s.kind = g.kind AND s.grant_key = g.grant_key
              AND s.outcome = 'kept' AND s.reviewed_at >= g.granted_at
        ) AS last_reviewed_at
        FROM grants g
    ), judged AS (
        SELECT reviewed.*, greatest(granted_at, coalesce(last_reviewed_at, granted_at)) < now() - make_interval(days => p_cadence_days) AS due
        FROM reviewed
    )
    SELECT jsonb_build_object(
        'cadenceDays', p_cadence_days,
        'total', count(*),
        'stale', count(*) FILTER (WHERE due),
        'reviewedEver', count(*) FILTER (WHERE last_reviewed_at IS NOT NULL),
        'grants', coalesce(jsonb_agg(jsonb_build_object(
            'userId', user_id, 'kind', kind, 'grant', grant_key, 'grantedAt', granted_at,
            'lastReviewedAt', last_reviewed_at, 'due', due) ORDER BY due DESC, greatest(granted_at, coalesce(last_reviewed_at, granted_at)) ASC), '[]'::jsonb)
    ) INTO v_result
    FROM judged;
    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_access_review_status(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_access_review_status(integer) TO service_role;

SELECT 'migration_staff_access_reviews_ok' AS sentinel;
