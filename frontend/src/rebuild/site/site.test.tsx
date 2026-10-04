import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RebuildRoot } from '../design/controls';
import { MENTOR_NAMES } from '../design/assets';
import type { Locale } from '../design/copyBudget';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import { Landing } from './Landing';
import { HowItWorks } from './HowItWorks';
import { Families } from './Families';
import { Faq } from './Faq';
import { LegalDocumentPage } from './LegalDocumentPage';
import { CookieConsent } from './CookieConsent';
import { BadgeLanding, type BadgePayload } from './BadgeLanding';
import { FAQ_ITEMS } from './faqItems';
import { legalDocument, matchingSections } from './legalContent';
import type { StartAction } from './blocks';

/*
 * The rebuilt public site (M1–M6, M8; W2 Lane 1): behaviour, states and the
 * SPEC's mechanical rules each surface must hold on its own.
 */

const copy = (locale: Locale = 'en-US') => rebuildNamespaceCopy[locale].site;
const inRoot = (node: ReactNode, theme: 'light' | 'dark' = 'light', locale: Locale = 'en-US') => render(<RebuildRoot theme={theme} locale={locale}>{node}</RebuildRoot>);
const guest = (over: Partial<Extract<StartAction, { kind: 'guest' }>> = {}): StartAction => ({ kind: 'guest', pending: null, failed: null, onStart: vi.fn(), ...over });

/** 02 rule 19: every visible string sits inside an element that declares its copy role. */
function undeclaredText(container: HTMLElement): string[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const found: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const host = node.parentElement;
    if (!/\p{L}/u.test(node.textContent ?? '') || !host || host.closest('[aria-hidden="true"], [hidden]')) continue;
    if (!host.closest('[data-copy-role]')) found.push(node.textContent!.trim());
  }
  return found;
}

describe('Landing (M1)', () => {
  it('leads with the brand line and starts a guest session from the button that was pressed', () => {
    const onStart = vi.fn();
    const { container } = inRoot(<Landing locale="en-US" start={guest({ onStart })} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy().landingV2.title);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    const buttons = screen.getAllByRole('button', { name: copy().site.startFree });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]!);
    expect(onStart).toHaveBeenCalledWith('landing-hero');
    expect(screen.getByRole('link', { name: copy().landingV2.tryAction })).toHaveAttribute('href', expect.stringContaining('-learn'));
    expect(undeclaredText(container)).toEqual([]);
  });

  it('shows the pending state and a failure only beside the button that started it', () => {
    const { rerender } = inRoot(<Landing locale="en-US" start={guest({ pending: 'landing-closing' })} />);
    expect(screen.getByRole('button', { name: copy().site.starting })).toHaveAttribute('aria-busy', 'true');
    rerender(<RebuildRoot theme="light" locale="en-US"><Landing locale="en-US" start={guest({ failed: 'landing-hero' })} /></RebuildRoot>);
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(copy().site.startError);
  });

  it('sends a signed-in visitor back to the app instead of starting a guest session', () => {
    inRoot(<Landing locale="en-US" start={{ kind: 'continue', href: '/learn' }} />);
    expect(screen.queryByRole('button', { name: copy().site.startFree })).toBeNull();
    for (const link of screen.getAllByRole('link', { name: copy().site.continue })) expect(link).toHaveAttribute('href', '/learn');
    expect(screen.queryByRole('link', { name: copy().site.login })).toBeNull();
  });

  it('shows the four Mentors as renders of their real models, named by the manifest (02 rule 21)', () => {
    const { container } = inRoot(<Landing locale="pt-BR" start={guest()} />, 'dark', 'pt-BR');
    const cast = within(screen.getByRole('list', { name: copy('pt-BR').site.mentorsLabel }));
    for (const name of Object.values(MENTOR_NAMES)) expect(cast.getByText(name)).toBeInTheDocument();
    const renders = [...container.querySelectorAll<HTMLImageElement>('[data-slot="mentor-avatar"] img')];
    expect(renders.map((img) => img.dataset.character).sort()).toEqual(['dina', 'liruf', 'rho', 'zara']);
    for (const img of renders) expect(img.getAttribute('src')).toMatch(/-dark\.png$/);
  });

  it('keeps one breathing call to action and at most one accent in the page body besides the closing one', () => {
    const { container } = inRoot(<Landing locale="en-US" start={guest()} />);
    expect(container.querySelectorAll('[data-idle-motion="breathing-cta"]').length).toBeLessThanOrEqual(1);
    expect(container.querySelectorAll('.lf-button--accent').length).toBe(2);
  });
});

describe('How it works (M2)', () => {
  it('shows a decision whose consequence appears on a pick and swaps in place, never marked right or wrong', () => {
    const { container } = inRoot(<HowItWorks locale="es-MX" start={guest()} />, 'light', 'es-MX');
    const h = copy('es-MX').howItWorks;
    const status = container.querySelector('[data-decision="how-decision"] [role="status"]')!;
    expect(status).toHaveTextContent(copy('es-MX').site.pickOne);
    fireEvent.click(screen.getByRole('radio', { name: h.optionCandy }));
    expect(status).toHaveTextContent(h.consequenceCandy);
    fireEvent.click(screen.getByRole('radio', { name: h.optionBike }));
    expect(status).toHaveTextContent(h.consequenceBike);
    expect(container.querySelector('.lf-banner, [data-verdict]')).toBeNull();
    expect(undeclaredText(container)).toEqual([]);
  });
});

describe('Families (M3)', () => {
  it('offers the Tutor sign-up to a visitor with the brand line, the family to a parent and the app to anyone else', () => {
    const { unmount } = inRoot(<Families locale="en-US" tutor={{ kind: 'visitor' }} />);
    const brand = screen.getAllByRole('link', { name: copy().site.becomeTutor });
    expect(brand[0]).toHaveAttribute('href', '/signup?intent=tutor');
    expect(brand[0]).toHaveAttribute('data-copy-role', 'brand');
    unmount();
    const parent = inRoot(<Families locale="en-US" tutor={{ kind: 'parent' }} />);
    expect(screen.getAllByRole('link', { name: copy().site.openFamily })[0]).toHaveAttribute('href', '/family');
    expect(screen.queryByRole('link', { name: copy().site.becomeTutor })).toBeNull();
    parent.unmount();
    inRoot(<Families locale="en-US" tutor={{ kind: 'member', href: '/learn' }} />);
    expect(screen.getAllByRole('link', { name: copy().site.openApp })[0]).toHaveAttribute('href', '/learn');
    // A signed-in child or teen is never sent to parent verification from this page (OD-3: safeguards follow age).
    expect(document.querySelector('a[href="/verify-parent"]')).toBeNull();
  });

  it('labels the Mentor exchange as an example, and approving the note there changes only the example', () => {
    const { container } = inRoot(<Families locale="en-US" tutor={{ kind: 'visitor' }} />);
    const f = copy().families;
    expect(screen.getByText(f.exampleLabel)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: f.approve }));
    expect(container).toHaveTextContent(f.approved);
    fireEvent.click(screen.getByRole('radio', { name: f.share }));
    const consequence = container.querySelector('[data-decision="families-chore"] .lf-site-consequence')!;
    expect(consequence).toHaveTextContent(f.consequenceShare);
    expect(consequence.querySelector('img')).toHaveAttribute('data-asset-id', 'pocket.share.icon');
    expect(undeclaredText(container)).toEqual([]);
  });

  it('calls the AI the Mentor and the parent the Tutor, never the other way round (OD-6)', () => {
    const { container } = inRoot(<Families locale="es-MX" tutor={{ kind: 'visitor' }} />, 'light', 'es-MX');
    expect(container.textContent).not.toMatch(/Tutor (de )?IA|IA Tutor/);
    expect(container.textContent).toMatch(/Mentor/);
  });
});

describe('FAQ (M4)', () => {
  it('lists every question collapsed, filters by topic and opens answers as disclosures', () => {
    const { container } = inRoot(<Faq locale="en-US" tutor={{ kind: 'visitor' }} />);
    const q = copy().faq;
    expect(container.querySelectorAll('[data-faq-item]')).toHaveLength(FAQ_ITEMS.length);
    const question = screen.getByRole('button', { name: q.items.deleteAccount.question });
    expect(question).toHaveAttribute('aria-expanded', 'false');
    const answer = document.getElementById(question.getAttribute('aria-controls')!)!;
    expect(answer).not.toBeVisible();
    fireEvent.click(question);
    expect(question).toHaveAttribute('aria-expanded', 'true');
    expect(answer).toBeVisible();
    expect(answer).toHaveTextContent(q.items.deleteAccount.answer);

    fireEvent.click(screen.getByRole('button', { name: q.categories.privacy }));
    const shown = [...container.querySelectorAll<HTMLElement>('[data-faq-item]')];
    expect(shown.every((item) => item.dataset.category === 'privacy')).toBe(true);
    expect(shown.map((item) => item.dataset.faqItem)).toEqual(expect.arrayContaining(['noMessaging', 'socialRetention', 'familyRecords']));
    fireEvent.click(screen.getByRole('button', { name: q.all }));
    expect(container.querySelectorAll('[data-faq-item]')).toHaveLength(FAQ_ITEMS.length);
    expect(undeclaredText(container)).toEqual([]);
  });

  it('opens the answer a link points at (/faq#id)', () => {
    window.history.replaceState(null, '', '/faq#twoParents');
    try {
      inRoot(<Faq locale="pt-BR" tutor={{ kind: 'visitor' }} />, 'light', 'pt-BR');
      expect(screen.getByRole('button', { name: copy('pt-BR').faq.items.twoParents.question })).toHaveAttribute('aria-expanded', 'true');
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });
});

describe('Terms and Privacy (M5, M6)', () => {
  it('renders every clause of the Terms, in order, with their addresses', () => {
    const { container } = inRoot(<LegalDocumentPage locale="en-US" doc="terms" onOpenCookies={() => {}} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terms & Conditions');
    const clauses = [...container.querySelectorAll('.lf-legal-clause')].map((clause) => clause.id);
    expect(clauses).toEqual(Array.from({ length: 20 }, (_, index) => `c${index + 1}`));
    expect(screen.getByRole('heading', { name: '1. DEFINITIONS' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy().legalPage.terms })).toHaveAttribute('aria-current', 'page');
    // No paragraph is dropped (the legacy viewer once rendered an allowlist and lost 48).
    const document = legalDocument('en-US', 'terms');
    expect(container.querySelectorAll('.lf-legal-clause p')).toHaveLength(document.sections.reduce((sum, section) => sum + section.paragraphs.length, 0));
    expect(undeclaredText(container)).toEqual([]);
  });

  it('searches the clauses, accent-insensitively, and says when nothing matches', () => {
    const sections = legalDocument('es-MX', 'privacy').sections;
    expect(matchingSections(sections, 'POLITICA').length).toBeLessThanOrEqual(sections.length);
    inRoot(<LegalDocumentPage locale="en-US" doc="terms" onOpenCookies={() => {}} />);
    const search = screen.getByRole('searchbox', { name: copy().legalPage.search });
    fireEvent.change(search, { target: { value: 'DEFINITIONS' } });
    expect(screen.getByRole('heading', { name: '1. DEFINITIONS' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '20. Contact' })).toBeNull();
    fireEvent.change(search, { target: { value: 'zzqqxx' } });
    expect(screen.getByRole('heading', { name: copy().legalPage.noResults })).toBeInTheDocument();
  });

  it('opens the cookie preferences from the Privacy Notice', () => {
    const open = vi.fn();
    inRoot(<LegalDocumentPage locale="pt-BR" doc="privacy" onOpenCookies={open} />, 'dark', 'pt-BR');
    fireEvent.click(screen.getByRole('button', { name: copy('pt-BR').legalPage.cookieSettings }));
    expect(open).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: copy('pt-BR').legalPage.privacy })).toHaveAttribute('aria-current', 'page');
  });
});

describe('Cookie choice (M8)', () => {
  const props = { locale: 'en-US' as const, choice: 'unset' as const, preferencesOpen: false, onOpenPreferences: () => {}, onClosePreferences: () => {}, onDecide: () => {} };

  it('offers reject and accept as equals, neither chosen, and never takes focus', () => {
    const decide = vi.fn();
    inRoot(<CookieConsent {...props} bannerVisible onDecide={decide} />);
    const region = screen.getByRole('region', { name: copy().cookies.title });
    const reject = within(region).getByRole('button', { name: copy().cookies.reject });
    const accept = within(region).getByRole('button', { name: copy().cookies.accept });
    expect(reject.className).toBe(accept.className);
    expect(region.contains(document.activeElement)).toBe(false);
    fireEvent.click(reject);
    expect(decide).toHaveBeenCalledWith(false);
  });

  it('shows nothing when there is no choice to ask for', () => {
    inRoot(<CookieConsent {...props} bannerVisible={false} />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('explains every kind in the preferences and states the current choice', () => {
    inRoot(<CookieConsent {...props} bannerVisible={false} choice="denied" preferencesOpen />);
    const sheet = screen.getByRole('dialog', { name: copy().cookies.sheetTitle });
    for (const heading of [copy().cookies.necessaryTitle, copy().cookies.attributionTitle, copy().cookies.measurementTitle]) {
      expect(within(sheet).getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    expect(sheet).toHaveTextContent(copy().cookies.currentDenied);
    expect(within(sheet).getByRole('link', { name: copy().cookies.privacyLink })).toHaveAttribute('href', '/legal/privacy');
  });
});

describe('BadgeLanding (M7, S10L.3)', () => {
  const payload: BadgePayload = { firstName: 'Ana', achievementKind: 'course_badge', achievementLabel: 'Money Basics', imageUrl: 'https://depot.example/badge.png' };

  it('shows the shared badge with its alt text, one heading and the guest start, and no celebration', () => {
    const onStart = vi.fn();
    const { container } = inRoot(<BadgeLanding locale="en-US" state={{ status: 'ready', payload }} start={guest({ onStart })} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ana earned Money Basics');
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('img', { name: "Ana's achievement badge: Money Basics" })).toHaveAttribute('src', payload.imageUrl);
    fireEvent.click(screen.getByRole('button', { name: copy().site.startFree }));
    expect(onStart).toHaveBeenCalledWith('badge-landing');
    expect(screen.getByRole('link', { name: copy().badgeLanding.howItWorks })).toHaveAttribute('href', '/how-it-works');
    expect(container.querySelector('[data-celebrate]')).toBeNull();
    expect(undeclaredText(container)).toEqual([]);
  });

  it('says an expired, revoked or unknown link expired, and still offers the site', () => {
    const { container } = inRoot(<BadgeLanding locale="es-MX" state={{ status: 'expired' }} start={{ kind: 'continue', href: '/learn' }} />, 'dark', 'es-MX');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copy('es-MX').badgeLanding.expiredTitle);
    expect(within(screen.getByRole('main')).queryByRole('img')).toBeNull();
    expect(screen.getByRole('link', { name: copy('es-MX').site.continue })).toHaveAttribute('href', '/learn');
    expect(undeclaredText(container)).toEqual([]);
  });

  it('announces the load in the page language', () => {
    const { container } = inRoot(<BadgeLanding locale="pt-BR" state={{ status: 'loading' }} start={guest()} />, 'light', 'pt-BR');
    expect(screen.getByRole('status')).toHaveTextContent(copy('pt-BR').badgeLanding.loading);
    expect(undeclaredText(container)).toEqual([]);
  });
});
