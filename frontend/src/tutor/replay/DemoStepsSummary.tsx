import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TrayDemoStep } from '../types';

/**
 * What the tutor's hands did on the money tray during this beat — a plain
 * sentence, deliberately NOT a re-animated tray (/ORACLE.md §20.8).
 *
 * WHAT IT DOES NOT DO IS THE INTERESTING PART. The blocker is NOT the
 * rendering surface: `ExerciseProps.disabled` already exists and `MoneyTray`
 * already threads it into every button, so a read-only tray needs no second
 * renderer. The blocker is the DATA. `runTrayDemo` replays a delta — "add a
 * 10, take a 20 back out" — against whatever the learner had ALREADY put in
 * the tray, and that starting state is persisted nowhere: `tutor_segments`
 * keeps the payload, score, attempts and XP, never the draft. Replaying from
 * an empty tray would therefore drive `CoinCount`/`MakeChange`'s `TrayTotal`
 * — the largest number on the surface, inside an `aria-live` region — to a
 * figure the learner never saw, and every `remove` step would silently
 * no-op. A confident wrong picture misleads where an absent one merely omits
 * (§1.14), so this states what the steps WERE instead: which denominations
 * were added or removed, in order. A `pause` step has nothing to show and is
 * skipped; if every step were a pause (the schema allows it, nothing authors
 * it) there is nothing to say, and this renders nothing rather than an empty
 * sentence.
 *
 * Lives in its own module rather than inside `ReplayInWorld.tsx` (2026-09-01)
 * so the GUARDIAN transcript viewer can render it too: that surface showed
 * nothing at all for `demonstrate`, even though migration `0067`'s own header
 * says the defect it fixed was losing that fact "on replay AND on the
 * guardian transcript viewer". Importing it from `ReplayInWorld` would have
 * pulled the entire 3D replay world into a plain scrolling transcript page.
 */
export function DemoStepsSummary({ steps }: { steps: TrayDemoStep[] }) {
  const { t, i18n } = useTranslation();
  const format = useMemo(
    () => new Intl.NumberFormat(i18n.language, { signDisplay: 'exceptZero', maximumFractionDigits: 0 }),
    [i18n.language],
  );
  const parts = steps
    .filter((step): step is TrayDemoStep & { denomination: number } => typeof step.denomination === 'number')
    .map((step) => format.format(step.kind === 'remove' ? -step.denomination : step.denomination));
  if (parts.length === 0) return null;
  const list = new Intl.ListFormat(i18n.language, { style: 'short', type: 'conjunction' }).format(parts);
  return <p className="lf-caption text-content-muted">{t('tutor.replay.demonstrated', { steps: list })}</p>;
}
