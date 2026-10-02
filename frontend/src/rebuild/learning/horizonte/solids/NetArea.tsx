import type { Locale } from '../../../design/copyBudget';
import { MathExpression } from '../../pizarron/MathExpression';
import { surfaceArea } from './net.generated';
import { fill, type SolidsText } from './solidsText';

/** Surface area of the cube the net folds into: six squares of the given edge, written as a sum a screen reader can speak. */
export function NetArea({ t, edge, locale }: { t: SolidsText; edge: number; locale: Locale }) {
  const area = surfaceArea(edge);
  return <p className="lf-net-area">
    <span data-copy-role="data">{t.areaLabel}</span>
    <MathExpression tex={`6 \\times ${edge} \\times ${edge} = ${area}`} spokenText={fill(t.areaSpoken, { edge, area })}
      fallback={`6 × ${edge} × ${edge} = ${area}`} locale={locale} />
    <span data-copy-role="data">{t.areaUnit}</span>
  </p>;
}
