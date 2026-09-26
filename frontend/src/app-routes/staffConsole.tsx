import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api as coreApi } from '@/lib/api';
import { staffViewer, type StaffApi, type StaffResult } from '@/rebuild/staff/console/staffConsoleApi';
import { StaffOverview } from '@/rebuild/staff/console/StaffOverview';
import { StaffUsers } from '@/rebuild/staff/console/StaffUsers';
import { StaffAccess } from '@/rebuild/staff/console/StaffAccess';
import { StaffAudit } from '@/rebuild/staff/console/StaffAudit';
import { StaffReports } from '@/rebuild/staff/console/StaffReports';
import { StaffEmails } from '@/rebuild/staff/console/StaffEmails';

/*
 * Lane 6 (staff): the route hosts of the rebuilt staff console (W2T.1). The
 * rebuilt screens import nothing outside src/rebuild and src/i18n (02 rule 23),
 * so this bridge hands them Core, under the staff member's own session, and
 * the grants the auth context holds. Each host renders inside the route guard
 * of ./staff.tsx and the staff shell, so a screen only mounts for someone the
 * guard admitted; Core still checks the same grant on every read and write.
 */

async function call<T>(getToken: () => Promise<string | null>, path: string, body?: unknown): Promise<StaffResult<T>> {
  try {
    const token = await getToken();
    const result = await coreApi<T>(path, body === undefined ? { token } : { method: 'POST', body, token });
    if (!result.error) return { ok: true, data: result.data };
    // lib/api reports a failed fetch as INTERNAL; a browser that says it is offline gets the offline state instead.
    return { ok: false, code: typeof navigator !== 'undefined' && navigator.onLine === false ? 'OFFLINE' : result.error.code };
  } catch {
    return { ok: false, code: 'INTERNAL' };
  }
}

export function useStaffConsole() {
  const { getToken, roles, adminPermissions } = useAuth();
  const navigate = useNavigate();
  const api = useMemo<StaffApi>(() => ({
    get: <T,>(path: string) => call<T>(getToken, path),
    post: <T,>(path: string, body: unknown) => call<T>(getToken, path, body),
  }), [getToken]);
  const viewer = useMemo(() => staffViewer(roles, adminPermissions), [roles, adminPermissions]);
  return { api, viewer, onNavigate: navigate };
}

export function StaffOverviewRoute() {
  const { api, viewer, onNavigate } = useStaffConsole();
  return <StaffOverview api={api} viewer={viewer} onNavigate={(href) => onNavigate(href)} />;
}

export function StaffUsersRoute() {
  const { api, viewer } = useStaffConsole();
  return <StaffUsers api={api} viewer={viewer} />;
}

export function StaffRolesRoute() {
  return <StaffAccess api={useStaffConsole().api} />;
}

export function StaffAuditRoute() {
  return <StaffAudit api={useStaffConsole().api} />;
}

export function StaffReportsRoute() {
  return <StaffReports api={useStaffConsole().api} />;
}

export function StaffEmailsRoute() {
  return <StaffEmails api={useStaffConsole().api} />;
}
