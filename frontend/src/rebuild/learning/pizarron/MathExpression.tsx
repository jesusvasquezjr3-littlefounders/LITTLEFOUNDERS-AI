import { useEffect, useState } from 'react';
import type { Locale } from '../../design/copyBudget';

/*
 * Bible 05 §5 and Appendix P Parts 5-6 (GAP-FIX-R2): mathematical notation is
 * rendered with KaTeX, loaded only when a board actually shows notation (a
 * document that declares `visual.math-notation.v1`). The TeX is authored
 * locale-neutral with '.' decimals; pt-BR writes the decimal comma, which
 * KaTeX needs as '{,}' so it is not spaced as a list separator. KaTeX's HTML is
 * aria-hidden and the author-written spokenText is the accessible name; until
 * KaTeX has loaded (or if it cannot load) the plain expression shows instead.
 */

type Katex = { renderToString: (tex: string, options: Record<string, unknown>) => string };
let katexLoad: Promise<Katex> | null = null;
function loadKatex(): Promise<Katex> {
  katexLoad ??= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([module]) => (module.default ?? module) as unknown as Katex);
  return katexLoad;
}

/** The TeX a locale reads: pt-BR's decimal comma as '{,}' (Appendix P Part 5). */
export function localizeTex(tex: string, locale: Locale): string {
  return locale === 'pt-BR' ? tex.replace(/(\d)\.(\d)/g, '$1{,}$2') : tex;
}

/** KaTeX options: no trust (no links, no raw HTML), a hard size and macro-expansion cap, and never a thrown error. */
export const KATEX_OPTIONS = { throwOnError: false, trust: false, strict: 'ignore', maxSize: 10, maxExpand: 50, output: 'html' } as const;

export function MathExpression({ tex, spokenText, fallback, locale, block = false }: {
  tex: string; spokenText: string; fallback: string; locale: Locale; block?: boolean;
}) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadKatex().then((katex) => { if (live) setHtml(katex.renderToString(localizeTex(tex, locale), { ...KATEX_OPTIONS, displayMode: block })); })
      .catch(() => { if (live) setHtml(null); });
    return () => { live = false; };
  }, [tex, locale, block]);
  return <span className={`lf-math${block ? ' lf-math--block' : ''}`} role="img" aria-label={spokenText} data-copy-role="data" data-pizarron="math-expression">
    {html === null ? <span aria-hidden="true" className="lf-math-fallback">{fallback}</span>
      // KaTeX's own output for whitelisted TeX (texProblem) with trust off; never learner text.
      : <span aria-hidden="true" className="lf-math-katex" dangerouslySetInnerHTML={{ __html: html }} />}
  </span>;
}
