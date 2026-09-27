import { lazy, Suspense, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { api as coreApi } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabaseRealtime';
import type { Grader, LessonDocument } from '@/lesson-engine/core/types';
import type { AudioManifest } from '@/lesson-engine/player/narration';
import { staffViewer, type StaffApi, type StaffResult } from '@/rebuild/staff/console/staffConsoleApi';
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
    const code = typeof navigator !== 'undefined' && navigator.onLine === false ? 'OFFLINE' : result.error.code;
    // A refusal that itemizes its reasons (C.6's PACK_CONTRACT_FAILED) keeps them.
    const failures = (result.error as { failures?: unknown }).failures;
    return Array.isArray(failures) ? { ok: false, code, failures: failures.filter((entry): entry is string => typeof entry === 'string') } : { ok: false, code };
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
  return <StaffMentorQuality api={useStaffConsole().api} />;
}
