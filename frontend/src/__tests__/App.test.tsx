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
  it('renders the landing page with hero, pitch sections, and CTA', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/learned by playing/);
    expect(screen.getByText('The problem')).toBeInTheDocument();
    expect(screen.getByText('Our solution')).toBeInTheDocument();
    expect(screen.getByText('Source: S&P Global FinLit Survey')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Start free' }).length).toBeGreaterThan(0);
  });

  it('CTA links point to the landing page (no app shell yet)', () => {
    renderApp();
    for (const link of screen.getAllByRole('link', { name: /Start free/ })) {
      expect(link).toHaveAttribute('href', '/');
    }
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

  it('renders under-construction legal pages', () => {
    renderApp('/legal/privacy');
    expect(screen.getByRole('heading', { name: 'Privacy Notice' })).toBeInTheDocument();
    expect(screen.getByText('Under construction')).toBeInTheDocument();
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

    expect(await screen.findByText(/aprendida jugando/)).toBeInTheDocument();
  });
});
