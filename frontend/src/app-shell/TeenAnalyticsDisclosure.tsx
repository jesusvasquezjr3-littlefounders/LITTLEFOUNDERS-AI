import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { Sheet } from '@/rebuild/design/controls';
import { AnalyticsChoice } from '@/rebuild/privacy/AnalyticsChoice';
import { analyticsChoiceCopy } from '@/routes/app/profile/TeenAnalyticsSetting';
import { useTeenAnalyticsPreference } from './useTeenAnalyticsPreference';
import { useShellLocale } from './ShellRoot';

/*
 * H.1 and Appendix O 2.2(a) (F3-identity-site): the self-managed disclosure is
 * presented to every self-registered teen, not left in a Settings card a teen
 * may never open. On the first app session with no choice on file, this sheet
 * shows the whole disclosure (purpose, events, exclusions, safety) and two
 * equal answers: "Keep it off" and "Turn it on". Either one writes the
 * version-1 row (Core's PUT /auth/analytics-preference), so "off" is recorded
 * without passing through "on". "Decide later" closes it for this browser
 * session only; it comes back next session until a choice is on file.
 *
 * Who sees it is Core's answer (`canManage && !disclosed`): never a kid-role
 * account, a guest, an under-13 origin or an adult. A kid-role or guest
 * session is not even asked. An unreadable answer shows nothing (never a
 * guess); the next session asks again.
 */
const laterKey = (userId: string) => `lf.analytics-disclosure.later.${userId}`;

function readLater(userId: string): boolean {
  try { return window.sessionStorage.getItem(laterKey(userId)) === '1'; } catch { return false; }
}

export function TeenAnalyticsDisclosure() {
  const { session, isGuest, roles, meLoaded } = useAuth();
  const eligible = !!session && !isGuest && meLoaded && roles.length > 0 && !roles.includes('kid');
  return eligible ? <Disclosure key={session!.user.id} userId={session!.user.id} /> : null;
}

function Disclosure({ userId }: { userId: string }) {
  const locale = useShellLocale();
  const { isDark } = useTheme();
  const { preference, loading, saving, error, choose, retry } = useTeenAnalyticsPreference();
  const [later, setLater] = useState(() => readLater(userId));
  const [recorded, setRecorded] = useState(false);
  const open = !later && !recorded && !loading && error !== 'read' && preference?.canManage === true && !preference.disclosed;
  const copy = analyticsChoiceCopy(locale);
  const decideLater = () => {
    try { window.sessionStorage.setItem(laterKey(userId), '1'); } catch { /* storage blocked: closes for this page only */ }
    setLater(true);
  };
  return <Sheet open={open} onClose={decideLater} heading={copy.title} closeLabel={copy.later}>
    <AnalyticsChoice copy={copy} locale={locale} dark={isDark} enabled={false} experiment={preference?.dialogueExperiment === true}
      loading={false} saving={saving} error={error === 'write' ? 'write' : null} decided={false} headingless
      onChoose={(enabled) => { void choose(enabled).then((ok) => { if (ok) setRecorded(true); }); }}
      onToggle={() => undefined} onRetry={retry} />
  </Sheet>;
}
