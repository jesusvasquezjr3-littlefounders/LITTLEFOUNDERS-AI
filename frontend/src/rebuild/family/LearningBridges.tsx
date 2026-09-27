import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, ErrorState, InlineNotice, SegmentedControl, SelectField, TextField } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './familyLearning.css';
import { GOAL_ICONS, GOAL_TARGET_MAX, TASK_REWARD_MAX, type BridgeDetails, type BridgeResult, type BridgesState, type GoalIcon, type GuardianBridge } from './familyLearning';

/*
 * B.13 / S05.3c — "Your child just learned about savings goals: create a real
 * one together?" The child finished a topic that teaches a real-world money
 * skill; the verified parent may turn it into a REAL savings goal or a REAL
 * task, in one step, or let it go. Optional by design (B.25): no counter, no
 * reminder, no guilt copy; "Not now" is final for that skill, and an
 * unanswered prompt quietly closes after 14 days.
 *
 * Core creates the goal or task in one transaction that re-checks the
 * guardian link; this surface only collects the details the existing Family
 * Hub flows already ask for (the same limits as the task and goal forms).
 * Tasks stay guardian-only: this is the guardian's surface. Presentation
 * only: the host panel owns transport.
 */

type Copy = {
  title: string; learned: string; action: Record<GuardianBridge['action'], string>; setUp: string; notNow: string; cancel: string;
  goalName: string; goalTarget: string; goalIcon: string; icons: Record<GoalIcon, string>; createGoal: string;
  taskName: string; taskReward: string; taskRepeat: string; once: string; weekly: string; createTask: string;
  targetHint: string; rewardHint: string; nameHint: string;
  created: Record<GuardianBridge['action'], string>; closed: string; failed: string; invalid: string; noAccess: string; loadFailed: string; retry: string;
};

export const learningBridgesCopy: Record<Locale, Copy> = {
  'en-US': {
    title: 'Try it for real', learned: 'Just learned', action: { savings_goal: 'Create a real savings goal together?', earning_task: 'Plan a real task they can earn coins for?' },
    setUp: 'Set it up', notNow: 'Not now', cancel: 'Cancel',
    goalName: 'Goal name', goalTarget: 'Coins to save', goalIcon: 'Picture', icons: { star: 'Star', game: 'Game', toy: 'Toy', book: 'Book', bike: 'Bike', trip: 'Trip', gift: 'Gift' }, createGoal: 'Create goal',
    taskName: 'Task name', taskReward: 'Reward in coins', taskRepeat: 'Repeats', once: 'Once', weekly: 'Every week', createTask: 'Create task',
    targetHint: `Use 1 to ${GOAL_TARGET_MAX} coins.`, rewardHint: `Use 1 to ${TASK_REWARD_MAX} coins.`, nameHint: 'Give it a short name.',
    created: { savings_goal: 'Goal created. It is in their wallet.', earning_task: 'Task created. It is in their tasks.' },
    closed: 'This suggestion has closed.', failed: 'Could not save. Try again.', invalid: 'Check the details.', noAccess: 'This child is no longer linked to you.', loadFailed: 'Could not load suggestions.', retry: 'Try again',
  },
  'es-MX': {
    title: 'Pruébenlo de verdad', learned: 'Acaba de aprender', action: { savings_goal: '¿Crean juntos una meta de ahorro real?', earning_task: '¿Planean una tarea real para ganar monedas?' },
    setUp: 'Prepararlo', notNow: 'Ahora no', cancel: 'Cancelar',
    goalName: 'Nombre de la meta', goalTarget: 'Monedas para ahorrar', goalIcon: 'Imagen', icons: { star: 'Estrella', game: 'Juego', toy: 'Juguete', book: 'Libro', bike: 'Bici', trip: 'Viaje', gift: 'Regalo' }, createGoal: 'Crear meta',
    taskName: 'Nombre de la tarea', taskReward: 'Premio en monedas', taskRepeat: 'Se repite', once: 'Una vez', weekly: 'Cada semana', createTask: 'Crear tarea',
    targetHint: `Usa de 1 a ${GOAL_TARGET_MAX} monedas.`, rewardHint: `Usa de 1 a ${TASK_REWARD_MAX} monedas.`, nameHint: 'Ponle un nombre corto.',
    created: { savings_goal: 'Meta creada. Está en su cartera.', earning_task: 'Tarea creada. Está en sus tareas.' },
    closed: 'Esta sugerencia ya cerró.', failed: 'No se pudo guardar. Inténtalo de nuevo.', invalid: 'Revisa los datos.', noAccess: 'Este niño ya no está vinculado contigo.', loadFailed: 'No se pudieron cargar las sugerencias.', retry: 'Reintentar',
  },
  'pt-BR': {
    title: 'Tentem de verdade', learned: 'Acabou de aprender', action: { savings_goal: 'Criar juntos uma meta de poupança real?', earning_task: 'Planejar uma tarefa real para ganhar moedas?' },
    setUp: 'Preparar', notNow: 'Agora não', cancel: 'Cancelar',
    goalName: 'Nome da meta', goalTarget: 'Moedas para poupar', goalIcon: 'Imagem', icons: { star: 'Estrela', game: 'Jogo', toy: 'Brinquedo', book: 'Livro', bike: 'Bicicleta', trip: 'Viagem', gift: 'Presente' }, createGoal: 'Criar meta',
    taskName: 'Nome da tarefa', taskReward: 'Prêmio em moedas', taskRepeat: 'Repete', once: 'Uma vez', weekly: 'Toda semana', createTask: 'Criar tarefa',
    targetHint: `Use de 1 a ${GOAL_TARGET_MAX} moedas.`, rewardHint: `Use de 1 a ${TASK_REWARD_MAX} moedas.`, nameHint: 'Dê um nome curto.',
    created: { savings_goal: 'Meta criada. Está na carteira da criança.', earning_task: 'Tarefa criada. Está nas tarefas da criança.' },
    closed: 'Esta sugestão já fechou.', failed: 'Não foi possível salvar. Tente de novo.', invalid: 'Confira os dados.', noAccess: 'Esta criança não está mais vinculada a você.', loadFailed: 'Não foi possível carregar as sugestões.', retry: 'Tentar de novo',
  },
};

export function LearningBridges({ state, locale, dark, onAct, onDismiss, onRetry, fixture = false }: {
  state: BridgesState;
  locale: Locale;
  dark: boolean;
  onAct: (promptId: string, details: BridgeDetails) => Promise<BridgeResult>;
  onDismiss: (promptId: string) => Promise<BridgeResult>;
  onRetry: () => void;
  fixture?: boolean;
}) {
  const t = learningBridgesCopy[locale];
  const titleId = useId();
  // Nothing to suggest is not a state worth a card: the section is absent.
  if (state.status === 'loading' || (state.status === 'ready' && state.prompts.length === 0)) return null;
  return <section className="lf-rebuild lf-family-bridges" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-screen={fixture ? 'family-bridges-preview' : 'family-bridges'} aria-labelledby={titleId}>
    <h2 id={titleId} data-copy-role="heading">{t.title}</h2>
    {state.status === 'no-access' ? <InlineNotice tone="error" live>{t.noAccess}</InlineNotice>
      : state.status === 'error' ? <ErrorState heading={t.loadFailed} retryLabel={t.retry} retryingLabel={t.retry} onRetry={onRetry} />
        : state.prompts.map((prompt) => <BridgeCard key={prompt.id} prompt={prompt} t={t} onAct={onAct} onDismiss={onDismiss} />)}
  </section>;
}

function BridgeCard({ prompt, t, onAct, onDismiss }: {
  prompt: GuardianBridge; t: Copy;
  onAct: (promptId: string, details: BridgeDetails) => Promise<BridgeResult>;
  onDismiss: (promptId: string) => Promise<BridgeResult>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BridgeResult | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [icon, setIcon] = useState<GoalIcon>('star');
  const [weekly, setWeekly] = useState(false);
  const [touched, setTouched] = useState(false);
  const max = prompt.action === 'savings_goal' ? GOAL_TARGET_MAX : TASK_REWARD_MAX;
  const number = Number(amount);
  const nameOk = name.trim().length >= 1 && name.trim().length <= (prompt.action === 'savings_goal' ? 80 : 120);
  const amountOk = /^\d+$/.test(amount) && number >= 1 && number <= max;

  if (result === 'dismissed') return null;
  if (result === 'created' || result === 'closed' || result === 'no-access') {
    return <article className="lf-family-bridge lf-family-bridge--done" aria-label={t.title}>
      <InlineNotice tone={result === 'created' ? 'success' : result === 'closed' ? 'info' : 'error'} live>
        {result === 'created' ? t.created[prompt.action] : result === 'closed' ? t.closed : t.noAccess}</InlineNotice>
    </article>;
  }

  async function run(work: () => Promise<BridgeResult>) {
    if (busy) return;
    setBusy(true);
    setResult(await work());
    setBusy(false);
  }

  function submit() {
    setTouched(true);
    if (!nameOk || !amountOk) return;
    const details: BridgeDetails = prompt.action === 'savings_goal'
      ? { action: 'savings_goal', title: name.trim(), target: number, icon }
      : { action: 'earning_task', title: name.trim(), rewardCoins: number, recurrence: weekly ? 'weekly' : 'once' };
    void run(() => onAct(prompt.id, details));
  }

  const goal = prompt.action === 'savings_goal';
  return <article className="lf-family-bridge" aria-label={t.title}>
    <p className="lf-family-bridge-kicker" data-copy-role="body">{t.learned}</p>
    <span className="lf-family-bridge-skill" data-copy-role="data">{prompt.skill}</span>
    <p className="lf-family-bridge-ask" data-copy-role="body">{t.action[prompt.action]}</p>
    {result === 'error' || result === 'invalid' ? <InlineNotice tone="error" live>{result === 'invalid' ? t.invalid : t.failed}</InlineNotice> : null}
    {editing ? <form className="lf-family-bridge-form" noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <TextField label={goal ? t.goalName : t.taskName} value={name} maxLength={goal ? 80 : 120}
        error={touched && !nameOk ? t.nameHint : undefined} onChange={(event) => setName(event.target.value)} />
      {/* The limit is help until a submit finds the amount out of range; then the same sentence is the error. */}
      <TextField label={goal ? t.goalTarget : t.taskReward} value={amount} inputMode="numeric"
        help={touched && !amountOk ? undefined : goal ? t.targetHint : t.rewardHint}
        error={touched && !amountOk ? (goal ? t.targetHint : t.rewardHint) : undefined}
        onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 6))} />
      {goal ? <SelectField label={t.goalIcon} value={icon} onChange={(event) => setIcon(event.target.value as GoalIcon)}
        options={GOAL_ICONS.map((key) => ({ value: key, label: t.icons[key] }))} />
        : <SegmentedControl legend={t.taskRepeat} name={`lf-bridge-repeat-${prompt.id}`} value={weekly ? 'weekly' : 'once'}
          onValueChange={(value) => setWeekly(value === 'weekly')} options={[{ value: 'once', label: t.once }, { value: 'weekly', label: t.weekly }]} />}
      <div className="lf-actions">
        <Button type="submit" variant="accent" disabled={busy}>{goal ? t.createGoal : t.createTask}</Button>
        <Button disabled={busy} onClick={() => { setEditing(false); setTouched(false); }}>{t.cancel}</Button>
      </div>
    </form> : <div className="lf-actions">
      <Button variant="accent" disabled={busy} onClick={() => { setResult(null); setEditing(true); }}>{t.setUp}</Button>
      <Button disabled={busy} onClick={() => void run(() => onDismiss(prompt.id))}>{t.notNow}</Button>
    </div>}
  </article>;
}
