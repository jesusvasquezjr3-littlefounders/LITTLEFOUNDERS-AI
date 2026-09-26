import { useId, useState } from 'react';
import { Button, Copy, ErrorState, InlineNotice, LoadingState, SegmentedControl, TextField } from '../design/controls';
import { previewBonus, type KidBonus } from './familyMoneyApi';
import '../design/tokens.css';
import '../design/system.css';
import './familyHub.css';
import './familyMoney.css';

/*
 * S07.3 (D.11): the Tutor's savings bonus settings, in the framing the child
 * is in (decided by the database from the child's age, never role):
 *   - under 13: a fixed "1 coin for every 10 saved" the Tutor switches on or
 *     off; no percentage is offered (the server refuses one anyway);
 *   - 13-17: a whole weekly percent, 0-20, which the teen sees with a worked
 *     example.
 * When the migration moved an existing rule to the fixed ratio, the Tutor is
 * told what changed and from what, once, until the next save. The honest
 * "not a bank interest rate" line stays (D.20). No celebration.
 */

export interface SavingsBonusSettingsCopy {
  open: string; close: string; heading: string; perTenBody: string; perTenWhy: string; percentBody: string; percentWhy: string; example: string;
  rate: string; on: string; off: string; save: string; saving: string; saved: string; reframedOn: string; reframedOff: string; notInterest: string;
  invalidRate: string; fixedForAge: string; noAccount: string; loading: string; failed: string; saveFailed: string; retry: string;
}

export type BonusNotice = { text: string; error: boolean } | null;
const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
const EXAMPLE_SAVED = 100;

export function SavingsBonusSettings({ copy, locale, dark, kidName, open, loading, failed, busy, notice, bonus, onToggle, onRetry, onSave }: {
  copy: SavingsBonusSettingsCopy;
  locale: string;
  dark: boolean;
  kidName: string;
  open: boolean;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  notice: BonusNotice;
  bonus: KidBonus | null;
  onToggle: () => void;
  onRetry: () => void;
  onSave: (input: { active: boolean; rateBp?: number }) => void;
}) {
  const name = useId();
  // Initialized from the server's rule; the route wrapper remounts this
  // surface (a new key) whenever it loads or saves a rule.
  const [active, setActive] = useState(bonus?.rule?.active ?? false);
  const [percent, setPercent] = useState(bonus?.rule && bonus.framing === 'percent' ? String(bonus.rule.rateBp / 100) : '5');
  const [invalid, setInvalid] = useState(false);

  const percentValue = /^\d{1,2}$/.test(percent.trim()) ? Number(percent.trim()) : NaN;
  const reframed = bonus?.rule?.reframedFromRateBp ?? null;

  function save() {
    if (busy || !bonus) return;
    if (bonus.framing === 'per_ten') return onSave({ active });
    if (!(percentValue >= 0 && percentValue <= 20)) return setInvalid(true);
    setInvalid(false);
    onSave({ active, rateBp: percentValue * 100 });
  }

  return <section className="lf-rebuild lf-family-hub" data-family-money="bonus-settings" data-theme={dark ? 'dark' : 'light'} lang={locale}
    aria-label={fill(copy.heading, { name: kidName })} data-framing={bonus?.framing ?? 'unknown'}>
    <Button aria-expanded={open} onClick={onToggle}>{open ? copy.close : copy.open}</Button>
    {open && <>
      <h2 data-copy-role="heading"><span className="ugc">{fill(copy.heading, { name: kidName })}</span></h2>
      {failed ? <ErrorState heading={copy.failed} retryLabel={copy.retry} retryingLabel={copy.loading} onRetry={onRetry} />
        : loading || !bonus ? <LoadingState label={copy.loading} lines={2} /> : <>
        {/* What the migration changed, once: a confirmation when the rule stayed on, a request for a yes when it was switched off. */}
        {reframed !== null && <InlineNotice tone={bonus.rule?.active ? 'success' : 'info'} live>
          {fill(bonus.rule?.active ? copy.reframedOn : copy.reframedOff, { rate: reframed / 100 })}
        </InlineNotice>}
        <Copy role="body">{bonus.framing === 'per_ten' ? copy.perTenBody : copy.percentBody}</Copy>
        <Copy role="body">{bonus.framing === 'per_ten' ? copy.perTenWhy : copy.percentWhy}</Copy>
        <SegmentedControl legend={copy.open} legendHidden name={`${name}-active`} value={active ? 'on' : 'off'} disabled={busy}
          options={[{ value: 'on', label: copy.on }, { value: 'off', label: copy.off }]} onValueChange={(value) => setActive(value === 'on')} />
        {bonus.framing === 'percent' && active && <TextField label={copy.rate} type="number" inputMode="numeric" min={0} max={20} step={1} value={percent} disabled={busy}
          error={invalid ? copy.invalidRate : undefined} errorLive onChange={(event) => { setPercent(event.target.value); setInvalid(false); }} />}
        {active && <span data-copy-role="data">{fill(copy.example, {
          saved: EXAMPLE_SAVED,
          bonus: previewBonus(bonus.framing, EXAMPLE_SAVED, bonus.framing === 'per_ten' ? 1000 : (Number.isFinite(percentValue) ? percentValue * 100 : 0)),
        })}</span>}
        <Copy role="body">{copy.notInterest}</Copy>
        {/* The rate's own error sits under the field; with the bonus switched off the field is hidden, so the same words stand alone. */}
        {invalid && !active && <InlineNotice tone="error" live>{copy.invalidRate}</InlineNotice>}
        {notice && <InlineNotice tone={notice.error ? 'error' : 'success'} live>{notice.text}</InlineNotice>}
        <div className="lf-family-hub-actions"><Button variant="accent" pending={busy} pendingLabel={copy.saving} onClick={save}>{copy.save}</Button></div>
      </>}
    </>}
  </section>;
}
