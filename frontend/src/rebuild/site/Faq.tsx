import { useState } from 'react';
import { ChipGroup, ChoiceChip, Disclosure } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { SiteHero, SiteLink, SiteSection, TutorButton, siteCopy, type Navigate, type TutorAction } from './blocks';
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqCategory } from './faqItems';

/*
 * M4, the FAQ, rebuilt on the public-site shell (W2 Lane 1).
 *
 * A scannable reference, not a persuasion arc: a topic filter, then each
 * question as a disclosure (a button that says whether it is open and which
 * answer it controls). Several may be open at once; filtering keeps what is
 * open. Every answer states a working feature (A.1, Law 5) and fits the site
 * copy budget (06 §3.2: 25 words, 2 sentences), and the answers the gates
 * hold to the code are listed in `faqItems.ts`. A question's own address
 * (`/faq#deleteAccount`) opens it, so a support reply can link one answer.
 */

const CONTACT_EMAIL = 'informame@littlefounders.ai';

function initialOpen(): Set<string> {
  const hash = typeof window === 'undefined' ? '' : decodeURIComponent(window.location.hash.slice(1));
  return new Set(FAQ_ITEMS.some((item) => item.id === hash) ? [hash] : []);
}

export function Faq({ locale, tutor, onNavigate }: { locale: Locale; tutor: TutorAction; onNavigate?: Navigate }) {
  const copy = siteCopy(locale);
  const q = copy.faq;
  const [filter, setFilter] = useState<FaqCategory | 'all'>('all');
  const [open, setOpen] = useState<Set<string>>(initialOpen);
  const toggle = (id: string) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const shown = FAQ_ITEMS.filter((item) => filter === 'all' || item.category === filter);
  return <div className="lf-site-page" data-screen="faq">
    <SiteHero>
      <h1 data-copy-role="heading">{q.title}</h1>
      <p className="lf-site-lead" data-copy-role="body">{q.lead}</p>
    </SiteHero>

    <SiteSection tone="tight" className="lf-faq">
      <ChipGroup label={q.filterLabel}>
        <ChoiceChip selected={filter === 'all'} onToggle={() => setFilter('all')}>{q.all}</ChoiceChip>
        {FAQ_CATEGORIES.map((category) => <ChoiceChip key={category} selected={filter === category} onToggle={() => setFilter(category)}>
          {q.categories[category]}
        </ChoiceChip>)}
      </ChipGroup>
      <ul className="lf-faq-list" data-faq-filter={filter}>
        {shown.map(({ id, category }) => {
          const item = q.items[id as keyof typeof q.items];
          return <li key={id} id={id} className="lf-faq-item" data-faq-item={id} data-category={category}>
            <Disclosure summary={item.question} open={open.has(id)} onToggle={() => toggle(id)}>
              <p data-copy-role="body">{item.answer}</p>
            </Disclosure>
          </li>;
        })}
      </ul>
    </SiteSection>

    <SiteSection tone="band" heading={q.closingTitle}>
      <p data-copy-role="body">{q.closingBody}</p>
      <div className="lf-site-cta-row">
        <SiteLink href={`mailto:${CONTACT_EMAIL}`} variant="inverse" size="md">{q.emailUs}</SiteLink>
      </div>
    </SiteSection>

    <SiteSection tone="default" className="lf-site-closing">
      <div className="lf-site-cta-row"><TutorButton action={tutor} copy={copy.site} onNavigate={onNavigate} /></div>
    </SiteSection>
  </div>;
}
