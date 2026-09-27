import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, ButtonGroup, DashboardLayout, Dialog, EmptyState, InlineNotice } from '../../design/controls';
import type { ConsoleTransport } from '../../family/console/consoleApi';
import { ConsoleLink, FailureState, PageLoading, type ConsoleLocale, type PageFailure } from '../../family/console/consoleParts';
import { DEFAULT_REGISTER, REGISTER_BAND, type MoneyRegister } from '../../family/moneyRegister';
import { fetchRegister } from '../../family/tasks/tasksApi';
import type { ChildCoinsCopy, CoinCardCopy } from '../../family/tasks/taskParts';
import { CardFields } from './cardParts';
import { CARD_NAME_MAX, fetchOwnCoins, updateOwnCard, type Card as CoinCard, type OwnCoins, type PendingCredit } from './coinsApi';
import '../../design/tokens.css';
import '../../design/system.css';
import '../../family/console/console.css';
import '../../family/tasks/money.css';

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

export interface ChildCoinsSlots {
  account: (version: number) => ReactNode;
  /** `frozen`: a freeze holds the split (D.1), and the split surface says so before the child tries. */
  split: (credit: PendingCredit, frozen: boolean, changed: () => void) => ReactNode;
  usualSplit: ReactNode;
  bonus: ReactNode;
  goals: (version: number) => ReactNode;
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
  /** A self-registered teen who linked a parent reads "Family coins" (their own wallet is elsewhere). */
  familyCoins?: boolean;
  /** Bumped by the route adapter when a wave-1 surface changed the account (a freeze lifted, a split landed): the card and the waiting coins re-read. */
  refreshKey?: number;
  slots: ChildCoinsSlots;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [register, setRegister] = useState<MoneyRegister>(DEFAULT_REGISTER);
  const [retrying, setRetrying] = useState(false);
  const [version, setVersion] = useState(0);
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

  const changed = useCallback(() => setVersion((value) => value + 1), []);

  const root = (body: ReactNode) => <div className="lf-rebuild lf-family-console lf-family-money" data-screen="child-coins" data-theme={dark ? 'dark' : 'light'}
    data-age-band={REGISTER_BAND[register]} data-register={register} lang={locale}>
    <header className="lf-console-header"><h1 data-copy-role="heading">{familyCoins ? copy.titleFamily : copy.title}</h1></header>
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
  return root(<DashboardLayout
    primary={<>
      <div className="lf-money-slot" data-family-part="account">{slots.account(version)}</div>
      {/* Each waiting allowance says how many coins wait: the group is named, not titled, to keep the first view short (06 §3.1). */}
      {coins.credits.length > 0 ? <section className="lf-console-group" data-family-part="payouts" aria-label={copy.payoutsTitle}>
        {coins.credits.map((credit) => <div key={credit.id} className="lf-money-slot" data-credit-id={credit.id}>{slots.split(credit, coins.card?.frozen ?? false, changed)}</div>)}
      </section> : null}
      <div className="lf-money-slot">{slots.usualSplit}</div>
      <div className="lf-money-slot">{slots.bonus}</div>
      <div className="lf-money-slot">{slots.goals(version)}</div>
    </>}
    secondary={<>
      {coins.card ? <CardLook card={coins.card} copy={copy} colours={colours} transport={transport} onSaved={changed} /> : null}
      <div className="lf-money-slot">{slots.history}</div>
      <div className="lf-money-slot">{slots.bridge}</div>
      <div className="lf-money-slot">{slots.research}</div>
      <div className="lf-money-link"><ConsoleLink href="/tasks" onNavigate={onNavigate}>{copy.tasksLink}</ConsoleLink></div>
    </>} />);
}

/** The child's own card name and colour, changed in a dialog; the account re-reads after a save. */
function CardLook({ card, copy, colours, transport, onSaved }: {
  card: CoinCard; copy: ChildCoinsCopy; colours: CoinCardCopy; transport: ConsoleTransport; onSaved: () => void;
}) {
  const heading = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(card.nickname);
  const [design, setDesign] = useState(card.design);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function close() { if (busy) return; setOpen(false); setError(null); setName(card.nickname); setDesign(card.design); }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    const nickname = name.trim();
    if (nickname.length === 0 || nickname.length > CARD_NAME_MAX) { setError(copy.nameMissing); return; }
    setBusy(true); setError(null);
    const result = await updateOwnCard(transport, { nickname, cardDesign: design });
    setBusy(false);
    if (!result.ok) { setError(copy.failed); return; }
    setOpen(false); setSaved(true);
    onSaved();
  }

  return <section className="lf-console-group" data-family-part="card-look" aria-labelledby={heading}>
    <h2 id={heading} data-copy-role="heading">{copy.lookTitle}</h2>
    {saved ? <InlineNotice tone="success" live>{copy.saved}</InlineNotice> : null}
    {/* The dialog opens on the card as Core holds it now (after a save the card re-reads; the notice stays). */}
    <ButtonGroup><Button aria-haspopup="dialog" onClick={() => { setSaved(false); setName(card.nickname); setDesign(card.design); setOpen(true); }}>{copy.edit}</Button></ButtonGroup>
    <Dialog open={open} onClose={busy ? undefined : close} heading={copy.lookTitle} description={copy.editBody}
      actions={<>
        <Button onClick={close} disabled={busy}>{copy.cancel}</Button>
        <Button variant="success" pending={busy} pendingLabel={copy.saving} onClick={() => void submit()}>{copy.save}</Button>
      </>}>
      <form className="lf-money-dialog-form" noValidate onSubmit={(event) => void submit(event)}>
        {error ? <InlineNotice tone="error" live>{error}</InlineNotice> : null}
        <CardFields labels={copy} colours={colours} name={name} design={design} onName={setName} onDesign={setDesign} disabled={busy} />
      </form>
    </Dialog>
  </section>;
}
