import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  it('/login shows only the welcome text and the form card — no marketing nav or footer', () => {
    renderApp('/login');

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('Sign in to keep building')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();

    for (const name of ['How it works', 'Families', 'FAQ']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Terms & Conditions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Privacy Notice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'informame@littlefounders.ai' })).not.toBeInTheDocument();
  });

  it('/signup shows only the welcome text and the form card — no marketing nav or footer', () => {
    renderApp('/signup');

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByText('One account for the whole adventure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();

    for (const name of ['How it works', 'Families', 'FAQ']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Terms & Conditions' })).not.toBeInTheDocument();
  });

  it('applies the stored theme on /login even though no ThemeToggle is rendered on the page', () => {
    localStorage.setItem('lf-theme', 'dark');
    renderApp('/login');

    expect(screen.queryByRole('group', { name: 'Theme' })).not.toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
