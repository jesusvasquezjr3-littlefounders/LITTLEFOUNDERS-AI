import type { ReactNode } from 'react';
import { ChoiceChip, type ChipDrag } from '../../../design/controls';
import type { Locale } from '../../../design/copyBudget';
import { MathExpression } from '../../pizarron/MathExpression';
import { readTerm } from './area.generated';

export type Placement = Readonly<Record<string, string>>;

/** A 64 px drag handle: the chip is the object, and tapping it then a place is the pointer path (Move to is the keyboard path). */
export function Handle({ chip, disabled, children }: { chip: { selected: boolean; onToggle: () => void; drag: ChipDrag }; disabled: boolean; children: ReactNode }) {
  return <span className="lf-hz-handle lf-alg-handle" data-hz-handle="" data-hz-hit="64">
    <ChoiceChip {...chip} disabled={disabled}>{children}</ChoiceChip>
  </span>;
}

const plain = (tex: string): string => tex.replace(/\^2/g, '²').replace(/-/g, '−');

/** The problem as KaTeX, named for a screen reader by the author's spokenText. */
export function Notation({ notation, locale }: { notation: { tex: string; spokenText: string }; locale: Locale }) {
  return <p className="lf-alg-notation"><MathExpression tex={notation.tex} spokenText={notation.spokenText} fallback={plain(notation.tex)} locale={locale} block /></p>;
}

/** A term face `degree:coefficient` as the symbols a learner reads: 3x, x², −12. */
export function termText(face: string): string {
  const term = readTerm(face);
  if (!term) return face;
  const sign = term.k < 0 ? '−' : '';
  const magnitude = Math.abs(term.k);
  if (term.d === 0) return `${sign}${magnitude}`;
  return `${sign}${magnitude === 1 ? '' : magnitude}${term.d !== 1 ? 'x²' : 'x'}`;
}

/** The slots a placement fills, as the arrangement answer: a list of piece ids per slot, empty slots left out. */
export function slotsOf(placement: Placement, order: readonly string[]): Record<string, string[]> {
  const slots: Record<string, string[]> = {};
  for (const id of order) (slots[placement[id]!] ??= []).push(id);
  return slots;
}
