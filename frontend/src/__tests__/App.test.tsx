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

describe('App shell', () => {
  it('renders the home page with the five section cards', () => {
    renderApp();
    expect(screen.getByRole('heading', { name: 'Welcome to LittleFounders' })).toBeInTheDocument();
    // each section appears twice: nav link + home card
    for (const name of ['Learn', 'Tutor', 'Games', 'Tasks', 'Profile']) {
      expect(screen.getAllByRole('link', { name: new RegExp(name) })).toHaveLength(2);
    }
  });

  it('navigates to a section placeholder', () => {
    renderApp('/learn');
    expect(screen.getByText('Courses are coming soon!')).toBeInTheDocument();
  });

  it('toggles dark mode by flipping the root class', () => {
    renderApp();
    const toggle = screen.getByRole('button', { name: 'Toggle theme' });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(toggle);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('switches locale and re-renders strings', async () => {
    renderApp();
    await i18n.changeLanguage('es-MX');
    expect(await screen.findByRole('heading', { name: 'Bienvenido a LittleFounders' })).toBeInTheDocument();
  });
});
