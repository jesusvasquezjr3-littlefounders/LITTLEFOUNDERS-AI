import type { GoalProgressParts } from './moneyHabitsApi';
import { CoinAmount } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './moneyHabits.css';

/*
 * S07.4 (D.16): the ONE goal-progress display of the rebuilt surfaces. A
 * goal's progress is never one mixed number (Appendix G §2.3, "illusionary
 * goal progress"): the child's own coins, bonus coins and Tutor coins are
 * separate segments, told apart by fill AND pattern (never colour alone), and
 * each one that is not zero is named with its number underneath. When every
 * coin is the child's own, that is said too. The segments come from the
 * server's provenance, never re-derived here.
 *
 * `data-goal-progress` carries the provenance so the release-gate audit
 * (scripts/verify-money-habits.mjs, and the static gate in
 * goalProgressGate.test.ts) can check that every goal bar on a page shows it.
 */

/*
 * S07.6 (D.12): `of` is the reader's register (moneyRegister.ts): it may use
 * {saved}, {target}, {left} (coins still to go) and {pct} (percent reached,
 * the teen register only). The provenance segments never change with age.
 */
export interface GoalProgressCopy { of: string; own: string; bonus: string; family: string; allOwn: string; label: string; /** `{n}` coins still to go; the jar view says it plainly. */ togo?: string }

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function GoalProgress({ copy, title, target, progress, ring = false, compact = false }: { copy: GoalProgressCopy; title: string; target: number; progress: GoalProgressParts; ring?: boolean; compact?: boolean }) {
  const scale = Math.max(target, progress.total, 1);
  const width = (n: number) => `${Math.round((n / scale) * 1000) / 10}%`;
  const parts = [
    { key: 'own' as const, n: progress.own, text: fill(copy.own, { count: progress.own }) },
    { key: 'bonus' as const, n: progress.bonus, text: fill(copy.bonus, { count: progress.bonus }) },
    { key: 'family' as const, n: progress.family, text: fill(copy.family, { count: progress.family }) },
  ];
  const named = parts.filter((p) => p.n > 0);
  const summary = [fill(copy.label, { title, saved: progress.total, target }), ...(named.length === 1 && named[0]!.key === 'own' ? [copy.allOwn] : named.map((p) => p.text))].join('. ');

  const left = Math.max(0, target - progress.total);
  const percent = target > 0 ? Math.min(100, Math.round((progress.total * 100) / target)) : 0;
  const body = <div className="lf-goal-progress" data-goal-progress="provenance" data-own={progress.own} data-bonus={progress.bonus} data-family={progress.family}>
    <div className="lf-goal-progress-bar" role="img" aria-label={summary}>
      {parts.map((p) => p.n > 0 && <span key={p.key} className="lf-goal-progress-part" data-part={p.key} style={{ inlineSize: width(p.n) }} />)}
    </div>
    <div className="lf-goal-progress-legend" data-compact={compact || undefined}>
      <CoinAmount className="lf-goal-progress-total">{fill(copy.of, {
        saved: progress.total, target, left: Math.max(0, target - progress.total), pct: target > 0 ? Math.min(100, Math.floor((progress.total * 100) / target)) : 0,
      })}</CoinAmount>
      {progress.total > 0 && (named.length === 1 && named[0]!.key === 'own'
        ? <span data-copy-role="data" data-legend="own"><span className="lf-goal-progress-key" data-part="own" aria-hidden="true" />{copy.allOwn}</span>
        : named.map((p) => <span key={p.key} data-copy-role="data" data-legend={p.key}>
          <span className="lf-goal-progress-key" data-part={p.key} aria-hidden="true" />{p.text}</span>))}
    </div>
  </div>;
  if (!ring) return body;
  // The ring fills with the goal. It repeats what the bar already says, so it is decorative; the bar and its legend carry provenance.
  return <div className="lf-goal-ringwrap" data-goal-percent={percent} data-reached={progress.total >= target}>
    <div className="lf-goal-ring-row">
      <div className="lf-goal-ring" aria-hidden="true" style={{ ['--pct' as string]: percent }}><span data-copy-role="data">{percent}%</span></div>
      {copy.togo && left > 0 && <span className="lf-goal-togo" data-copy-role="data">{fill(copy.togo, { n: left })}</span>}
    </div>
    {body}
  </div>;
}
