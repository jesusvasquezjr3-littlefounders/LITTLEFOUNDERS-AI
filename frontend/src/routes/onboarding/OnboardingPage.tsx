import { ConnectedStandaloneHeader } from '@/app-shell/StandaloneHeader';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { APP_HOME } from '@/app-shell/home';
import { ShellRoot, useShellCopy, useShellLocale } from '@/app-shell/ShellRoot';
import { api } from '@/lib/api';
import type { MentorCharacter } from '@/rebuild/design/controls';
import { OnboardingFlow, type AccountChoice, type OnboardingValues } from '@/rebuild/identity/OnboardingFlow';

/*
 * `/onboarding` (O1): a guest's one-time first run, rebuilt (W2S.2) without the
 * legacy guided-voice stage. RequireAuth mounts it (a guest already has a
 * session) after the mandatory age question (A.3, A.4), and RequireOnboarded
 * sends an unfinished guest here from any app screen.
 *
 * Core contracts, unchanged: POST /onboarding/complete with exactly
 * { displayName, discoveryChannel?, accountOfferChoice, localDate } (Core's
 * body is strict: no date of birth, S01.3), which grants day one of the streak;
 * "Create account" continues to /upgrade-account, "Later" to Learn.
 *
 * The Mentor choice (OD-6, 08 §8) is saved with PUT /tutor/preferences
 * { character }, the preference the Mentor screen and the learner's Mentor tab
 * already read. It is optional: skipping leaves the choice to the Mentor screen.
 *
 * Fixed while here: `localDate` is the learner's own calendar date (the legacy
 * page sent the UTC date, a day off in the evening across the Americas); a
 * retry after Core already recorded completion (409) counts as done.
 */
function localCalendarDate(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function OnboardingPage() {
  const locale = useShellLocale();
  const skip = useShellCopy().appShell.skip;
  const navigate = useNavigate();
  const { getToken, refreshMe, onboardingComplete, discoverySurvey } = useAuth();
  const [chosen, setChosen] = useState<MentorCharacter | null>(null);
  const [saving, setSaving] = useState<MentorCharacter | null>(null);
  const [mentorFailed, setMentorFailed] = useState(false);
  const [completing, setCompleting] = useState<AccountChoice | null>(null);
  const [failed, setFailed] = useState(false);

  // `completing` stays set through the success path: refreshMe() flips onboardingComplete before complete()'s own
  // navigate runs, and without this guard the redirect below would win and skip /upgrade-account.
  if (onboardingComplete && !completing) return <Navigate to={APP_HOME} replace />;

  async function choose(character: MentorCharacter) {
    setSaving(character);
    setMentorFailed(false);
    const token = await getToken();
    const { error } = await api('/tutor/preferences', { method: 'PUT', token, body: { character } });
    setSaving(null);
    if (error) { setMentorFailed(true); return; }
    setChosen(character);
  }

  async function complete({ displayName, discoveryChannel, choice }: OnboardingValues) {
    setCompleting(choice);
    setFailed(false);
    const token = await getToken();
    const { error } = await api<{ streakDays: number }>('/onboarding/complete', {
      token,
      body: { displayName, discoveryChannel: discoveryChannel ?? undefined, accountOfferChoice: choice, localDate: localCalendarDate() },
    });
    if (error && error.code !== 'ONBOARDING_ALREADY_COMPLETE') {
      setCompleting(null);
      setFailed(true);
      return;
    }
    await refreshMe();
    navigate(choice === 'created_now' ? '/upgrade-account' : APP_HOME, { replace: true });
  }

  return <ShellRoot>
    <OnboardingFlow header={<ConnectedStandaloneHeader />} locale={locale} skipLabel={skip} completing={completing} failed={failed} askDiscovery={discoverySurvey === true}
      mentor={{ chosen, saving, failed: mentorFailed, onChoose: (character) => void choose(character) }}
      onComplete={(values) => void complete(values)} />
  </ShellRoot>;
}
