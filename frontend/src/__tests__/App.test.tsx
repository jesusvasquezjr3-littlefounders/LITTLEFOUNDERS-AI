import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import i18n from '@/i18n';

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
  it('renders the landing page with its marketing narrative and CTA', () => {
    renderApp();
    /*
     * Asserted against the BUNDLE, not against pinned prose. The headline is
     * marketing copy and it gets rewritten; a literal here fails on the rewrite
     * and says "the landing page is broken" when what actually happened is that
     * somebody improved a sentence. What has to hold is that the h1 is wired to
     * `marketing.hero.*` and renders both halves of it.
     */
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(i18n.t('marketing.hero.titleLead'));
    expect(heading).toHaveTextContent(i18n.t('marketing.hero.titleHighlight'));
    // The interactive concept atlas replaced the old static "experience" cards.
    expect(screen.getByRole('img', { name: 'Interactive map of learning concepts and relationships' })).toBeInTheDocument();
    // Same reasoning as the h1: these two are the narrative beats the page
    // promises (the mentors section and the sourced statistic), and the beats
    // are what the test is guarding — not the sentences they are written in.
    expect(screen.getByText(i18n.t('marketing.journey.heading'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('marketing.fact.source'))).toBeInTheDocument();
    // Guest-first: the primary CTA starts a guest session (a button), not a
    // plain /signup link — see Landing's startAsGuest.
    expect(screen.getAllByRole('button', { name: /Start free/ }).length).toBeGreaterThan(0);
  });

  /*
   * Asserted against the BUNDLE rather than against pinned prose, for the same
   * reason as the landing tests above: this copy is expected to change, and a
   * literal here fails on the rewrite while claiming the page is broken.
   */
  it('renders the how-it-works page: title, the three explanation blocks, and the closing invitation', () => {
    renderApp('/how-it-works');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      i18n.t('marketing.howItWorks.title'),
    );
    for (const block of ['decisions', 'mentors', 'account'] as const) {
      expect(
        screen.getByText(i18n.t(`marketing.howItWorks.${block}.heading`)),
      ).toBeInTheDocument();
    }
    expect(screen.getByText(i18n.t('marketing.howItWorks.closing.title'))).toBeInTheDocument();
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });

  /*
   * `npm run i18n:check` says so itself: it verifies key-set parity but cannot
   * follow a key built at runtime. This page builds two families of them -
   * `tutor.character.<who>.<field>` for the mentor grid and
   * `marketing.howItWorks.account.<what>` for the reward labels - so a rename
   * on either side would ship raw key strings to a visitor with every gate
   * still green. This is the test that would catch it.
   */
  it('resolves every dynamically built key on the how-it-works page', () => {
    renderApp('/how-it-works');
    for (const who of ['zara', 'rho', 'liruf', 'dina'] as const) {
      for (const field of ['name', 'blurb'] as const) {
        const key = `tutor.character.${who}.${field}`;
        const value = i18n.t(key);
        expect(value).not.toBe(key);
        expect(screen.getByText(value)).toBeInTheDocument();
      }
    }
    for (const what of ['streak', 'lessons', 'coins'] as const) {
      const key = `marketing.howItWorks.account.${what}`;
      const value = i18n.t(key);
      expect(value).not.toBe(key);
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  /*
   * §1.13, on the page that now promises "start without an account" three
   * blocks above its own button: that button must open a guest session rather
   * than send the visitor to /signup for one.
   */
  it('the how-it-works CTA starts a guest session rather than demanding an account', () => {
    renderApp('/how-it-works');
    const cta = screen.getByRole('button', {
      name: new RegExp(i18n.t('marketing.howItWorks.cta')),
    });
    expect(cta).not.toHaveAttribute('href');
    expect(cta).toHaveAttribute('data-cta', 'how-it-works-primary');
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
    for (const name of ['How it works', 'Families', 'FAQ']) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
  });

  it('footer has legal links, a big logo, and the contact email', () => {
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

  it('renders coming-soon pages', () => {
    renderApp('/faq');
    expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
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

  it('theme toggle offers auto/light/dark and switches to dark', () => {
    renderApp();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(screen.getAllByRole('button', { name: 'Dark' })[0]!);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Match system' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Light' }).length).toBeGreaterThan(0);
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

  it('language switcher is a custom dropdown (no native select) and switches locale', async () => {
    renderApp();
    expect(document.querySelector('select')).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /Language:/ });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('option', { name: /Spanish/ }));

    // Again the bundle rather than a literal: what this test is for is that the
    // switch actually re-renders in the chosen locale, not what the Spanish
    // headline happens to say this quarter.
    const inSpanish = i18n.getFixedT('es-MX');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      inSpanish('marketing.hero.titleLead'),
    );
  });
});
