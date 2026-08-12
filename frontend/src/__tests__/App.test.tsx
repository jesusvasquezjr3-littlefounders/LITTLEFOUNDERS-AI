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
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/made into an adventure/);
    // The interactive concept atlas replaced the old static "experience" cards.
    expect(screen.getByRole('img', { name: 'Interactive map of learning concepts and relationships' })).toBeInTheDocument();
    expect(screen.getByText("You're never alone")).toBeInTheDocument();
    expect(screen.getByText('Source: S&P Global FinLit Survey')).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/signup');
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

    expect(await screen.findByText(/convertido en aventura/)).toBeInTheDocument();
  });
});
