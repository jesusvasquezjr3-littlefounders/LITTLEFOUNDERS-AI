import { selectOption, optionLabels } from '../rebuild/test/selectOption';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import i18n from '@/i18n';
import site from '@/i18n/en-US/rebuild-site.json';
import siteEs from '@/i18n/es-MX/rebuild-site.json';
import { FAQ_ITEMS } from '@/rebuild/site/faqItems';

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  document.documentElement.classList.remove('dark');
  localStorage.clear();
  await i18n.changeLanguage('en-US');
});

describe('Marketing site', () => {
  it('gives the header CTA one named link without nested interactive controls', () => {
    renderApp('/faq');
    const header = screen.getByRole('banner');
    const cta = within(header).getByRole('link', { name: 'Sign up' });
    expect(cta).toHaveAttribute('href', '/signup');
    expect(cta.querySelector('button, a')).toBeNull();
    // The rebuilt site shell (W2), not the legacy marketing header.
    expect(header.closest('[data-shell="site"]')).not.toBeNull();
    expect(document.querySelector('.lf-marketing-header, img[src*="logo-main"]')).toBeNull();
  });

  it('renders the landing page with its marketing narrative and CTA', () => {
    renderApp();
    /*
     * Asserted against the BUNDLE, not against pinned prose: the rebuilt landing
     * (W2 Lane 1) reads `rebuild-site.json` `landing.*`, whose headline is the
     * brand narrative's short form. What has to hold is the wiring and the beats
     * (the Mentors, the sourced statistic) and the guest-first call to action.
     */
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(site.landing.title);
    expect(screen.getByRole('heading', { name: site.landing.mentorsTitle })).toBeInTheDocument();
    expect(screen.getByText(site.landing.factSource)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: site.site.startFree }).length).toBeGreaterThan(0);
  });

  /*
   * Asserted against the BUNDLE rather than against pinned prose, for the same
   * reason as the landing tests above: this copy is expected to change, and a
   * literal here fails on the rewrite while claiming the page is broken.
   */
  it('renders the how-it-works page: title, the explanation blocks, and the closing invitation', () => {
    renderApp('/how-it-works');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(site.howItWorks.title);
    for (const heading of [site.howItWorks.demoTitle, site.howItWorks.mentorsTitle, site.howItWorks.guestTitle, site.howItWorks.closingTitle]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    // The four Mentors are named from the manifest, never a raw key.
    for (const name of ['Dr. Rho', 'Zara', 'Liruf', 'Dina']) expect(screen.getByText(name)).toBeInTheDocument();
  });

  /*
   * §1.13, on the page that promises "start without an account": its button
   * must open a guest session rather than send the visitor to /signup for one.
   */
  it('the how-it-works CTA starts a guest session rather than demanding an account', () => {
    renderApp('/how-it-works');
    for (const cta of screen.getAllByRole('button', { name: site.site.startFree })) {
      expect(cta).not.toHaveAttribute('href');
      expect(cta).toHaveAttribute('data-cta', 'start-free');
    }
  });

  it('the primary CTA is a guest-start button (never a plain /signup link), and login/signup stay reachable as secondary options', () => {
    renderApp();
    for (const button of screen.getAllByRole('button', { name: /Start free/ })) {
      expect(button).not.toHaveAttribute('href');
    }
    /*
     * `getAll`, not `get`: the marketing header now carries its own "Sign up"
     * button beside the hero's screen-reader-only pair, so a uniqueness
     * assertion fails on a page that got MORE reachable rather than less. The
     * invariant of /AGENTS.md §1.13 is that signup and login stay reachable and
     * that every route into them is the real one — so assert exactly that, on
     * every match.
     */
    const logIn = screen.getAllByRole('link', { name: 'Log in' });
    expect(logIn.length).toBeGreaterThan(0);
    for (const link of logIn) expect(link).toHaveAttribute('href', '/login');

    const signUp = screen.getAllByRole('link', { name: 'Sign up' });
    expect(signUp.length).toBeGreaterThan(0);
    for (const link of signUp) expect(link).toHaveAttribute('href', '/signup');
  });

  it('top nav links to the three marketing pages', () => {
    renderApp();
    for (const [name, href] of [['How it works', '/how-it-works'], ['For families', '/families'], ['FAQ', '/faq']]) {
      const links = within(screen.getByRole('banner')).getAllByRole('link', { name });
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) expect(link).toHaveAttribute('href', href);
    }
  });

  it('footer has legal links, the cookie preferences and the contact email', () => {
    renderApp();
    expect(screen.getByRole('link', { name: 'Terms & Conditions' })).toHaveAttribute(
      'href',
      '/legal/terms',
    );
    expect(screen.getByRole('link', { name: 'Privacy Notice' })).toHaveAttribute(
      'href',
      '/legal/privacy',
    );
    expect(screen.getByRole('link', { name: 'informame@littlefounders.ai' })).toHaveAttribute(
      'href',
      'mailto:informame@littlefounders.ai',
    );
  });

  it('renders the FAQ page with real content, not the coming-soon placeholder', () => {
    renderApp('/faq');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(site.faq.title);
    for (const { id } of FAQ_ITEMS) {
      expect(screen.getByRole('button', { name: site.faq.items[id as keyof typeof site.faq.items].question })).toBeInTheDocument();
    }
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });

  it('the FAQ opens answers as disclosures, and the category filter narrows the list', () => {
    renderApp('/faq');
    const isFree = screen.getByRole('button', { name: site.faq.items.isFree.question });
    expect(screen.getByText(site.faq.items.isFree.answer)).not.toBeVisible();
    fireEvent.click(isFree);
    expect(screen.getByText(site.faq.items.isFree.answer)).toBeVisible();

    // Filtering to a category the item is not in removes it from the DOM.
    fireEvent.click(screen.getByRole('button', { name: site.faq.categories.money }));
    expect(screen.queryByRole('button', { name: site.faq.items.whatIsTutor.question })).not.toBeInTheDocument();
    // S07.8 (D.20): what the practice does not teach is answered before sign-up.
    fireEvent.click(screen.getByRole('button', { name: site.faq.items.notTaught.question }));
    expect(screen.getByText(site.faq.items.notTaught.answer)).toBeVisible();
    // S07.8 (D.21): the Family Hub periods are published with the privacy answers.
    fireEvent.click(screen.getByRole('button', { name: site.faq.categories.privacy }));
    expect(screen.getByRole('button', { name: site.faq.items.familyRecords.question })).toBeInTheDocument();
  });

  it('renders the privacy notice with cookie controls', () => {
    renderApp('/legal/privacy');
    expect(screen.getByRole('heading', { name: 'Privacy Notice' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cookies and measurement' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cookie preferences' })).toHaveLength(2);
  });

  it('no app-shell routes exist (removed until built for real)', () => {
    renderApp('/learn');
    expect(screen.queryByText('Courses are coming soon!')).not.toBeInTheDocument();
  });

  it('the icon-only theme choice switches both the page and the rebuilt shell', () => {
    renderApp();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.querySelector('[data-shell="site"]')?.closest('[data-theme]')).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.querySelector('[data-shell="site"]')?.closest('[data-theme]')).toHaveAttribute('data-theme', 'light');
  });

  /*
   * The regression this file could not see before.
   *
   * <Routes> had no `path="*"`, so an unmatched URL matched no branch and React
   * Router rendered NOTHING — a white screen with no error, no chrome and no
   * way back. A single wrong `to=` in the /learn chapter list therefore looked,
   * to the owner and to every learner, like "the Lesson Engine is dead", and it
   * stayed that way for a week because a blank page reports nothing.
   *
   * The assertion is deliberately about the FLOOR, not the copy: whatever the
   * 404 says, an unknown URL must never render an empty document again.
   */
  it('renders a real 404 for an unknown URL instead of a blank page', () => {
    // Multi-segment on purpose: `/:handle` already claims every single-segment
    // path for public profiles, and a malformed in-app link is deep anyway.
    const { container } = renderApp('/learn/money-basics/lesson/some-slug');

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(i18n.t('notFound.title'));
    // The URL stays visible: it is the one detail that makes a broken link
    // reportable, and a redirect here would hide the next one exactly as the
    // blank page hid this one.
    expect(screen.getByText('/learn/money-basics/lesson/some-slug')).toBeInTheDocument();
  });

  /*
   * The decision block pins the actual behaviour: each option reveals ITS OWN
   * consequence, and picking the other one swaps it in place.
   */
  it('the how-it-works decision card reveals a different consequence per option, in place', () => {
    renderApp('/how-it-works');
    expect(screen.getByText(site.site.pickOne)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: site.howItWorks.optionCandy }));
    expect(screen.getByText(site.howItWorks.consequenceCandy)).toBeInTheDocument();
    expect(screen.queryByText(site.howItWorks.consequenceBike)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: site.howItWorks.optionBike }));
    expect(screen.getByText(site.howItWorks.consequenceBike)).toBeInTheDocument();
    expect(screen.queryByText(site.howItWorks.consequenceCandy)).not.toBeInTheDocument();
  });

  it('renders the families page with its real content, not the coming-soon placeholder', () => {
    renderApp('/families');
    const f = site.families;
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(f.title);
    for (const heading of [f.visibilityTitle, f.choresTitle, f.bankingTitle, f.mapTitle, f.privacyTitle, f.stepsTitle]) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
    // A visitor gets the Tutor sign-up (the brand line), never the guest start.
    for (const link of screen.getAllByRole('link', { name: site.site.becomeTutor })) expect(link).toHaveAttribute('href', '/signup?intent=tutor');
    expect(screen.queryByRole('button', { name: site.site.startFree })).not.toBeInTheDocument();
  });

  it('the families Mentor-visibility example shows an exchange and a memory approval', () => {
    renderApp('/families');
    expect(screen.getByText(site.families.childLine)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: site.families.approve }));
    expect(screen.getByText(site.families.approved)).toBeInTheDocument();
  });

  it('the families earn/allocate exercise reveals a different consequence per option', () => {
    renderApp('/families');
    fireEvent.click(screen.getByRole('radio', { name: site.families.save }));
    expect(screen.getByText(site.families.consequenceSave)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: site.families.share }));
    expect(screen.getByText(site.families.consequenceShare)).toBeInTheDocument();
    expect(screen.queryByText(site.families.consequenceSave)).not.toBeInTheDocument();
  });

  /*
   * The /families CTA links to `/signup?intent=tutor` rather than skipping
   * the switch outright — this pins that the query param actually reaches
   * SignupPage's `parentIntent` initial state.
   */
  it('signup pre-ticks the parent-or-guardian intent when arriving with ?intent=tutor', () => {
    renderApp('/signup?intent=tutor');
    // Intent only: the account still starts universal, and the Tutor role comes from verification (A.5).
    expect(screen.getByRole('checkbox', { name: "I'm a parent or guardian" })).toBeChecked();
  });

  it('the language choice names each language in itself and switches locale', async () => {
    renderApp();
    const language = screen.getByRole('combobox', { name: 'Language' });
    expect(optionLabels(language)).toEqual(['English', 'Español', 'Português']);
    selectOption(language, 'Español');

    // Again the bundle rather than a literal: what this test is for is that the
    // switch actually re-renders in the chosen locale, not what the Spanish
    // headline happens to say this quarter.
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(siteEs.landing.title);
  });
});
