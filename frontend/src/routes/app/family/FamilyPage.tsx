import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { FamilyConsole } from '@/rebuild/family/console/FamilyConsole';
import { childName, type Child } from '@/rebuild/family/console/consoleApi';
import { AutonomyLadderPanel } from './AutonomyLadderPanel';
import { BadgeSharesPanel } from './BadgeSharesPanel';
import { CoGuardiansPanel, GuardianRequestsPanel } from './CoGuardiansPanel';
import { CoopGoalsConsentPanel } from '@/app-routes/CoopGoalsConsentPanel';
import { CoachingTipPanel, DataPolicyPanel, ResearchConsentPanel, ScopeStatementPanel } from './GovernancePanels';
import { DataPracticeConsentPanel } from './DataPracticePanels';
import { GuardianInviteJoin, GuardianInvitePanel } from './GuardianInvitePanel';
import { LearningBridgesPanel, LearningDecisionsPanel, LearningNarrativePanel, StreakPausePanel } from './LearningPanels';
import { ShareDestinationsPanel } from './ShareDestinationsPanel';
import { SocialGraphPanel } from './SocialGraphPanel';
import { SocialHistoryPanel } from './SocialHistoryPanel';
import { SocialNoticesPanel } from './SocialNoticesPanel';
import { SocialRequestsPanel } from './SocialRequestsPanel';
import { StreakPausesPanel } from './StreakPausesPanel';
import { TeenDeletionNoticesPanel } from '@/app-routes/TeenDeletionNoticesPanel';
import { WalletCorrectionsPanel } from './WalletCorrectionsPanel';
import { useConsoleEnvironment, useConsoleTransport } from './consoleSession';

/*
 * /family: F1, the verified Tutor's Family console (W2F.1). The route is
 * parent-gated (app-routes/family.tsx) and Core re-checks the verified
 * guardian link on every request; this adapter only binds the rebuilt
 * console to the session, the language, the mode and the router, and hands
 * it the wave-1 surfaces (S05, S07, S08 data planes, unchanged) for the
 * child in view.
 *
 * `?child=` names the child in view, so a way back from a child's progress
 * or Mentor talks returns to them; `?join=` carries a second Tutor's invite.
 */
export function FamilyPage() {
  const { getToken } = useAuth();
  const transport = useConsoleTransport();
  const { locale, dark, family, copy } = useConsoleEnvironment();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const join = params.get('join');
  const selected = params.get('child');
  const [token, setToken] = useState<string | null>(null);
  // Losing access to a child (another Tutor's decision, stepping away) reloads the family list.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let live = true;
    void getToken().then((value) => { if (live) setToken(value); });
    return () => { live = false; };
  }, [getToken]);

  const select = useCallback((userId: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('child', userId);
      return next;
    }, { replace: true });
  }, [setParams]);

  const slots = (child: Child) => {
    const name = childName(child);
    const common = { kidUserId: child.userId, token };
    return {
      // S05.3c/e: B.10's narrative, OD-27 (3)'s story choices (under 13 only; Core decides), B.13's real-world prompts, B.21's holiday pause.
      learning: <>
        <LearningNarrativePanel {...common} />
        <LearningDecisionsPanel {...common} />
        <LearningBridgesPanel {...common} />
        <StreakPausePanel {...common} />
      </>,
      // S07.1/S07.3/S07.4/S07.5: coin corrections, the chore streak's pauses, the Share places, the independence ladder.
      money: <>
        <WalletCorrectionsPanel {...common} kidName={name} />
        <StreakPausesPanel {...common} kidName={name} />
        <ShareDestinationsPanel {...common} kidName={name} />
        <AutonomyLadderPanel {...common} kidName={name} />
      </>,
      // S08 (E.*): connection requests, who follows whom, the history, and the older share links (OD-20).
      connections: <>
        <SocialRequestsPanel {...common} />
        <SocialGraphPanel {...common} />
        <SocialHistoryPanel {...common} />
        <BadgeSharesPanel {...common} />
        {/* L-04 (OD-27 (1)): goals together for a child aged 13 to 17, off until the Tutor turns it on. */}
        <CoopGoalsConsentPanel {...common} kidName={name} />
      </>,
      // S07.7 (D.22): the Tutor's research answer for this child.
      // S10.3 (OD-9 4.2): a migrated child's specific consent to each practice the rebuild introduced (renders nothing otherwise).
      privacy: <>
        <ResearchConsentPanel {...common} kidName={name} />
        <DataPracticeConsentPanel {...common} kidName={name} />
      </>,
      // S04.1 / S07.1 (D.5, OD-21): invite a second Tutor; the Tutors of this child and stepping away.
      account: <>
        <GuardianInvitePanel {...common} />
        <CoGuardiansPanel {...common} kidName={name} onAccessLost={() => setGeneration((value) => value + 1)} />
      </>,
    };
  };

  return <FamilyConsole key={generation} copy={family.familyConsole} accountCopy={family.familyChildAccount} consentCopy={family.familyChildConsent}
    profileSafetyCopy={copy.profile.profileSafety} locale={locale} dark={dark} transport={transport} selectedId={selected} onSelect={select}
    onNavigate={(href) => navigate(href)} childSlots={slots}
    familyTop={join !== null ? <GuardianInviteJoin inviteToken={join} /> : undefined}
    familyAside={(hasChildren) => <>
      {/* S07.7 (D.23, D.20, D.21): this month's tip, what the practice covers, how long the family's data is kept. */}
      {hasChildren ? <CoachingTipPanel token={token} /> : null}
      {/* GAP-FIX-R2 (D-14 (b)): a linked teen asked to delete their own account (notify only; nothing shows otherwise). */}
      {hasChildren ? <TeenDeletionNoticesPanel token={token} /> : null}
      {hasChildren ? <SocialNoticesPanel token={token} /> : null}
      <GuardianRequestsPanel token={token} />
      <ScopeStatementPanel />
      <DataPolicyPanel token={token} />
    </>} />;
}

export default FamilyPage;
