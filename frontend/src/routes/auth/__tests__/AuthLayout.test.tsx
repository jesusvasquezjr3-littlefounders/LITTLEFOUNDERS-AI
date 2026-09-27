import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/App';
import i18n from '@/i18n';

function renderApp(path: string) {
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

describe('Auth pages (login/signup) — clean trust surface, no marketing chrome', () => {
  it('/login shows only the welcome text, the form card, and the utility row — no marketing nav or footer', () => {
    renderApp('/login');

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    // One <main>: the rebuilt screen is the sign-in shell's content, with no legacy body or card of its own.
    expect(document.querySelectorAll('main')).toHaveLength(1);
    expect(document.querySelector('[data-legacy-body]')).toBeNull();

    for (const name of ['How it works', 'Families', 'FAQ']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Terms & Conditions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Privacy Notice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'informame@littlefounders.ai' })).not.toBeInTheDocument();
  });

  it('/signup shows only the welcome text, the form card, and the utility row — no marketing nav or footer', () => {
    renderApp('/signup');

    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByText('Everyone starts free. No documents needed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();

    for (const name of ['How it works', 'Families', 'FAQ']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Terms & Conditions' })).not.toBeInTheDocument();
  });

  it('has a way back to home (the wordmark and the Home link go to /)', () => {
    renderApp('/login');
    expect(screen.getByRole('link', { name: 'LittleFounders' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('offers the language switcher in the sign-in shell footer and switches locale', async () => {
    renderApp('/login');

    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'es-MX' } });

    expect(await screen.findByRole('heading', { level: 1, name: 'Qué bueno verte de nuevo' })).toBeInTheDocument();
  });

  it('offers the theme choice at every width and applies the stored theme on load', () => {
    localStorage.setItem('lf-theme', 'dark');
    renderApp('/login');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
