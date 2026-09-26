import { useId, useState } from 'react';
import { Button, EmptyState, Pill, TextField } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { SiteLink, SiteSection, follow, siteCopy, type Navigate } from './blocks';
import { legalDocument, matchingSections, type LegalDoc } from './legalContent';

/*
 * M5 (Terms and Conditions) and M6 (Privacy Notice), rebuilt on the
 * public-site shell (W2 Lane 1).
 *
 * The document text is Legal's and is shown whole (`legal` copy, 06 §3.3);
 * the page around it is budgeted interface copy. What a reader can do, as
 * before: switch between the two documents, jump to a clause from the
 * contents (each clause keeps its address, `#c3`, `#s2`, so a shared link
 * still lands), search the clauses, and from the Privacy Notice open the
 * cookie preferences (M8). The language is the site footer's. The legacy
 * copy-link, print and back-to-top buttons are gone: the clause address is in
 * the contents link, and the browser prints and scrolls on its own.
 *
 * Layout (03 §3.3): one reading column on phones; from an 840 px container
 * the contents sit beside the text, 1:2, and stay in view while reading.
 */
export function LegalDocumentPage({ locale, doc, onNavigate, onOpenCookies }: {
  locale: Locale; doc: LegalDoc; onNavigate?: Navigate; onOpenCookies: () => void;
}) {
  const copy = siteCopy(locale).legalPage;
  const document = legalDocument(locale, doc);
  const [query, setQuery] = useState('');
  const contentsHeading = useId();
  const sections = matchingSections(document.sections, query);
  const docs: [LegalDoc, string, string][] = [['terms', '/legal/terms', copy.terms], ['privacy', '/legal/privacy', copy.privacy]];
  return <div className="lf-site-page lf-legal" data-screen={`legal-${doc}`}>
    <section className="lf-legal-head" data-section>
      <Pill tone="primary">{copy.official}</Pill>
      <h1 data-copy-role="legal">{document.title}</h1>
      <p className="lf-site-lead" data-copy-role="legal">{document.subtitle}</p>
      <p className="lf-legal-meta" data-copy-role="legal">{document.lastUpdated}</p>
      <p className="lf-legal-meta" data-copy-role="legal">{document.company}. {document.officialNotice}</p>
      <p className="lf-legal-meta" data-copy-role="legal">{document.address}</p>
      <nav className="lf-site-cta-row lf-legal-switch" aria-label={copy.documents}>
        {docs.map(([id, href, label]) => <a key={id} href={href} aria-current={id === doc ? 'page' : undefined}
          className={`lf-button lf-button--${id === doc ? 'brand' : 'secondary'} lf-button--sm lf-button-link`} data-copy-role="action"
          onClick={follow(href, onNavigate)}>{label}</a>)}
      </nav>
    </section>

    <div className="lf-legal-layout">
      <nav className="lf-legal-contents" aria-labelledby={contentsHeading}>
        <h2 id={contentsHeading} data-copy-role="heading">{copy.contents}</h2>
        <TextField type="search" label={copy.search} value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
        {sections.length ? <ol className="lf-legal-toc">
          {sections.map((section) => <li key={section.id}><a href={`#${section.id}`} data-copy-role="legal">{section.title}</a></li>)}
        </ol> : null}
      </nav>

      <div className="lf-legal-body">
        <p className="lf-legal-preamble" data-copy-role="legal">{document.preamble}</p>
        {sections.length === 0 ? <EmptyState heading={copy.noResults} /> : sections.map((section) => <section key={section.id} id={section.id}
          className="lf-legal-clause" aria-labelledby={`${section.id}-title`}>
          <h2 id={`${section.id}-title`} data-copy-role="legal">{section.title}</h2>
          {section.paragraphs.map((paragraph, index) => <p key={index} data-copy-role="legal">{paragraph}</p>)}
        </section>)}

        {document.privacyExtras ? <SiteSection tone="soft" className="lf-legal-cookies">
          <h2 data-copy-role="legal">{document.privacyExtras.cookiesTitle}</h2>
          <p data-copy-role="legal">{document.privacyExtras.cookiesBody}</p>
          <h3 data-copy-role="legal">{document.privacyExtras.controlsTitle}</h3>
          <p data-copy-role="legal">{document.privacyExtras.controlsBody}</p>
          <div className="lf-site-cta-row"><Button size="sm" data-open="cookie-preferences" onClick={onOpenCookies}>{copy.cookieSettings}</Button></div>
        </SiteSection> : null}

        <SiteSection tone="tight" className="lf-legal-contact">
          <p data-copy-role="legal">{document.privacyExtras?.contactBody ?? document.contact}</p>
          <div className="lf-site-cta-row">
            <SiteLink href={`mailto:${document.email}`}><span className="ugc" data-copy-role="data">{document.email}</span></SiteLink>
          </div>
        </SiteSection>
      </div>
    </div>
  </div>;
}
