import { lazy, Suspense, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api as coreApi, BASE_URL } from '@/lib/api';
import { isDeviceOptedOut, setDeviceOptOut } from '@/lib/analytics';
import { getSupabaseClient } from '@/lib/supabaseRealtime';
import type { Grader, LessonDocument } from '@/lesson-engine/core/types';
import type { AudioManifest } from '@/lesson-engine/player/narration';
import { staffViewer, type StaffApi, type StaffDownload, type StaffResult } from '@/rebuild/staff/console/staffConsoleApi';
import { StaffAnalytics, type DeviceOptOut } from '@/rebuild/staff/console/StaffAnalytics';
import { analyticsView } from '@/rebuild/staff/console/analyticsApi';
import { StaffIntel } from '@/rebuild/staff/console/StaffIntel';
import { intelView } from '@/rebuild/staff/console/intelApi';
import { contentView } from '@/rebuild/staff/console/contentApi';
import { StaffContent, type LessonPreviewRenderer } from '@/rebuild/staff/console/StaffContent';
import { StaffGeneration } from '@/rebuild/staff/console/StaffGeneration';
import { generationView } from '@/rebuild/staff/console/generationApi';
import { StaffMentorQuality } from '@/rebuild/staff/console/StaffMentorQuality';
import { createLiveFeed } from './staffLiveFeed';
import { StaffOverview } from '@/rebuild/staff/console/StaffOverview';
import { StaffUsers } from '@/rebuild/staff/console/StaffUsers';
import { StaffAccess } from '@/rebuild/staff/console/StaffAccess';
import { StaffAudit } from '@/rebuild/staff/console/StaffAudit';
import { reportsView, StaffReports } from '@/rebuild/staff/console/StaffReports';
import { StaffEmails } from '@/rebuild/staff/console/StaffEmails';

/*
 * Lane 6 (staff): the route hosts of the rebuilt staff console (W2T.1). The
 * rebuilt screens import nothing outside src/rebuild and src/i18n (02 rule 23),
 * so this bridge hands them Core, under the staff member's own session, and
 * the grants the auth context holds. Each host renders inside the route guard
 * of ./staff.tsx and the staff shell, so a screen only mounts for someone the
 * guard admitted; Core still checks the same grant on every read and write.
 */

async function call<T>(getToken: () => Promise<string | null>, path: string, body?: unknown, method?: 'DELETE'): Promise<StaffResult<T>> {
  try {
    const token = await getToken();
    const result = await coreApi<T>(path, method ? { method, token } : body === undefined ? { token } : { method: 'POST', body, token });
    if (!result.error) return { ok: true, data: result.data };
    // lib/api reports a failed fetch as INTERNAL; a browser that says it is offline gets the offline state instead.
    const code = typeof navigator !== 'undefined' && navigator.onLine === false ? 'OFFLINE' : result.error.code;
    // A refusal that itemizes its reasons (C.6's PACK_CONTRACT_FAILED) keeps them.
    const failures = (result.error as { failures?: unknown }).failures;
    return Array.isArray(failures) ? { ok: false, code, failures: failures.filter((entry): entry is string => typeof entry === 'string') } : { ok: false, code };
  } catch {
    return { ok: false, code: 'INTERNAL' };
  }
}

/**
 * W2T.3: a file Core renders (the analytics reports, the intel and raw-event
 * exports). These routes answer bytes on success and the usual envelope on
 * failure, and need the Bearer header, which a plain link cannot carry. The
 * X-LF-Export-* headers (truncation and paging of the raw export) are the
 * ones Core's CORS exposes; they are passed on in lower case, without the prefix.
 */
async function download(getToken: () => Promise<string | null>, path: string): Promise<StaffResult<StaffDownload>> {
  try {
    const token = await getToken();
    const response = await fetch(`${BASE_URL}/api/v1${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { code?: unknown } } | null;
      return { ok: false, code: typeof body?.error?.code === 'string' ? body.error.code : 'INTERNAL' };
    }
    const headers: Record<string, string> = {};
    // Keyed without Core's prefix: truncated, next-offset, rows, token.
    const prefix = 'x-lf-export-';
    response.headers.forEach((value, name) => { if (name.toLowerCase().startsWith(prefix)) headers[name.toLowerCase().slice(prefix.length)] = value; });
    return { ok: true, data: { blob: await response.blob(), headers } };
  } catch {
    return { ok: false, code: typeof navigator !== 'undefined' && navigator.onLine === false ? 'OFFLINE' : 'INTERNAL' };
  }
}

export function useStaffConsole() {
  const { getToken, roles, adminPermissions } = useAuth();
  const navigate = useNavigate();
  const api = useMemo<StaffApi>(() => ({
    get: <T,>(path: string) => call<T>(getToken, path),
    post: <T,>(path: string, body: unknown) => call<T>(getToken, path, body),
    remove: <T,>(path: string) => call<T>(getToken, path, undefined, 'DELETE'),
    download: (path: string) => download(getToken, path),
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
  const [params] = useSearchParams();
  return <StaffReports api={useStaffConsole().api} initialView={reportsView(params.get('view'))} />;
}

export function StaffEmailsRoute() {
  return <StaffEmails api={useStaffConsole().api} />;
}

/*
 * W2T.2: Content, Generation and Mentor quality.
 *
 * The lesson review's preview is the LEARNER'S OWN PLAYER, not a console
 * imitation of it: a reviewer approves what a child will see. Until Lane 2
 * rebuilds the lesson player, that is the Lesson Engine's LessonPlayer in its
 * preview mode (nothing graded, saved or tracked), loaded only when a
 * reviewer opens it. The rebuilt console never imports it (02 rule 23); this
 * host hands it in, and follows the learner route when the player is rebuilt.
 */
const LessonPlayer = lazy(() => import('@/lesson-engine/player/LessonPlayer'));
const PREVIEW_GRADER: Grader = { grade: async () => { throw new Error('Preview mode does not grade'); } };

export const renderLessonPreview: LessonPreviewRenderer = ({ lessonId, document, audio, labels, onExit }) => (
  <Suspense fallback={<p role="status" className="lf-staff-preview-loading">{labels.loading}</p>}>
    <LessonPlayer document={document as unknown as LessonDocument} lessonId={lessonId} audio={audio as unknown as AudioManifest}
      grader={PREVIEW_GRADER} preview previewStartLabel={labels.start} previewNextLabel={labels.next} onExit={onExit} />
  </Suspense>
);

export function StaffContentRoute() {
  const [params] = useSearchParams();
  return <StaffContent api={useStaffConsole().api} initialView={contentView(params.get('view'))} renderLessonPreview={renderLessonPreview} />;
}

export function StaffGenerationRoute() {
  const { getToken } = useAuth();
  const { api } = useStaffConsole();
  const [params] = useSearchParams();
  const liveFeed = useMemo(() => createLiveFeed(getSupabaseClient, getToken), [getToken]);
  return <StaffGeneration api={api} liveFeed={liveFeed} initialView={generationView(params.get('view'))} />;
}

export function StaffMentorQualityRoute() {
  const { api, viewer } = useStaffConsole();
  return <StaffMentorQuality api={api} viewer={viewer} />;
}

/*
 * W2T.3: Analytics & Health and Learning intel (with Insights). The device
 * opt-out is this browser's own flag (lib/analytics): it stops the trackers
 * here and affects nobody else, so the host hands the screen that one switch.
 */
const DEVICE_OPT_OUT: DeviceOptOut = { optedOut: isDeviceOptedOut, set: setDeviceOptOut };

export function StaffAnalyticsRoute() {
  const { api, viewer } = useStaffConsole();
  const [params] = useSearchParams();
  return <StaffAnalytics api={api} viewer={viewer} device={DEVICE_OPT_OUT} initialView={analyticsView(params.get('view'))} />;
}

export function StaffIntelRoute() {
  const { api, viewer } = useStaffConsole();
  const [params] = useSearchParams();
  return <StaffIntel api={api} viewer={viewer} initialView={intelView(params.get('view'), params.get('focus'))} />;
}
