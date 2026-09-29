import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { ChildCoins } from '@/rebuild/banking/coins/ChildCoins';
import { TutorCoins } from '@/rebuild/banking/coins/TutorCoins';
import { childName } from '@/rebuild/family/console/consoleApi';
import { useConsoleEnvironment, useConsoleTransport } from '../family/consoleSession';
import { LimitCoachingPanel, MoneyBridgePanel, MyResearchPanel, ScopeStatementPanel, tokenSession } from '../family/GovernancePanels';
import { MyDataPracticesPanel } from '../family/DataPracticePanels';
import { ShareDestinationsPanel } from '../family/ShareDestinationsPanel';
import { WalletCorrectionsPanel } from '../family/WalletCorrectionsPanel';
import { AllocationPanel } from '../tasks/AllocationPanel';
import { splitResultText } from '../family/moneyHabitsCopy';
import { DecisionQueuePanel } from '../tasks/DecisionQueuePanel';
import { SavingsGoalsPanel } from '../tasks/SavingsGoalsPanel';
import { UsualSplitPanel } from '../tasks/UsualSplitPanel';
import { WalletActivityPanel } from '../tasks/WalletActivityPanel';
import { useWalletAccess } from '../wallet/useWalletAccess';
import { CoinAccountPanel } from './CoinAccountPanel';
import { SavingsBonusPanel } from './SavingsBonusPanel';
import { SavingsBonusSettingsPanel } from './SavingsBonusSettingsPanel';
import { TutorFreezePanel } from './TutorFreezePanel';

/*
 * /banking: F5 (W2F.2), the Wallet (formerly "Digital Banking", OD-28), the practice coin card. One
 * route, two rebuilt screens by who is signed in: the verified parent (the
 * Tutor) gets F5-P, the coin cards of their children one at a time
 * (`?child=` names the child in view); a child in a family (a parent-created
 * child, or a self-registered teen who linked a verified parent, S07.2) gets
 * F5-K, their own card. The guard (RequireWalletAccess 'familyMoney') is UI
 * only; Core admits every request.
 *
 * This adapter binds the rebuilt screens to the session, language, mode and
 * router and hands them the wave-1 surfaces (S07.1-S07.7 data planes,
 * unchanged) as slots.
 */
export function BankingPage() {
  const { roles } = useAuth();
  const wallet = useWalletAccess();
  if (roles.includes('parent')) return <TutorCoinsRoute />;
  if (roles.includes('kid') || wallet.familyChild) return <ChildCoinsRoute familyCoins={!roles.includes('kid')} />;
  return null;
}

function useToken() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void getToken().then((value) => { if (live) setToken(value); });
    return () => { live = false; };
  }, [getToken]);
  return token;
}

function TutorCoinsRoute() {
  const token = useToken();
  const transport = useConsoleTransport();
  const { locale, dark, family } = useConsoleEnvironment();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [kids, setKids] = useState<{ userId: string; displayName: string | null; username: string | null }[]>([]);
  const [queueVersion, setQueueVersion] = useState(0);

  // The decision queue names every child of this Tutor.
  useEffect(() => {
    let live = true;
    void transport('/family/kids').then((result) => {
      const list = (result.data as { kids?: unknown } | null)?.kids;
      if (live && Array.isArray(list)) setKids(list as typeof kids);
    });
    return () => { live = false; };
  }, [transport]);

  const select = useCallback((userId: string) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set('child', userId);
      return next;
    }, { replace: true });
  }, [setParams]);

  return <TutorCoins copy={family.familyCoins} colours={family.coinCard} locale={locale} dark={dark} transport={transport}
    selectedId={params.get('child')} onSelect={select} onNavigate={(href) => navigate(href)}
    childSlots={(child, changed) => {
      const name = childName(child);
      const common = { kidUserId: child.userId, token };
      return {
        // S07.6 (D.1, D.7): what a freeze really holds, who set it, which age view the child reads.
        freeze: <TutorFreezePanel token={token} kidId={child.userId} name={name} onChanged={changed} />,
        // S07.7 (D.23): the limit as structure with a reason, next to the form.
        coaching: <LimitCoachingPanel />,
        // S07.3 (D.11): the bonus in the framing the child's age calls for.
        bonus: <SavingsBonusSettingsPanel kidUserId={child.userId} kidName={name} token={token} />,
        // S07.1 (D.5, OD-21): coin corrections, goal moves and delivered rewards, with every goal's provenance (D.16).
        // GAP-FIX-R6: a correction or a goal move re-reads the Wallet's read of this child's coins.
        corrections: <WalletCorrectionsPanel {...common} kidName={name} onChanged={changed} />,
        // S07.4 (D.13, D.14): the Share places this Tutor chose, and the child's usual split.
        share: <ShareDestinationsPanel {...common} kidName={name} />,
      };
    }}
    aside={<>
      {/* S07.5 (D.17, D.18): the rewards and chores waiting for a decision, with their reasons. */}
      {kids.length > 0 ? <DecisionQueuePanel token={token} kids={kids} refreshKey={queueVersion} onChanged={() => setQueueVersion((value) => value + 1)} /> : null}
      {/* S07.7 (D.20): what the practice covers and does not. */}
      <ScopeStatementPanel />
    </>} />;
}

function ChildCoinsRoute({ familyCoins }: { familyCoins: boolean }) {
  const token = useToken();
  const transport = useConsoleTransport();
  const { locale, dark, family } = useConsoleEnvironment();
  const navigate = useNavigate();
  const [moneyVersion, setMoneyVersion] = useState(0);
  const governance = token ? tokenSession(token) : null;

  return <ChildCoins copy={family.childCoins} colours={family.coinCard} locale={locale} dark={dark} transport={transport} familyCoins={familyCoins} refreshKey={moneyVersion}
    onNavigate={(href) => navigate(href)}
    slots={{
      // S07.6 (D.7, D.12): the practice card, the freeze, the pockets, the limit and this month, in the child's register.
      account: (version) => <CoinAccountPanel token={token} refreshKey={version + moneyVersion} onChanged={() => setMoneyVersion((value) => value + 1)} />,
      // S07.4 (D.13): an allowance arrives pre-split by the child's own usual split; keeping it is one tap.
      // The board states the result (Bible 02 §9.2); a goal it reached celebrates on the goals panel, which re-reads (OD-7).
      split: (credit, frozen, settled) => <AllocationPanel token={token} kind="credit" id={credit.id} amount={credit.amount} frozen={frozen}
        onDone={(split) => { setMoneyVersion((value) => value + 1); settled(splitResultText(locale, split)); }} />,
      usualSplit: <UsualSplitPanel token={token} />,
      // S07.3 (D.11): the child's own bonus, in the framing their age calls for.
      bonus: <SavingsBonusPanel token={token} />,
      // S07.4 (D.15, D.16): goals with provenance and the next-goal prompt.
      goals: (version) => <SavingsGoalsPanel token={token} refreshKey={version + moneyVersion} />,
      // S07.1 (D.5, OD-21): the child's own history with every Tutor reason.
      history: <WalletActivityPanel token={token} />,
      // S07.7 (D.19, D.22): "Beyond the app" from 15, and the child's own research answer.
      bridge: governance ? <MoneyBridgePanel session={governance} /> : null,
      // S10.3 (OD-9 4.2): beside it, the child's own no to a practice the rebuild introduced.
      research: governance ? <>
        <MyResearchPanel session={governance} />
        <MyDataPracticesPanel session={governance} />
      </> : null,
    }} />;
}

export default BankingPage;
