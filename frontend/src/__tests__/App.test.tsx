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

  it('top nav links to the three marketing pages', () => {
    renderApp();
    for (const name of ['How it works', 'Families', 'FAQ']) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0);
    }
  });

  it('footer has legal links and the contact email', () => {
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

  it('app sections still render under the app layout', () => {
    renderApp('/learn');
    expect(screen.getByText('Courses are coming soon!')).toBeInTheDocument();
  });

  it('toggles dark mode from the marketing header', () => {
    renderApp();
    const toggle = screen.getByRole('button', { name: 'Toggle theme' });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(toggle);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('switches locale on the landing page', async () => {
    renderApp();
    await i18n.changeLanguage('es-MX');
    expect(await screen.findByText(/aprendida jugando/)).toBeInTheDocument();
  });
});
