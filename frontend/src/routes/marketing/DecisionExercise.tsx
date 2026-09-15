import { useState, type ReactNode } from 'react';
import { OptionCard, SunkenWell, type OptionVisualState } from '@/lesson-engine/core/primitives';

/*
 * Shared by /how-it-works and /families: a scenario, a set of options with
 * equal weight, and a consequence that only appears once one is picked. It is
 * built from the SAME primitives a real lesson's `best_decision` exercise
 * uses (`OptionCard`, `SunkenWell`) rather than a marketing-only look-alike,
 * so tapping this card is not a metaphor for the product — it is the product's
 * own answer control, fed marketing content.
 *
 * No option ever carries `state: 'correct' | 'wrong'`. Every scenario here
 * exists to show that a choice has a DIFFERENT consequence, never a right one
 * — the same invariant /how-it-works' original static card documented.
 * Selecting is free: picking the other option swaps the reveal in place, so a
 * visitor can compare both without a reset control.
 */

export interface DecisionOption {
  id: string;
  label: ReactNode;
  consequence: ReactNode;
}

export function DecisionExercise({
  scenario,
  options,
  ariaLabel,
  prompt,
  className,
  optionsClassName,
}: {
  /** Optional scenario/prompt shown in a sunken well above the options. */
  scenario?: ReactNode;
  options: DecisionOption[];
  /** Accessible name for the radiogroup (read once, not per option). */
  ariaLabel: string;
  /** Shown in the reveal slot before any option is picked. */
  prompt: ReactNode;
  className?: string;
  /** Overrides the radiogroup wrapper's layout (default: a vertical stack). */
  optionsClassName?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active = options.find((option) => option.id === selectedId) ?? null;

  return (
    <div className={className}>
      {scenario ? <SunkenWell className="mb-4">{scenario}</SunkenWell> : null}
      <div className={optionsClassName ?? "space-y-3"} role="radiogroup" aria-label={ariaLabel}>
        {options.map((option) => (
          <OptionCard
            key={option.id}
            role="radio"
            ariaChecked={selectedId === option.id}
            state={(selectedId === option.id ? 'selected' : 'idle') satisfies OptionVisualState}
            onSelect={() => setSelectedId(option.id)}
          >
            {option.label}
          </OptionCard>
        ))}
      </div>
      {/* `min-h` holds the layout still when the reveal grows a line longer
          than the prompt it replaces. `aria-live` announces the swap for a
          screen reader without moving focus off the option just chosen. */}
      <p className="lf-body mt-4 min-h-[3lh] text-content-muted sm:min-h-[1.5lh]" role="status" aria-live="polite">
        {active ? active.consequence : prompt}
      </p>
    </div>
  );
}
