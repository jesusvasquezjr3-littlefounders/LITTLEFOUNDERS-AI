import { useId } from 'react';
import { Button, ButtonLink, InlineNotice } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import { follow, siteCopy, type Navigate, type StartAction, type TutorAction } from '../blocks';
import { HeroVideo } from './HeroVideo';
import './hero.css';

/*
 * Landing section 1 (owner brief, 2026-10-06, revised after review): a split
 * hero. The message takes one half and a looping video of the Mentors the
 * other, both inside the site container.
 */
const ORIGIN = 'landing-hero-learn';

export function Hero({ locale, start, tutor, onNavigate, onSecondary }: {
  locale: Locale; start: StartAction; tutor: TutorAction; onNavigate?: Navigate; onSecondary?: () => void;
}) {
  const copy = siteCopy(locale), l = copy.landingV2, titleId = useId();
  const parentHref = tutor.kind === 'visitor' ? '/signup?intent=tutor' : tutor.kind === 'parent' ? '/family' : tutor.href;
  const parentFollow = tutor.kind === 'visitor' ? tutor.onFollow : undefined;
  return <section className="lf-hero" data-section data-layout="hero" aria-labelledby={titleId}>
    <div className="lf-hero-copy">
      <h1 id={titleId} data-copy-role="brand">{l.title}{' '}<span>{l.titleAccent}</span></h1>
      <p className="lf-hero-lead" data-copy-role="body">{l.lead}</p>
      <div className="lf-hero-actions">
        <ButtonLink variant="accent" size="lg" href={parentHref} data-cta="become-tutor" data-origin="landing-hero"
          onClick={follow(parentHref, onNavigate, parentFollow)}>{l.heroParent}</ButtonLink>
        {start.kind === 'continue'
          ? <ButtonLink variant="secondary" size="lg" className="lf-hero-learn" href={start.href} data-cta="continue" onClick={follow(start.href, onNavigate, start.onFollow)}>{l.heroLearn}</ButtonLink>
          : <Button variant="secondary" size="lg" className="lf-hero-learn" data-cta="start-free" data-origin={ORIGIN}
            pending={start.pending === ORIGIN} pendingLabel={copy.site.starting} disabled={start.pending !== null && start.pending !== ORIGIN}
            onClick={() => { onSecondary?.(); start.onStart(ORIGIN); }}>{l.heroLearn}</Button>}
      </div>
      {start.kind === 'guest' && start.failed === ORIGIN ? <InlineNotice tone="error" live>{copy.site.startError}</InlineNotice> : null}
    </div>
    <div className="lf-hero-stage" role="img" aria-label={l.heroSceneAlt}>
      <HeroVideo />
    </div>
  </section>;
}
