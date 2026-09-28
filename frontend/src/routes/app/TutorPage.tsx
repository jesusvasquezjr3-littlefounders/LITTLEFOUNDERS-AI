import { Component, useCallback, useEffect, useMemo, useRef, type ErrorInfo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { trackInsight } from '@/lib/insights';
import { APP_HOME } from '@/app-shell/home';
import { ShellRoot, useShellLocale } from '@/app-shell/ShellRoot';
import { StandaloneState } from '@/app-shell/StandaloneState';
import { useWalletAccess } from '@/routes/app/wallet/useWalletAccess';
import { guidedReviewSkillFrom } from '@/routes/app/learn/paths';
import { ButtonLink } from '@/rebuild/design/controls';
import { MentorRoute, mentorCopy } from '@/rebuild/mentor/screen/MentorRoute';

/*
 * `/tutor`: the Mentor screen (Frontend Bible 08, W2M.2). The legacy chat-era
 * experience is no longer mounted here (OD-15); this route supplies only what
 * the application knows and the rebuilt screen must not reach for itself:
 *
 *   - the signed-in account and its token (Core is the only data source; the
 *     Oracle socket URL still comes from Core's session start);
 *   - the language and mode the learner chose;
 *   - whether a guardian link exists (a child in a family, Core's
 *     `/wallet/access` answer): only then does the menu say what the grown-up
 *     sees (08 §4); a teen without a parent and an adult never see that line;
 *   - the guided review a lesson offered (`?review=<skill>`), validated here;
 *   - navigation: close goes back to the learner's home, the closing state's
 *     one action goes back to the learning path.
 *
 * `three` is still reached only through this lazy route (the stage bridge
 * `rebuild/mentor/MentorStage.tsx`), and `tutor_open` is still recorded once
 * per visit for the acquisition funnel (H.3), consent-gated like every event.
 */

class MentorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    // A real failure worth seeing in the browser; the event vocabulary is closed, so no new event is invented for it.
    console.error('[mentor] failed to render', error, info.componentStack);
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function MentorFailure() {
  const copy = mentorCopy(useShellLocale()).mentorScreen;
  return <StandaloneState pageTitle={copy.documentTitle} hue="sky"
    actions={<ButtonLink href={APP_HOME} variant="accent">{copy.close}</ButtonLink>}>
    <h1 data-copy-role="heading">{copy.documentTitle}</h1>
    <p data-copy-role="body">{copy.unavailable}</p>
  </StandaloneState>;
}

export default function TutorPage() {
  const { getToken, session } = useAuth();
  const { isDark } = useTheme();
  const locale = useShellLocale();
  const wallet = useWalletAccess();
  const navigate = useNavigate();
  const reviewSkill = useMemo(() => guidedReviewSkillFrom(window.location.search), []);
  // Bible 08 §8 (GAP-FIX-R1): /tutor?sheet=chooser (the profile's "Change") opens with the Mentor chooser.
  const initialSheet = useMemo(() => new URLSearchParams(window.location.search).get('sheet') === 'chooser' ? 'chooser' as const : null, []);
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    trackInsight('tutor_open', { routeClass: 'tutor' });
  }, []);
  const leave = useCallback(() => navigate(APP_HOME), [navigate]);
  const path = useCallback(() => navigate('/learn'), [navigate]);
  return <MentorBoundary fallback={<MentorFailure />}>
    <ShellRoot>
      <MentorRoute getToken={getToken} userId={session?.user?.id ?? null} locale={locale} theme={isDark ? 'dark' : 'light'}
        guardianLink={wallet.familyChild} reviewSkill={reviewSkill} onLeave={leave} onPath={path} initialSheet={initialSheet} />
    </ShellRoot>
  </MentorBoundary>;
}
