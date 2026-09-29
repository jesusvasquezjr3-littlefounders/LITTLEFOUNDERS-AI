import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { trackInsight } from '@/lib/insights';
import { ChildTasks } from '@/rebuild/family/tasks/ChildTasks';
import { TutorTasks } from '@/rebuild/family/tasks/TutorTasks';
import { isStreakMilestone, type StreakMilestone } from '@/rebuild/family/familyMoneyApi';
import { useConsoleEnvironment, useConsoleTransport } from '../family/consoleSession';
import { CoachingTipPanel } from '../family/GovernancePanels';
import { useWalletAccess } from '../wallet/useWalletAccess';
import { AllocationPanel } from './AllocationPanel';
import { splitResultText } from '../family/moneyHabitsCopy';
import { ChoreComposerPanel } from './ChoreComposerPanel';
import { ChoreStreakPanel } from './ChoreStreakPanel';
import { DecisionQueuePanel } from './DecisionQueuePanel';
import { ChoreDonePanel, DecisionNotesPanel, MyLevelPanel, RewardAskPanel } from './FamilyVoicePanels';
import { SavingsGoalsPanel } from './SavingsGoalsPanel';
import { ShareGivingPanel } from './ShareGivingPanel';
import { UsualSplitPanel } from './UsualSplitPanel';
import { WalletActivityPanel } from './WalletActivityPanel';
import { usePhotoPort } from './photoPort';

/*
 * /tasks: F4 (W2F.2). One route, two rebuilt boards by who is signed in: a
 * verified parent (the Tutor) gets F4-P, a child in a family (a
 * parent-created child, or a self-registered teen who linked a verified
 * parent, S07.2 / OD-3 Option B) gets F4-K. The route guard
 * (RequireWalletAccess 'familyMoney') is UI only; Core admits each request.
 *
 * This adapter binds the rebuilt screens (which import nothing legacy) to
 * the session, language, mode and router, and hands them the wave-1
 * surfaces (S07.3-S07.7 data planes, unchanged) as slots.
 */
export function TasksPage() {
  const { roles } = useAuth();
  const wallet = useWalletAccess();
  // H.3: `task_view` fires once per board mount, consent-gated by the beacon like every other event.
  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    trackInsight('task_view', { routeClass: 'tasks' });
  }, []);

  if (roles.includes('parent')) return <TutorTasksRoute />;
  if (roles.includes('kid') || wallet.familyChild) return <ChildTasksRoute />;
  // Reachable only while the roles load: the route guard sends everyone else away.
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

function TutorTasksRoute() {
  const token = useToken();
  const transport = useConsoleTransport();
  const photos = usePhotoPort();
  const { locale, dark, family } = useConsoleEnvironment();
  const navigate = useNavigate();
  // A decision in the queue or a new chore: the board and the queue re-read what Core holds.
  const [version, setVersion] = useState(0);
  const changed = () => setVersion((value) => value + 1);
  const kids = (children: { userId: string; displayName: string | null; username: string | null }[]) =>
    children.map(({ userId, displayName, username }) => ({ userId, displayName, username }));

  return <TutorTasks copy={family.familyTasks} locale={locale} dark={dark} transport={transport} photos={photos} onNavigate={(href) => navigate(href)}
    refreshKey={version}
    slots={{
      // S07.7 (D.23): this month's tip for the Tutor.
      tip: <CoachingTipPanel token={token} />,
      // S07.5 (D.17, D.18): every decision, with its reason, the child's words and the reflective prompt.
      queue: (children) => <DecisionQueuePanel token={token} kids={kids(children)} refreshKey={version} onChanged={changed} />,
      // S07.3 (D.10, D.23): a family contribution or a bonus task, with pricing guidance.
      composer: (children) => <ChoreComposerPanel kids={kids(children)} token={token} onCreated={changed} />,
    }} />;
}

function ChildTasksRoute() {
  const token = useToken();
  const transport = useConsoleTransport();
  const photos = usePhotoPort();
  const { locale, dark, family } = useConsoleEnvironment();
  const navigate = useNavigate();
  // S07.3 (D.2): a completion moves the streak and passes Core's milestone (7/30/100 only).
  const [streakVersion, setStreakVersion] = useState(0);
  const [milestone, setMilestone] = useState<StreakMilestone | null>(null);
  // S07.5 (D.17, D.18): the level and the decision notes follow every chore marked done and every reward asked for.
  const [voiceVersion, setVoiceVersion] = useState(0);
  // S07.4: a landed payout moves the goals and the Share pocket, so a reached goal celebrates at once (OD-7).
  const [moneyVersion, setMoneyVersion] = useState(0);

  return <ChildTasks copy={family.childTasks} locale={locale} dark={dark} transport={transport} photos={photos} onNavigate={(href) => navigate(href)}
    refreshKey={moneyVersion + voiceVersion}
    slots={{
      streak: <ChoreStreakPanel token={token} refreshKey={streakVersion} milestone={milestone} />,
      level: <MyLevelPanel token={token} refreshKey={voiceVersion} />,
      notes: <DecisionNotesPanel token={token} refreshKey={voiceVersion} />,
      usualSplit: <UsualSplitPanel token={token} />,
      goals: <SavingsGoalsPanel token={token} refreshKey={moneyVersion} />,
      share: <ShareGivingPanel token={token} refreshKey={moneyVersion} onChanged={() => setMoneyVersion((value) => value + 1)} />,
      history: <WalletActivityPanel token={token} />,
      done: (task, changed) => <ChoreDonePanel token={token} taskId={task.id} title={task.title} onMarked={(answer) => {
        setMilestone(isStreakMilestone(answer.milestone) ? answer.milestone : null);
        setStreakVersion((value) => value + 1);
        setVoiceVersion((value) => value + 1);
        changed();
      }} />,
      // The board states the result (Bible 02 §9.2); a goal it reached celebrates on the goals panel, which re-reads (OD-7).
      split: (task, settled) => <AllocationPanel token={token} kind="task" id={task.id} amount={task.rewardCoins} title={task.title}
        onDone={(split) => { setMoneyVersion((value) => value + 1); settled(splitResultText(locale, split)); }} />,
      ask: (reward, affordable, changed) => <RewardAskPanel token={token} catalogId={reward.id} title={reward.title} disabled={!affordable}
        onAsked={(answer) => {
          setVoiceVersion((value) => value + 1);
          if (answer.preapproved) setMoneyVersion((value) => value + 1);
          changed();
        }} />,
    }} />;
}

export default TasksPage;
