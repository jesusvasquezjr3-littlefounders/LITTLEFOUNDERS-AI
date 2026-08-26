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

  it('renders the lesson-focused how-it-works page', () => {
    renderApp('/how-it-works');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Curiosity in\. Confidence out\./);
    expect(screen.getByText('Three moments. One adventure.')).toBeInTheDocument();
    expect(screen.getByText('Short lessons, real thinking.')).toBeInTheDocument();
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
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
