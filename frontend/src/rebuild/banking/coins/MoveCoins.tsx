import { useEffect, useMemo, useState } from 'react';
import { Button, ChipGroup, ChoiceChip, Dialog, InlineNotice, Stepper } from '../../design/controls';
import type { ConsoleTransport } from '../../family/console/consoleApi';
import { pluralUnit } from '../../design/plural';
import type { Locale } from '../../design/copyBudget';
import { PocketMark } from '../../family/PocketMark';
import { moveOwnCoins, moveOwnGoalCoins, type OwnGoal, type Pocket } from './coinsApi';
import '../../design/tokens.css';
import '../../design/system.css';
import '../wallet.css';

/*
 * Moving coins, the one thing a money app has to do well: pick where they are,
 * pick where they go, say how many, done. No approval and nothing leaves the
 * account (the practice coins stay in the app). What the rules allow:
 *   - between the three pockets (any way);
 *   - from Save into a goal that is still open;
 *   - from a goal back to Save (a goal can always give its coins back).
 * Anything else is simply not offered, so a child never meets a refusal for a
 * choice the screen let them make. The database checks every move again.
 */

export interface MoveCopy {
  title: string; from: string; to: string; amount: string; all: string; half: string; confirm: string; moving: string; done: string; goalOf: string; nothing: string;
  pick: string; left: string; empty: string; noRoute: string; insufficient: string; protected: string; failed: string; less: string; more: string; cancel: string; unitOne: string; unitOther: string; freeSave: string;
}

/** `save` here is the plain Save: what is not tied to a goal. */
export type Places = Record<Pocket, number>;

type PlaceId = Pocket | `goal:${string}`;
const isGoal = (id: PlaceId): id is `goal:${string}` => id.startsWith('goal:');
const goalIdOf = (id: `goal:${string}`) => id.slice(5);
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function MoveCoins({ open, onOpenChange, locale, copy, names, places, goals, preset, transport, onMoved }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  copy: MoveCopy;
  names: Record<Pocket, string>;
  places: Places;
  goals: OwnGoal[];
  /** Where the dialog starts: a goal's "Add coins" or "Take out" opens it already pointed. */
  preset: { from?: string; to?: string } | null;
  transport: ConsoleTransport;
  onMoved: (text: string) => void;
}) {
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const unit = (n: number) => pluralUnit(locale, n, { one: copy.unitOne, other: copy.unitOther });
  const sources = useMemo(() => {
    const list: { id: PlaceId; label: string; balance: number; pocket?: Pocket }[] = (['save', 'spend', 'share'] as const)
      .map((pocket) => ({ id: pocket as PlaceId, label: pocket === 'save' ? fill(copy.freeSave, { place: names.save }) : names[pocket], balance: places[pocket], pocket }));
    for (const goal of goals) if (goal.saved > 0) list.push({ id: `goal:${goal.id}`, label: fill(copy.goalOf, { title: goal.title }), balance: goal.saved });
    return list.filter((place) => place.balance > 0);
  }, [goals, names, places, copy.goalOf, copy.freeSave]);

  const [from, setFrom] = useState<PlaceId | null>(null);
  const [to, setTo] = useState<PlaceId | null>(null);
  const [amount, setAmount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each opening starts from the preset, or from the pocket with the most coins.
  useEffect(() => {
    if (!open) return;
    const start = preset?.from && sources.some((s) => s.id === preset.from) ? (preset.from as PlaceId) : sources[0]?.id ?? null;
    setFrom(start ?? null);
    setTo((preset?.to ?? null) as PlaceId | null);
    setAmount(1);
    setError(null);
  }, [open, preset, sources]);

  const source = sources.find((s) => s.id === from) ?? null;
  const max = source?.balance ?? 0;

  const targets = useMemo(() => {
    if (!from) return [];
    if (isGoal(from)) return [{ id: 'save' as PlaceId, label: names.save }];
    const pockets = (['save', 'spend', 'share'] as const).filter((pocket) => pocket !== from).map((pocket) => ({ id: pocket as PlaceId, label: names[pocket] }));
    const open = from === 'save' ? goals.filter((g) => g.status === 'active').map((g) => ({ id: `goal:${g.id}` as PlaceId, label: fill(copy.goalOf, { title: g.title }) })) : [];
    return [...pockets, ...open];
  }, [from, goals, names, copy.goalOf]);

  // Changing the source keeps the destination only if it is still a valid one; the amount never exceeds what is there.
  useEffect(() => {
    if (to && !targets.some((t) => t.id === to)) setTo(targets.length === 1 ? targets[0]!.id : null);
    else if (!to && targets.length === 1) setTo(targets[0]!.id);
    setAmount((current) => Math.max(1, Math.min(current, Math.max(1, max))));
  }, [targets, to, max]);

  const target = targets.find((t) => t.id === to) ?? null;
  const ready = source !== null && target !== null && amount >= 1 && amount <= max;

  async function submit() {
    if (!ready || busy || !from || !to) return;
    setBusy(true); setError(null);
    const result = isGoal(from)
      ? await moveOwnGoalCoins(transport, goalIdOf(from), 'out', amount)
      : isGoal(to) ? await moveOwnGoalCoins(transport, goalIdOf(to), 'in', amount)
        : await moveOwnCoins(transport, { from, to: to as Pocket, amount });
    setBusy(false);
    if (!result.ok) {
      setError(result.code === 'INSUFFICIENT_BALANCE' || result.code === 'GOAL_BALANCE_INSUFFICIENT' ? copy.insufficient : result.code === 'GOAL_SAVINGS_PROTECTED' ? copy.protected : copy.failed);
      return;
    }
    onOpenChange(false);
    onMoved(fill(copy.done, { count: number.format(amount), unit: unit(amount), from: source!.label, to: target!.label }));
  }

  const close = () => { if (!busy) onOpenChange(false); };

  return <Dialog open={open} onClose={busy ? undefined : close} heading={copy.title} description={copy.pick}
    actions={<>
      <Button onClick={close} disabled={busy}>{copy.cancel}</Button>
      <Button variant="success" disabled={!ready} pending={busy} pendingLabel={copy.moving} onClick={() => void submit()}>{fill(copy.confirm, { count: number.format(amount), unit: unit(amount) })}</Button>
    </>}>
    <div className="lf-wallet-move" data-wallet-move>
      {sources.length === 0 ? <p data-copy-role="body">{copy.nothing}</p> : <>
        <section className="lf-wallet-move-group" aria-label={copy.from}>
          <h3 data-copy-role="heading">{copy.from}</h3>
          <ChipGroup label={copy.from}>
            {sources.map((place) => <ChoiceChip key={place.id} selected={from === place.id} disabled={busy} onToggle={() => { setFrom(place.id); setTo(null); }}>
              {place.pocket ? <PocketMark pocket={place.pocket} size="sm" /> : null}{place.label} · {number.format(place.balance)}
            </ChoiceChip>)}
          </ChipGroup>
        </section>
        <section className="lf-wallet-move-group" aria-label={copy.to}>
          <h3 data-copy-role="heading">{copy.to}</h3>
          {targets.length === 0 ? <p data-copy-role="body">{copy.empty}</p> : <ChipGroup label={copy.to}>
            {targets.map((place) => <ChoiceChip key={place.id} selected={to === place.id} disabled={busy} onToggle={() => setTo(place.id)}>{place.label}</ChoiceChip>)}
          </ChipGroup>}
          {from && isGoal(from) ? <p className="lf-wallet-caption" data-copy-role="body">{copy.noRoute}</p> : null}
        </section>
        <section className="lf-wallet-move-group" aria-label={copy.amount}>
          <h3 data-copy-role="heading">{copy.amount}</h3>
          <Stepper label={copy.amount} labelHidden value={amount} min={1} max={Math.max(1, max)} onValueChange={setAmount}
            labels={{ decrease: copy.less, increase: copy.more }} disabled={busy || max < 1} />
          <ChipGroup>
            <ChoiceChip selected={amount === Math.max(1, Math.floor(max / 2))} disabled={busy || max < 2} onToggle={() => setAmount(Math.max(1, Math.floor(max / 2)))}>{copy.half}</ChoiceChip>
            <ChoiceChip selected={amount === max} disabled={busy} onToggle={() => setAmount(max)}>{copy.all}</ChoiceChip>
          </ChipGroup>
          {source ? <p className="lf-wallet-caption" data-copy-role="data">{fill(copy.left, { place: source.label, count: number.format(max - amount) })}</p> : null}
        </section>
        {error ? <InlineNotice tone="error" live>{error}</InlineNotice> : null}
      </>}
    </div>
  </Dialog>;
}
