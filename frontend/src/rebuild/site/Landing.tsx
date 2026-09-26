import type { Locale } from '../design/copyBudget';
import { MentorCast, SiteHero, SiteLink, SiteSection, StartButton, siteCopy, type Navigate, type StartAction } from './blocks';

/*
 * M1, the landing page, rebuilt on the public-site shell (W2 Lane 1).
 *
 * The parent is the hero (brand Law 1, mockup K36): the headline and its
 * second line are the brand narrative's own short form, and the family band
 * carries the brand call to action "Become your child's Tutor" (OD-6). The
 * visitor's action is "Start free": a guest session, no sign-up (OD-5 allows
 * "free to start", never "always free"). Every claim is one the product backs
 * (A.1, Law 5): the decision lesson, the four Mentors a learner chooses from,
 * the Tutor's view of every Mentor conversation.
 *
 * What the legacy page had and this one does not: the looping diorama video
 * and the stock photographs (07: no stock art; the hero is the real-model
 * Mentor renders), the explorable concept graph (decoration, and it moved
 * three idle loops onto one screen, 02 §9.4), and the "Free to stay" line
 * (OD-5). The one sourced statistic stays, with its source.
 */
export function Landing({ locale, start, onNavigate, onSecondary }: { locale: Locale; start: StartAction; onNavigate?: Navigate; onSecondary?: () => void }) {
  const copy = siteCopy(locale);
  const l = copy.landing;
  return <div className="lf-site-page" data-screen="landing">
    <SiteHero art={<MentorCast label={copy.site.mentorsLabel} />}>
      <h1 data-copy-role="brand">{l.title}</h1>
      <p className="lf-site-lead" data-copy-role="brand">{l.lead}</p>
      <div className="lf-site-cta-row">
        <StartButton action={start} copy={copy.site} onNavigate={onNavigate} origin="landing-hero" breathing />
        {start.kind === 'guest' ? <SiteLink href="/login" size="md" onNavigate={onNavigate} onFollow={onSecondary} data-cta="secondary">{copy.site.login}</SiteLink> : null}
      </div>
      <p className="lf-site-note" data-copy-role="body">{l.note}</p>
    </SiteHero>

    <SiteSection tone="tight" heading={l.mentorsTitle}>
      <p data-copy-role="body">{l.mentorsBody}</p>
    </SiteSection>

    <SiteSection tone="soft" className="lf-site-fact">
      <div className="lf-site-fact-row">
        <p className="lf-site-fact-value" data-copy-role="data">{l.factValue}</p>
        <p className="lf-site-fact-body" data-copy-role="body">{l.factBody}</p>
      </div>
      <p className="lf-site-source" data-copy-role="body">{l.factSource}</p>
    </SiteSection>

    <SiteSection tone="loose" heading={l.decideTitle}>
      <p data-copy-role="body">{l.decideBody}</p>
      <SiteLink href="/how-it-works" onNavigate={onNavigate}>{l.decideAction}</SiteLink>
    </SiteSection>

    <SiteSection tone="band" heading={l.familyTitle}>
      <p data-copy-role="body">{l.familyBody}</p>
      <SiteLink href="/families" variant="inverse" size="md" onNavigate={onNavigate}>{l.familyAction}</SiteLink>
    </SiteSection>

    <SiteSection tone="default" heading={l.closingTitle} className="lf-site-closing">
      <p data-copy-role="body">{l.closingBody}</p>
      <div className="lf-site-cta-row">
        <StartButton action={start} copy={copy.site} onNavigate={onNavigate} origin="landing-closing" size="md" />
      </div>
    </SiteSection>
  </div>;
}

