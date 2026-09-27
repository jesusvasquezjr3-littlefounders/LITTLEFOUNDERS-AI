import { Button, useRebuildEnvironment } from '../../design/controls';
import { flagResultFrom, MentorQualityDashboard, reviewResultFrom, type MentorQualityCopy } from '../MentorQualityDashboard';
import type { MentorQualityDashboardData, OwnerRole } from '../mentorQualityApi';
import { useStaffRead, type StaffApi } from './staffConsoleApi';
import { LoadFailure, StaffPage } from './ConsoleParts';
import { useConsoleCopy } from './staffConsoleCopy';

/*
 * C.24 on a real route (W2T.2): the Mentor-quality dashboard the
 * product/pedagogy team watches (Appendix E §3.1 Tier 3), with C.21's anomaly
 * flags. Core serves it behind `view_analytics` and allows a flag action or a
 * weekly sign-off only to the NAMED owner of that role; the dashboard shows
 * those actions only to a named owner, as a courtesy, never as the control.
 *
 * The page title is the navigation label; the dashboard's own status panel
 * keeps its heading as "Data status" so the page has one h1. A read Core
 * refuses (the grant withdrawn) or cannot answer uses the console's failure
 * state with a retry, instead of the panel's bare banner.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isMentorQuality = (value: unknown): value is MentorQualityDashboardData => isRecord(value)
  && isRecord(value.freshness) && Array.isArray(value.signals) && isRecord(value.flags) && Array.isArray(value.flags.active)
  && Array.isArray(value.owners) && Array.isArray(value.viewerOwnerRoles) && isRecord(value.reviews)
  && Array.isArray(value.reviews.missingRoles) && Array.isArray(value.reviews.thisWeek);

export function StaffMentorQuality({ api }: { api: StaffApi }) {
  const { copy, sections, locale, quality } = useConsoleCopy();
  const { theme } = useRebuildEnvironment();
  const read = useStaffRead(api, '/admin/mentor-quality', isMentorQuality);
  const panelCopy: MentorQualityCopy = { ...quality, title: copy.mentorQuality.heading.status } as MentorQualityCopy;
  // Each item says what happened at once and keeps its place (a reload would drop a resolved flag, and focus with it); Refresh re-reads.
  const act = async (path: string, body: unknown) => {
    const result = await api.post(path, body);
    return result.ok ? null : { code: result.code };
  };
  return <StaffPage screen="staff-mentor-quality" title={sections.mentorQuality} intro={copy.mentorQuality.body.intro}
    actions={<Button size="sm" onClick={read.reload}>{copy.common.action.refresh}</Button>}>
    {read.load.state === 'error' ? <LoadFailure code={read.load.code} onRetry={read.reload} />
      : <MentorQualityDashboard copy={panelCopy} locale={locale} dark={theme === 'dark'}
        phase={read.load.state === 'ready' ? 'ready' : 'loading'} data={read.load.state === 'ready' ? read.load.data : null}
        onAcknowledge={async (id) => flagResultFrom(await act(`/admin/mentor-quality/flags/${encodeURIComponent(id)}/acknowledge`, {}))}
        onResolve={async (id, note) => flagResultFrom(await act(`/admin/mentor-quality/flags/${encodeURIComponent(id)}/resolve`, { note: note.trim() }))}
        onReview={async (role: OwnerRole) => reviewResultFrom(await act('/admin/mentor-quality/reviews', { role }))} />}
  </StaffPage>;
}
