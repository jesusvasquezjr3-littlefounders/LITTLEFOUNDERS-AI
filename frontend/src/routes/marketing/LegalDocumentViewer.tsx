import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CookiePreferencesButton } from '@/components/CookieConsentBanner';
import { Badge, Card, Button, Icon } from '@/components/ui';

interface LegalDocumentViewerProps {
  doc: 'terms' | 'privacy';
}

const TERM_CLAUSES = [
  'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10',
  'c11', 'c12', 'c13', 'c14', 'c15', 'c16', 'c17', 'c18', 'c19', 'c20'
] as const;

const PRIVACY_SECTIONS = [
  's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'
] as const;

export function LegalDocumentViewer({ doc }: LegalDocumentViewerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isTerms = doc === 'terms';
  const sectionKeys = isTerms ? TERM_CLAUSES : PRIVACY_SECTIONS;
  const prefix = isTerms ? 'terms' : 'privacy';

  // IntersectionObserver to highlight active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 }
    );

    sectionKeys.forEach((key) => {
      const el = document.getElementById(key);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [doc, sectionKeys]);

  const handleCopyLink = (sectionId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${sectionId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(sectionId);
    setTimeout(() => setCopiedId(null), 2000);
  };



  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter clauses by search query
  const filteredSectionKeys = sectionKeys.filter((key) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = t(`marketing.legal.${prefix}.${key}.title`).toLowerCase();
    const p1 = t(`marketing.legal.${prefix}.${key}.p1`).toLowerCase();
    return title.includes(q) || p1.includes(q);
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14">
      {/* Header Banner */}
      <div className="rounded-xl border border-outline bg-surface-sunken/60 p-6 sm:p-10 backdrop-blur-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Badge className="bg-primary-soft text-primary-strong">
                {t('marketing.legal.badge')}
              </Badge>
              <span className="lf-caption text-content-faint">
                {t('marketing.legal.meta.lastUpdated')}
              </span>
            </div>
            <h1 className="lf-display-lg mt-3 text-content">
              {t(`marketing.legal.${prefix}.title`)}
            </h1>
            <p className="lf-body mt-2 max-w-3xl text-content-muted">
              {t(`marketing.legal.${prefix}.subtitle`)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">

          </div>
        </div>

        {/* Legal Entity Card Info */}
        <div className="mt-6 flex flex-col gap-2 rounded-lg border border-outline/60 bg-surface/80 p-4 lf-caption text-content-muted">
          <div className="flex items-center gap-2 font-medium text-content">
            <Icon name="corporate_fare" className="text-primary" />
            <span>{t('marketing.legal.meta.company')}</span>
            <span className="text-content-faint">•</span>
            <span>{t('marketing.legal.meta.officialNotice')}</span>
          </div>
          <p>{t('marketing.legal.meta.address')}</p>
        </div>

        {/* Tab Switcher: Terms vs Privacy */}
        <div className="mt-8 flex border-b border-outline print:hidden">
          <button
            type="button"
            onClick={() => navigate('/legal/terms')}
            className={`lf-label border-b-2 px-6 py-3 transition-colors ${
              isTerms
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            {t('marketing.footer.terms')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/legal/privacy')}
            className={`lf-label border-b-2 px-6 py-3 transition-colors ${
              !isTerms
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-content-muted hover:text-content'
            }`}
          >
            {t('marketing.footer.privacy')}
          </button>
        </div>
      </div>

      {/* Main Layout: Desktop Dual Column (Sticky TOC + Content) / Mobile Single Column */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* TOC Navigation Sidebar (Desktop ≥1024px) */}
        <aside className="lg:col-span-4 print:hidden">
          <div className="sticky top-24 rounded-xl border border-outline bg-surface p-5 shadow-glass-sm">
            <h2 className="lf-title text-content">
              {t('marketing.legal.meta.tocTitle')}
            </h2>

            {/* Real-time Search Input */}
            <div className="relative mt-4">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-content-faint"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('marketing.legal.meta.searchPlaceholder')}
                className="w-full rounded-md border border-outline bg-surface-sunken py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-faint hover:text-content"
                >
                  <Icon name="close" />
                </button>
              )}
            </div>

            {/* Clause Navigation Links */}
            <nav className="mt-4 max-h-[60vh] overflow-y-auto space-y-1 pr-1" aria-label="Document sections">
              {filteredSectionKeys.length === 0 ? (
                <p className="lf-caption p-3 text-content-muted">
                  {t('marketing.legal.meta.noResults')}
                </p>
              ) : (
                filteredSectionKeys.map((key) => {
                  const title = t(`marketing.legal.${prefix}.${key}.title`);
                  const isActive = activeSection === key;
                  return (
                    <a
                      key={key}
                      href={`#${key}`}
                      onClick={() => setActiveSection(key)}
                      className={`block rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-soft text-primary font-bold'
                          : 'text-content-muted hover:bg-surface-sunken hover:text-content'
                      }`}
                    >
                      {title}
                    </a>
                  );
                })
              )}
            </nav>

            <div className="mt-6 border-t border-outline pt-4">
              <button
                type="button"
                onClick={scrollToTop}
                className="flex w-full items-center justify-center gap-2 rounded-md py-2 lf-caption text-content-muted hover:bg-surface-sunken hover:text-content"
              >
                <Icon name="arrow_upward" />
                <span>{t('marketing.legal.meta.backToTop')}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Content Body */}
        <main className="lg:col-span-8 space-y-6">
          {/* Preamble Card */}
          <Card className="border-l-4 border-l-primary bg-surface p-6">
            <p className="lf-body text-content-muted leading-relaxed">
              {t(`marketing.legal.${prefix}.preamble`)}
            </p>
          </Card>

          {/* Clauses / Sections List */}
          {filteredSectionKeys.length === 0 ? (
            <Card className="p-8 text-center">
              <Icon name="search_off" className="mx-auto text-content-faint" />
              <p className="lf-body mt-4 text-content-muted">
                {t('marketing.legal.meta.noResults')}
              </p>
            </Card>
          ) : (
            filteredSectionKeys.map((key) => {
              const title = t(`marketing.legal.${prefix}.${key}.title`);
              const p1 = t(`marketing.legal.${prefix}.${key}.p1`);

              // Optional p2 & p3
              const hasP2 = isTerms ? ['c2', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c13'].includes(key) : ['s2', 's3', 's5'].includes(key);
              const hasP3 = isTerms ? ['c2', 'c8'].includes(key) : false;

              const p2 = hasP2 ? t(`marketing.legal.${prefix}.${key}.p2`) : null;
              const p3 = hasP3 ? t(`marketing.legal.${prefix}.${key}.p3`) : null;

              // Defined items for c1 & c3
              const isC1 = isTerms && key === 'c1';
              const isC3 = isTerms && key === 'c3';

              return (
                <section
                  key={key}
                  id={key}
                  className="scroll-mt-28 rounded-xl border border-outline bg-surface p-6 shadow-glass-sm transition-shadow hover:shadow-glass"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="lf-headline text-content">{title}</h2>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(key)}
                      title={t('marketing.legal.meta.copyLink')}
                      className="print:hidden text-content-faint hover:text-primary transition-colors"
                      aria-label={`${t('marketing.legal.meta.copyLink')} - ${title}`}
                    >
                      <Icon
                        name={copiedId === key ? 'check' : 'link'}
                        className={copiedId === key ? 'text-success' : ''}
                      />
                    </button>
                  </div>

                  <p className="lf-body mt-4 text-content-muted leading-relaxed">
                    {p1}
                  </p>

                  {/* Render C1 definitions list if present */}
                  {isC1 && (
                    <ul className="mt-4 space-y-2 rounded-md bg-surface-sunken p-4 text-sm text-content-muted">
                      <li>• <strong>{t('marketing.legal.terms.c1.items.child')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c1.items.tutor')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c1.items.content')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c1.items.ai')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c1.items.platform')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c1.items.services')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c1.items.user')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c1.items.childUser')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c1.items.tutorUser')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c1.items.universalUser')}</strong></li>
                    </ul>
                  )}

                  {/* Render C3 user types list if present */}
                  {isC3 && (
                    <ul className="mt-4 space-y-2 rounded-md bg-surface-sunken p-4 text-sm text-content-muted">
                      <li>• <strong>{t('marketing.legal.terms.c3.items.universal')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c3.items.tutor')}</strong></li>
                      <li>• <strong>{t('marketing.legal.terms.c3.items.child')}</strong></li>
                    </ul>
                  )}

                  {p2 && (
                    <p className="lf-body mt-3 text-content-muted leading-relaxed">
                      {p2}
                    </p>
                  )}

                  {p3 && (
                    <p className="lf-body mt-3 text-content-muted leading-relaxed">
                      {p3}
                    </p>
                  )}
                </section>
              );
            })
          )}

          {/* Privacy Cookie Controls & Contact Footer */}
          {!isTerms && (
            <section id="cookie-controls" className="rounded-xl border border-primary-soft bg-primary-soft/20 p-6">
              <h2 className="lf-headline text-content">
                {t('marketing.legal.privacy.cookiesTitle')}
              </h2>
              <p className="lf-body mt-2 text-content-muted">
                {t('marketing.legal.privacy.cookiesBody')}
              </p>
              <h3 className="lf-title mt-6 text-content">
                {t('marketing.legal.privacy.controlsTitle')}
              </h3>
              <p className="lf-body mt-2 text-content-muted">
                {t('marketing.legal.privacy.controlsBody')}
              </p>
              <div className="mt-6">
                <CookiePreferencesButton className="bg-primary text-on-primary hover:bg-primary-strong" />
              </div>
            </section>
          )}

          {/* Contact Box */}
          <Card className="bg-surface-sunken p-6 text-center">
            <h3 className="lf-title text-content">
              {t('marketing.legal.privacy.contactTitle')}
            </h3>
            <p className="lf-body mt-2 text-content-muted">
              {t('marketing.legal.body')}
            </p>
            <a
              href={`mailto:${t('marketing.legal.meta.email')}`}
              className="lf-label mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-on-primary hover:bg-primary-strong transition-colors"
            >
              <Icon name="mail" />
              <span>{t('marketing.legal.meta.email')}</span>
            </a>
          </Card>
        </main>
      </div>
    </div>
  );
}
