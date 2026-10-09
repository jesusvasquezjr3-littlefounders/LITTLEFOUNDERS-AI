import { useEffect, useId, useRef, useState } from 'react';
import { Art, SEED_ASSET_ID } from '../../design/display';
import type { Locale } from '../../design/copyBudget';
import { ProblemVideo } from './ProblemVideo';
import { siteCopy } from '../blocks';
import './problem.css';

/*
 * Landing section 2 (owner brief, 2026-10-07, rebuilt for the third time): the problem, told as one chain and shown, not only said.
 * The habits with money form in childhood (Cambridge); yet many reach adulthood without having learned, and a row of ten seeds shows
 * how many, in the visitor's own country (S&P Global FinLit Survey; each language shows its own country's figure, never another's):
 * the ones who do not understand fade out one by one as the section arrives; so a child can practice today. Liruf and Dina, in a looping video
 * of the real 3D models with seeds and things about learning circling them (the hero's method), fade into the page, so they are not in a frame. One footnote
 * names the sources. It follows the hero's promise and leads into "how they practice". Every number is published, never ours.
 */
const PIPS = 10;

export function ProblemSection({ locale }: { locale: Locale }) {
  const l = siteCopy(locale).landingV2;
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = root.current;
    if (!element || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const watch = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setSeen(true); watch.disconnect(); } }, { threshold: 0.35 });
    watch.observe(element);
    return () => watch.disconnect();
  }, []);
  return <section ref={root} className="lf-problem" data-section data-layout="problem" data-seen={seen} aria-labelledby={`${id}-title`}>
    <div className="lf-problem-copy">
      <h2 id={`${id}-title`} data-copy-role="heading"><strong className="lf-problem-big" data-copy-role="data">{l.problemBig}</strong><span className="lf-problem-title">{l.problemTitle}</span></h2>
      <div className="lf-problem-evidence">
        <p className="lf-problem-link" data-copy-role="body">{l.problemLink}</p>
        <div className="lf-problem-proof">
          <div className="lf-problem-chart" role="img" aria-label={`${l.problemFigure} ${l.problemFact}`}>
            {Array.from({ length: PIPS }, (_, index) => <span key={index} className="lf-problem-pip" data-lost={index >= PIPS - l.problemLost} style={{ ['--i' as string]: index - (PIPS - l.problemLost) }}><Art assetId={SEED_ASSET_ID} /></span>)}
          </div>
          <p className="lf-problem-fact" data-copy-role="body"><strong data-copy-role="data">{l.problemFigure}</strong> {l.problemFact}</p>
        </div>
      </div>
      <p className="lf-problem-bridge" data-copy-role="body">{l.problemBridge}</p>
      <p className="lf-problem-sources" data-copy-role="data">{l.problemSources}</p>
    </div>
    <div className="lf-problem-figure" aria-hidden="true">
      <ProblemVideo className="lf-problem-video" />
    </div>
  </section>;
}
