import type { GoalProgressParts } from './moneyHabitsApi';
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

export interface GoalProgressCopy { of: string; own: string; bonus: string; family: string; allOwn: string; label: string }

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

export function GoalProgress({ copy, title, target, progress }: { copy: GoalProgressCopy; title: string; target: number; progress: GoalProgressParts }) {
  const scale = Math.max(target, progress.total, 1);
  const width = (n: number) => `${Math.round((n / scale) * 1000) / 10}%`;
  const parts = [
    { key: 'own' as const, n: progress.own, text: fill(copy.own, { count: progress.own }) },
    { key: 'bonus' as const, n: progress.bonus, text: fill(copy.bonus, { count: progress.bonus }) },
    { key: 'family' as const, n: progress.family, text: fill(copy.family, { count: progress.family }) },
  ];
  const named = parts.filter((p) => p.n > 0);
  const summary = [fill(copy.label, { title, saved: progress.total, target }), ...(named.length === 1 && named[0]!.key === 'own' ? [copy.allOwn] : named.map((p) => p.text))].join('. ');

  return <div className="lf-goal-progress" data-goal-progress="provenance" data-own={progress.own} data-bonus={progress.bonus} data-family={progress.family}>
    <div className="lf-goal-progress-bar" role="img" aria-label={summary}>
      {parts.map((p) => p.n > 0 && <span key={p.key} className="lf-goal-progress-part" data-part={p.key} style={{ inlineSize: width(p.n) }} />)}
    </div>
    <div className="lf-goal-progress-legend">
      <span data-copy-role="data" className="lf-goal-progress-total">{fill(copy.of, { saved: progress.total, target })}</span>
      {progress.total > 0 && (named.length === 1 && named[0]!.key === 'own'
        ? <span data-copy-role="data" data-legend="own"><span className="lf-goal-progress-key" data-part="own" aria-hidden="true" />{copy.allOwn}</span>
        : named.map((p) => <span key={p.key} data-copy-role="data" data-legend={p.key}>
          <span className="lf-goal-progress-key" data-part={p.key} aria-hidden="true" />{p.text}</span>))}
    </div>
  </div>;
}
