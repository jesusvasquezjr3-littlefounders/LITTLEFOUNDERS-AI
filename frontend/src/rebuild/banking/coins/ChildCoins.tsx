import { ApplicationArt } from '../../design/ApplicationArt';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Dialog, EmptyState, InlineNotice, SegmentedControl, TileButton } from '../../design/controls';
import type { WalletActions, WalletPart } from '../CoinAccount';
import type { ConsoleTransport } from '../../family/console/consoleApi';
import { ConsoleLink, FailureState, PageLoading, type ConsoleLocale, type PageFailure } from '../../family/console/consoleParts';
import { DEFAULT_REGISTER, REGISTER_BAND, type MoneyRegister } from '../../family/moneyRegister';
import { fetchRegister } from '../../family/tasks/tasksApi';
import type { ChildCoinsCopy, CoinCardCopy } from '../../family/tasks/taskParts';
import { CardFields } from './cardParts';
import { AllowanceAsk } from './AllowanceAsk';
import { CARD_NAME_MAX, fetchOwnAllowance, fetchOwnAllowanceRequest, fetchOwnCoins, fetchOwnGoals, fetchOwnPockets, updateOwnCard, type Allowance, type AllowanceRequest, type Card as CoinCard, type OwnCoins, type OwnGoal, type PendingCredit, type Pocket } from './coinsApi';
import { MoveCoins, type Places } from './MoveCoins';
import type { Locale } from '../../design/copyBudget';
import '../../design/tokens.css';
import '../../design/system.css';
import '../../family/console/console.css';
import '../../family/tasks/money.css';
import '../wallet.css';

/*
 * F5-K, the child's wallet (W2F.2): a parent-created child's coin card, or the
 * family coins of a self-registered teen who linked a verified parent (their
 * own wallet stays at /wallet, OD-3 Option B).
 *
 * The S07.6 coin account leads (the practice card with no number, what a
 * freeze really holds, the pockets, the spending limit and this month, each
 * in the child's age register: D.7, D.12). Then the coins waiting to be split
 * (an allowance arrives pre-split by the child's own usual split, D.13), the
 * usual split, the savings bonus explained for their age (D.11), and the
 * goals with provenance and the next-goal prompt (D.15, D.16). Beside them:
 * the card's name and colour (the child's own choice), the history with
 * every Tutor reason, "Beyond the app" from 15 (D.19), the child's own
 * research answer (D.22) and the way to the rewards on Tasks.
 *
 * The wave-1 surfaces keep their own data planes and arrive as slots. `account`
 * receives a version that changes after the card or a split changes, so the
 * account re-reads what Core holds. This screen's words are written to the
 * youngest band's budget and declare the register Core returned (D.12).
 */

/**
 * The wallet is one screen of four tabs: Home (what you have and what you can do), Goals, Activity and Card. Share is not a tab:
 * it is a pocket, reached from the pocket and from the Share action. (Owner review, 7 October 2026.)
 */
export type WalletTab = 'overview' | 'goals' | 'share' | 'card' | 'activity';
const TABS: readonly WalletTab[] = ['overview', 'goals', 'activity', 'card'];

export interface ChildCoinsSlots {
  /** `part` is the slice of the account a tab shows; `actions` are the quick actions that belong to this screen (restyling the card, starting a goal). */
  account: (version: number, part: WalletPart, actions: WalletActions) => ReactNode;
  /**
   * `frozen`: a freeze holds the split (D.1), and the split surface says so before the child tries. `settled` takes the
   * written result of a confirmed split: this board keeps it in view and re-reads (the allowance then leaves).
   */
  split: (credit: PendingCredit, frozen: boolean, settled: (result: string) => void) => ReactNode;
  usualSplit: ReactNode;
  bonus: ReactNode;
  /** The Share pocket's real destination: where coins go, what was given, taking one back (D.14). */
  share?: ReactNode;
  /** `compact`: the home tab's glance at the goals (no form, no putting away); the goals tab gets the whole section, with the new-goal form open when `adding`. */
  goals: (version: number, options: { compact: boolean; adding: boolean; /** "Add coins" or "Take out" on a goal opens the move dialog already pointed at it. */ onMove: (goalId: string, direction: 'in' | 'out') => void; /** The home glance's "See all goals", at the end of its heading row. */ headingAction?: ReactNode }) => ReactNode;
  history: ReactNode;
  bridge: ReactNode;
  research: ReactNode;
}

/** Core's refusals that mean this account has no family wallet here (OD-3 Option B: Tasks and family coins need a linked parent). */
const REFUSED = new Set(['GUARDIAN_LINK_REQUIRED', 'WALLET_UNAVAILABLE']);

type Load = { status: 'loading' } | { status: 'failed'; failure: PageFailure } | { status: 'ready'; coins: OwnCoins };

export function ChildCoins({ copy, colours, locale, dark, transport, onNavigate, familyCoins = false, refreshKey = 0, slots }: {
  copy: ChildCoinsCopy;
  colours: CoinCardCopy;
  locale: ConsoleLocale;
  dark: boolean;
  transport: ConsoleTransport;
  onNavigate: (href: string) => void;
  /** A self-registered teen who linked a parent reads "Family wallet" (OD-28; their own wallet is elsewhere). */
  familyCoins?: boolean;
  /** Bumped by the route adapter when a wave-1 surface changed the account (a freeze lifted, a split landed): the card and the waiting coins re-read. */
  refreshKey?: number;
  slots: ChildCoinsSlots;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [register, setRegister] = useState<MoneyRegister>(DEFAULT_REGISTER);
  const [retrying, setRetrying] = useState(false);
  const [version, setVersion] = useState(0);
  // Bible 02 §9.2 / K18: the last confirmed split's result, held here because the allowance's own slot leaves on the re-read.
  const [splitResult, setSplitResult] = useState<string | null>(null);
  const [tab, setTab] = useState<WalletTab>('overview');
  const [lookOpen, setLookOpen] = useState(false);
  const [lookSaved, setLookSaved] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);
  // What the home tab needs besides the account: the pockets, the goals they hold, the allowance, and the move dialog.
  const [pockets, setPockets] = useState<Record<Pocket, number> | null>(null);
  const [goals, setGoals] = useState<OwnGoal[]>([]);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [askRequest, setAskRequest] = useState<AllowanceRequest | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [movePreset, setMovePreset] = useState<{ from?: string; to?: string } | null>(null);
  const [movedNotice, setMovedNotice] = useState<string | null>(null);
  const generation = useRef(0);

  const read = useCallback(async () => {
    const current = ++generation.current;
    const result = await fetchOwnCoins(transport);
    if (current !== generation.current) return;
    setRetrying(false);
    if (!result.ok) {
      setLoad((previous) => previous.status === 'ready' ? previous : { status: 'failed', failure: { code: result.code } });
      return;
    }
    setLoad({ status: 'ready', coins: result.data });
  }, [transport]);

  useEffect(() => {
    void read();
    return () => { generation.current++; };
  }, [read, version, refreshKey]);

  useEffect(() => {
    let live = true;
    void fetchRegister(transport).then((result) => { if (live && result.ok) setRegister(result.data); });
    return () => { live = false; };
  }, [transport]);

  useEffect(() => {
    let live = true;
    void Promise.all([fetchOwnPockets(transport), fetchOwnGoals(transport), fetchOwnAllowance(transport), fetchOwnAllowanceRequest(transport)]).then(([p, g, a, r]) => {
      if (!live) return;
      if (p.ok) setPockets(p.data);
      if (g.ok) setGoals(g.data);
      setAllowance(a.ok ? a.data : null);
      setAskRequest(r.ok ? r.data : null);
    });
    return () => { live = false; };
  }, [transport, version, refreshKey]);

  const changed = useCallback(() => setVersion((value) => value + 1), []);
  const settled = useCallback((result: string) => { setSplitResult(result); setVersion((value) => value + 1); }, []);

  const root = (body: ReactNode) => <div className="lf-rebuild lf-family-console lf-family-money" data-screen="child-coins" data-theme={dark ? 'dark' : 'light'}
    data-age-band={REGISTER_BAND[register]} data-register={register} lang={locale}>
    <header className="lf-console-header lf-illustrated-header"><div className="lf-illustrated-heading"><h1 data-copy-role="heading">{familyCoins ? copy.titleFamily : copy.title}</h1></div><ApplicationArt scene="wallet" /></header>
    {body}
  </div>;

  if (load.status === 'loading') return root(<PageLoading label={copy.loading} />);
  if (load.status === 'failed') {
    // Core refused this account (no linked parent, or no family wallet): say why and offer the way back, never "try again".
    if (REFUSED.has(load.failure.code)) {
      return root(<EmptyState heading={copy.refusedTitle} action={<ConsoleLink href="/learn" onNavigate={onNavigate} variant="accent">{copy.refusedAction}</ConsoleLink>} />);
    }
    return root(<FailureState failure={load.failure} copy={copy} retrying={retrying} onRetry={() => { setRetrying(true); void read(); }} />);
  }

  const { coins } = load;
  const tabs = copy.tabs;
  const home = copy.home;
  const number = new Intl.NumberFormat(locale);
  const names: Record<Pocket, string> = { save: home.nameSave, spend: home.nameSpend, share: home.nameShare };
  // Plain Save is what is not tied to a goal: only that can move.
  const heldInGoals = goals.reduce((sum, goal) => sum + goal.saved, 0);
  const places: Places = { save: Math.max(0, (pockets?.save ?? 0) - heldInGoals), spend: pockets?.spend ?? 0, share: pockets?.share ?? 0 };
  const nextDate = allowance?.active && Date.parse(allowance.nextRunAt) > Date.now()
    ? new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(allowance.nextRunAt)) : null;
  const next = allowance && nextDate ? home.next.replace('{date}', nextDate).replace('{amount}', number.format(allowance.amount)) : null;
  const openMove = (preset: { from?: string; to?: string } | null) => { setMovedNotice(null); setMovePreset(preset); setMoveOpen(true); };
  const actions: WalletActions = {
    home: { have: home.have, next, move: home.move, ask: home.ask, share: home.share, goal: home.goal, hintSave: heldInGoals > 0 ? home.inGoals.replace('{count}', number.format(heldInGoals)) : home.hintSave, hintSpend: home.hintSpend,
      hintShare: home.hintShare, actions: home.actions, seeAll: home.seeAll },
    onMove: () => openMove(null),
    heroExtra: <AllowanceAsk copy={copy.ask} locale={locale} allowance={allowance} request={askRequest} transport={transport} onChanged={changed} />,
    onShare: () => setTab('share'),
    onSeeAll: () => setTab('activity'),
    onCustomize: () => { setLookSaved(false); setLookOpen(true); },
    onNewGoal: () => { setAddingGoal(true); setTab('goals'); },
    onReward: () => onNavigate('/tasks'),
    // Each pocket is a door to what you do with it: Save opens the goals, Share the giving, Spend the rewards.
    onOpenPocket: (pocket) => { if (pocket === 'spend') onNavigate('/tasks'); else setTab(pocket === 'save' ? 'goals' : 'share'); },
  };
  const onGoalMove = (goalId: string, direction: 'in' | 'out') => openMove(direction === 'in' ? { from: 'save', to: `goal:${goalId}` } : { from: `goal:${goalId}`, to: 'save' });
  const choose = (next: WalletTab) => { if (next !== 'goals') setAddingGoal(false); setTab(next); };
  return root(<div className="lf-wallet-screen">
    <SegmentedControl legend={tabs.label} legendHidden size="compact" name="wallet-tab" className="lf-wallet-tabs" value={tab === 'share' ? 'overview' : tab} onValueChange={choose}
      options={TABS.map((value) => ({ value, label: tabs[value] }))} />
    {lookSaved ? <InlineNotice tone="success" live>{copy.saved}</InlineNotice> : null}
    {movedNotice ? <InlineNotice tone="success" live>{movedNotice}</InlineNotice> : null}
    {splitResult ? <div className="lf-money-slot" data-family-part="split-result"><InlineNotice tone="success" live>{splitResult}</InlineNotice></div> : null}

    {tab === 'overview' && <>
      {/* The coins waiting to be split come first when there are any: the one thing to do. */}
      {coins.credits.length > 0 ? <section className="lf-wallet-waiting" data-family-part="payouts" aria-label={copy.payoutsTitle}>
        {coins.credits.map((credit) => <div key={credit.id} className="lf-money-slot" data-credit-id={credit.id}>{slots.split(credit, coins.card?.frozen ?? false, settled)}</div>)}
      </section> : null}
      <div className="lf-wallet-overview">
        <div className="lf-wallet-col">
          <div className="lf-money-slot" data-family-part="account">{slots.account(version, 'overview', actions)}</div>
          {coins.card ? <TileButton className="lf-wallet-cardstrip" data-design={coins.card.design} data-frozen={coins.card.frozen} onClick={() => setTab('card')}>
            <span className="lf-wallet-cardstrip-swatch" aria-hidden="true" />
            <span className="lf-wallet-cardstrip-text"><span data-copy-role="heading">{home.card}</span><span data-copy-role="data">{coins.card.nickname}</span></span>
            <span className="lf-wallet-cardstrip-state" data-copy-role="data">{coins.card.frozen ? home.cardFrozen : home.cardActive}</span>
          </TileButton> : null}
        </div>
        <div className="lf-wallet-col">
          <div className="lf-money-slot lf-wallet-glance" data-family-part="goals">
            {slots.goals(version, { compact: true, adding: false, onMove: onGoalMove, headingAction: <Button size="sm" onClick={() => setTab('goals')}>{tabs.seeGoals}</Button> })}
          </div>
          <div className="lf-money-slot" data-family-part="recent">{slots.account(version, 'recent', actions)}</div>
        </div>
      </div>
    </>}

    {tab === 'goals' && <>
      <div className="lf-money-slot" data-family-part="goals">{slots.goals(version, { compact: false, adding: addingGoal, onMove: onGoalMove })}</div>
      <div className="lf-money-slot">{slots.usualSplit}</div>
      <div className="lf-money-slot">{slots.bonus}</div>
    </>}

    {tab === 'share' && <div className="lf-money-slot" data-family-part="share"><Button size="sm" onClick={() => setTab('overview')}>{tabs.overview}</Button>{slots.share}</div>}

    {tab === 'card' && <>
      <div className="lf-money-slot" data-family-part="account">{slots.account(version, 'card', actions)}</div>
      <div className="lf-money-slot">{slots.bridge}</div>
      <div className="lf-money-slot">{slots.research}</div>
      <div className="lf-money-link"><ConsoleLink href="/tasks" onNavigate={onNavigate}>{copy.tasksLink}</ConsoleLink></div>
    </>}

    {tab === 'activity' && <>
      <div className="lf-money-slot" data-family-part="account">{slots.account(version, 'activity', actions)}</div>
      <div className="lf-money-slot">{slots.history}</div>
    </>}
    <MoveCoins open={moveOpen} onOpenChange={setMoveOpen} locale={locale as Locale} copy={copy.move} names={names} places={places} goals={goals} preset={movePreset} transport={transport}
      onMoved={(text) => { setMovedNotice(text); changed(); }} />
    {coins.card ? <CardLook card={coins.card} copy={copy} colours={colours} transport={transport} open={lookOpen} onOpenChange={setLookOpen}
      onSaved={() => { setLookSaved(true); changed(); }} /> : null}
  </div>);
}

/** The child's own card name and colour, changed in a dialog with the card itself as the preview; the account re-reads after a save. */
function CardLook({ card, copy, colours, transport, open, onOpenChange, onSaved }: {
  card: CoinCard; copy: ChildCoinsCopy; colours: CoinCardCopy; transport: ConsoleTransport; open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
  const [name, setName] = useState(card.nickname);
  const [design, setDesign] = useState(card.design);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each opening starts from the card as Core holds it now.
  useEffect(() => { if (open) { setName(card.nickname); setDesign(card.design); setError(null); } }, [open, card.nickname, card.design]);

  function close() { if (busy) return; onOpenChange(false); setError(null); }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const nickname = name.trim();
    if (nickname.length === 0 || nickname.length > CARD_NAME_MAX) { setError(copy.nameMissing); return; }
    setBusy(true); setError(null);
    const result = await updateOwnCard(transport, { nickname, cardDesign: design });
    setBusy(false);
    if (!result.ok) { setError(copy.failed); return; }
    onOpenChange(false);
    onSaved();
  }

  return <Dialog open={open} onClose={busy ? undefined : close} heading={copy.lookTitle} description={copy.editBody}
    actions={<>
      <Button onClick={close} disabled={busy}>{copy.cancel}</Button>
      <Button variant="success" pending={busy} pendingLabel={copy.saving} onClick={() => void submit()}>{copy.save}</Button>
    </>}>
    <form className="lf-money-dialog-form" noValidate onSubmit={(event) => void submit(event)}>
      {/* The card itself is the preview: the name and the colour change on it as the child chooses. */}
      <div className="lf-wallet-card lf-wallet-card--preview" data-design={design} data-frozen="false" aria-hidden="true">
        <span className="lf-wallet-card-name" data-copy-role="data">{name.trim() || card.nickname}</span>
      </div>
      {error ? <InlineNotice tone="error" live>{error}</InlineNotice> : null}
      <CardFields labels={copy} colours={colours} name={name} design={design} onName={setName} onDesign={setDesign} disabled={busy} />
    </form>
  </Dialog>;
}
