-- 0035_dataintel_anonymous_conversion_sync.sql
--
-- Provides Data Intel with the minimal, first-party attribution link needed
-- to calculate an accurate adult acquisition funnel. The source table is
-- intentionally restricted to already-approved adult conversions: children
-- never receive an anonymous-to-account link (0024) and therefore cannot be
-- joined across pre-consent browsing and an account in DuckDB.

CREATE OR REPLACE VIEW public.dataintel_anon_conversions_sync AS
SELECT
  av.anon_id,
  av.converted_user_id AS user_id,
  av.converted_at
FROM public.anon_visitors av
WHERE av.converted_user_id IS NOT NULL
  AND av.converted_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = av.converted_user_id
      AND ur.role IN ('universal', 'parent', 'bigfounder', 'admin', 'superadmin')
  );

REVOKE ALL ON public.dataintel_anon_conversions_sync FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dataintel_anon_conversions_sync TO service_role;

COMMENT ON VIEW public.dataintel_anon_conversions_sync IS
  'Service-only adult first-party anonymous-to-account links for acquisition aggregation; never includes kid accounts.';
