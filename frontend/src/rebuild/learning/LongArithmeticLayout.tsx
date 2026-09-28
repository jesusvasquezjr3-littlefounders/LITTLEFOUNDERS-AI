import type { Locale } from '../design/copyBudget';
import type { LongArithmetic } from './v2SegmentFamilies.generated';
import './longArithmetic.css';

/*
 * M9 (Appendix P Part 1, GAP-FIX-R1): the written algorithm behind a worked
 * example, drawn the way each market writes it, chosen by the lesson's
 * locale profile:
 *   en-US  bracket  divisor left of a bracket, quotient above, every product and remainder written;
 *   es-MX  casita   the same "little house", but only the remainders are written (products are done mentally);
 *   pt-BR  chave    método da chave: dividend left, divisor right inside the key, quotient under the divisor.
 * Long multiplication is written vertically in all three markets. The steps
 * come from the validated document (Core and the browser both check they are
 * the standard algorithm's), and `revealed` shows them one at a time.
 */

export type DivisionLayout = 'bracket' | 'casita' | 'chave';
export function divisionLayoutFor(locale: Locale): DivisionLayout {
  return locale === 'pt-BR' ? 'chave' : locale === 'es-MX' ? 'casita' : 'bracket';
}

const labels: Record<Locale, { division: (a: number, b: number, q: string, r: number) => string; multiplication: (a: number, b: number, p: string) => string }> = {
  'en-US': { division: (a, b, q, r) => `${a} divided by ${b}: quotient ${q}, remainder ${r}.`, multiplication: (a, b, p) => `${a} times ${b} is ${p}.` },
  'es-MX': { division: (a, b, q, r) => `${a} entre ${b}: cociente ${q}, residuo ${r}.`, multiplication: (a, b, p) => `${a} por ${b} es ${p}.` },
  'pt-BR': { division: (a, b, q, r) => `${a} dividido por ${b}: quociente ${q}, resto ${r}.`, multiplication: (a, b, p) => `${a} vezes ${b} é ${p}.` },
};

export function LongArithmeticLayout({ algorithm, locale, revealed }: { algorithm: LongArithmetic; locale: Locale; revealed: number }) {
  const shown = algorithm.steps.slice(0, Math.max(0, Math.min(revealed, algorithm.steps.length)));
  const done = shown.length === algorithm.steps.length;
  if (algorithm.kind === 'long-multiplication') {
    const total = done ? String(algorithm.steps.at(-1)!.remainder) : '?';
    return <div className="lf-long lf-long--multiplication" role="img" aria-label={labels[locale].multiplication(algorithm.multiplicand, algorithm.multiplier, total)} data-layout="vertical">
      <span className="lf-long-row lf-long-operand" data-copy-role="data">{algorithm.multiplicand}</span>
      <span className="lf-long-row lf-long-operand" data-copy-role="data">× {algorithm.multiplier}</span>
      <span className="lf-long-rule" aria-hidden="true" />
      {shown.map((step, index) => <span key={index} className="lf-long-row" data-copy-role="data">{step.product}</span>)}
      {done ? <><span className="lf-long-rule" aria-hidden="true" /><strong className="lf-long-row" data-copy-role="data">{total}</strong></> : null}
    </div>;
  }
  const layout = divisionLayoutFor(locale);
  const quotient = shown.map((step) => step.digit).join('') || '?';
  const remainder = algorithm.steps.at(-1)!.remainder;
  const work = shown.map((step, index) => <div key={index} className="lf-long-step">
    {layout === 'casita' ? null : <span className="lf-long-product" data-copy-role="data">−{step.product}</span>}
    <span className="lf-long-remainder" data-copy-role="data">{step.remainder}</span>
  </div>);
  const label = labels[locale].division(algorithm.dividend, algorithm.divisor, done ? quotient : '?', done ? remainder : 0);
  if (layout === 'chave') {
    return <div className="lf-long lf-long--chave" role="img" aria-label={label} data-layout="chave">
      <div className="lf-long-chave-left"><span className="lf-long-dividend" data-copy-role="data">{algorithm.dividend}</span>{work}</div>
      <div className="lf-long-chave-right"><span className="lf-long-divisor" data-copy-role="data">{algorithm.divisor}</span>
        <span className="lf-long-quotient" data-copy-role="data">{quotient}</span></div>
    </div>;
  }
  return <div className={`lf-long lf-long--${layout}`} role="img" aria-label={label} data-layout={layout}>
    <span className="lf-long-quotient lf-long-quotient--top" data-copy-role="data">{quotient}</span>
    <div className="lf-long-house"><span className="lf-long-divisor" data-copy-role="data">{algorithm.divisor}</span>
      <span className="lf-long-dividend lf-long-dividend--housed" data-copy-role="data">{algorithm.dividend}</span></div>
    <div className="lf-long-work">{work}</div>
  </div>;
}
