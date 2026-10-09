import { useId } from 'react';
import { Button } from '../../design/buttons';
import type { Locale } from '../../design/copyBudget';
import { siteCopy, type StartAction, type TutorAction } from '../blocks';
import { HeroVideo } from './HeroVideo';
import './hero.css';

/*
 * Landing section 1 (owner brief, 2026-10-06, revised after review): a split
 * hero. The message takes one half and a looping video of the Mentors the
 * other, both inside the site container.
 */
const ORIGIN = 'landing-hero-learn';

export function Hero({ locale, start, tutor }: { locale: Locale; start: StartAction; tutor: TutorAction }) {
  const copy = siteCopy(locale), l = copy.landingV2, titleId = useId();
  return <section className="lf-hero" data-section data-layout="hero" aria-labelledby={titleId}>
    <div className="lf-hero-copy">
      <h1 id={titleId} data-copy-role="brand">{l.title}{' '}<span>{l.titleAccent}</span></h1>
      <p className="lf-hero-lead" data-copy-role="body">{l.lead}</p>
      <div className="lf-hero-actions">
        <Button variant="accent" size="lg" data-cta="become-tutor" data-origin="landing-hero" onClick={tutor.onStart}>{l.heroParent}</Button>
        <Button variant="secondary" size="lg" className="lf-hero-learn" data-cta="start-free" data-origin={ORIGIN}
          onClick={() => start.onStart(ORIGIN)}>{l.heroLearn}</Button>
      </div>
    </div>
    <div className="lf-hero-stage" role="img" aria-label={l.heroSceneAlt}>
      <HeroVideo />
    </div>
  </section>;
}
