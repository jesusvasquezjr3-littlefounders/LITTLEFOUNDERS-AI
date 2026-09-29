-- generation_live_manage_content — gap-fix round 4, F4-staff-ops item 4
-- (G.1: manage_content gates Content and Generation; Appendix N 2.1(2)
-- "enforced, not just displayed ... through the API directly", 2.2(b)-(c),
-- 1.1 Permission-Endpoint Enforcement Coverage and the 1.2 note on a second
-- read path; Block G: no staff permission label may be displayed unless it
-- actually restricts something).
-- @phase: expand
--
-- Core gates /admin/generation* behind requireAdminPermission('manage_content'),
-- but the rebuilt Generation screen also reads generation_runs_live directly
-- over Supabase Realtime, and that table's only client policy
-- (staff_select_live, generation_realtime) admitted ANY admin or superadmin
-- without reading public.admin_permissions. An admin with no grant, or with
-- only view_analytics or manage_support, could read live run progress, stage
-- breakdown, token counts and USD cost with their own session JWT through
-- PostgREST or a Realtime subscription.
--
-- The policy is recreated to admit a row only for a superadmin (who opens
-- every section) or for an admin who holds manage_content. Both subqueries
-- read the caller's OWN rows, which the self-read policies on user_roles and
-- admin_permissions already expose to the session, so a revoked grant hides
-- the table on the very next query. Core's service role is unaffected.
--
-- Proven on native PostgreSQL by database/scripts/verify-admin-permissions-postgres.py.

DROP POLICY IF EXISTS "staff_select_live" ON public.generation_runs_live;
CREATE POLICY "staff_select_live" ON public.generation_runs_live
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'superadmin')
    OR (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
      AND EXISTS (SELECT 1 FROM public.admin_permissions WHERE user_id = auth.uid() AND permission = 'manage_content')
    )
  );
