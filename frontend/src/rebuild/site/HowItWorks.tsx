import type { Locale } from '../design/copyBudget';
import { DecisionDemo, MentorCast, SiteHero, SiteSection, StartButton, siteCopy, type Navigate, type StartAction } from './blocks';

/*
 * M2, How it works, rebuilt on the public-site shell (W2 Lane 1).
 *
 * It explains the mechanism the landing page promises: a lesson is a
 * decision with a consequence, four Mentors answer back, and a visitor can
 * start without an account. The decision is live: the visitor picks, the
 * consequence appears, and neither choice is marked right or wrong (the same
 * rule the lesson engine's decision exercises follow). The demo uses the
 * shared "choose one" control, so it is the product's own control.
 *
 * Legacy content not carried over: the interactive concept graph (decorative,
 * and its copy described pedagogy the pages do not otherwise back) and the
 * stock photograph in the closing band (07).
 */
export function HowItWorks({ locale, start, onNavigate }: { locale: Locale; start: StartAction; onNavigate?: Navigate }) {
  const copy = siteCopy(locale);
  const h = copy.howItWorks;
  return <div className="lf-site-page" data-screen="how-it-works">
    <SiteHero>
      <h1 data-copy-role="heading">{h.title}</h1>
      <p className="lf-site-lead" data-copy-role="body">{h.lead}</p>
      <div className="lf-site-cta-row"><StartButton action={start} copy={copy.site} onNavigate={onNavigate} origin="how-hero" breathing /></div>
    </SiteHero>

    <SiteSection tone="default" heading={h.demoTitle}>
      <DecisionDemo name="how-decision" question={h.demoQuestion} prompt={copy.site.pickOne} options={[
        { value: 'candy', label: h.optionCandy, consequence: h.consequenceCandy },
        { value: 'bike', label: h.optionBike, consequence: h.consequenceBike },
      ]} />
    </SiteSection>

    <SiteSection tone="tight" heading={h.mentorsTitle} split="start">
      <div className="lf-site-split-copy"><p data-copy-role="body">{h.mentorsBody}</p></div>
      <MentorCast label={copy.site.mentorsLabel} size="md" />
    </SiteSection>

    <SiteSection tone="band" heading={h.guestTitle}>
      <p data-copy-role="body">{h.guestBody}</p>
    </SiteSection>

    <SiteSection tone="default" heading={h.closingTitle} className="lf-site-closing">
      <p data-copy-role="body">{h.closingBody}</p>
      <div className="lf-site-cta-row"><StartButton action={start} copy={copy.site} onNavigate={onNavigate} origin="how-closing" size="md" /></div>
    </SiteSection>
  </div>;
}
