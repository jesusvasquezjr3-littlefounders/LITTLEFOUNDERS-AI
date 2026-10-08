import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import i18n from '@/i18n';
import site from '@/i18n/en-US/rebuild-site.json';
import siteEs from '@/i18n/es-MX/rebuild-site.json';

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
    renderApp();
    const header = screen.getByRole('banner');
    const cta = within(header).getByRole('link', { name: 'Log in' });
    expect(cta).toHaveAttribute('href', '/login');
    expect(cta.querySelector('button, a')).toBeNull();
    // Owner direction, 2026-10-06: no page links and no second header call to action.
    expect(within(header).queryByRole('navigation')).toBeNull();
    expect(within(header).queryByRole('link', { name: 'Sign up' })).toBeNull();
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
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${site.landingV2.title} ${site.landingV2.titleAccent}`);
    expect(screen.getByRole('heading', { name: site.landingV2.mentorTitle })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: site.landingV2.learnTitle })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: site.site.startFree }).length).toBeGreaterThan(0);
  });

  it('the primary CTA is a guest-start button (never a plain /signup link), and login stays reachable', () => {
    renderApp();
    for (const button of screen.getAllByRole('button', { name: /Start free/ })) {
      expect(button).not.toHaveAttribute('href');
    }
    const logIn = screen.getAllByRole('link', { name: 'Log in' });
    expect(logIn.length).toBeGreaterThan(0);
    for (const link of logIn) expect(link).toHaveAttribute('href', '/login');
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
   * The /families CTA links to `/signup?intent=tutor` rather than skipping
   * the switch outright — this pins that the query param actually reaches
   * SignupPage's `parentIntent` initial state.
   */
  it('signup pre-ticks the parent-or-guardian intent when arriving with ?intent=tutor', () => {
    renderApp('/signup?intent=tutor');
    // Intent only: the account still starts universal, and the Tutor role comes from verification (A.5).
    expect(screen.getByRole('checkbox', { name: "I'm a parent or guardian" })).toBeChecked();
  });

  it('the language menu is round flags that name each language in itself and switches locale', async () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Language: English' }));
    const options = screen.getAllByRole('menuitemradio');
    expect(options.map((option) => option.getAttribute('aria-label'))).toEqual(['Español', 'English', 'Português']);
    expect(screen.getByRole('menuitemradio', { name: 'English' })).toBeChecked();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Español' }));

    // Again the bundle rather than a literal: what this test is for is that the
    // switch actually re-renders in the chosen locale, not what the Spanish
    // headline happens to say this quarter.
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(`${siteEs.landingV2.title} ${siteEs.landingV2.titleAccent}`);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
