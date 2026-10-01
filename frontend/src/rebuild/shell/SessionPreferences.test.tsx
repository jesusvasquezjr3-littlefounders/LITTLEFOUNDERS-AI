import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en-US/rebuild-core.json';
import pt from '../../i18n/pt-BR/rebuild-core.json';
import { SessionPreferences } from './SessionPreferences';

/* Settings keeps global icon-only display controls and independent sign-out. */
describe('SessionPreferences', () => {
  it('toggles the effective mode with an icon-only button and signs out once', () => {
    const onChoice = vi.fn();
    const onSignOut = vi.fn();
    const { rerender } = render(<SessionPreferences copy={en.sessionPreferences} locale="en-US" dark={false}
      onChoice={onChoice} onSignOut={onSignOut} signingOut={false} />);
    expect(screen.getByRole('heading', { level: 2, name: 'On this device' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    const mode = screen.getByRole('button', { name: 'Dark' });
    expect(mode.querySelector('svg')).not.toBeNull();
    expect(mode).toHaveTextContent(/^$/);
    fireEvent.click(mode);
    expect(onChoice).toHaveBeenCalledWith('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    rerender(<SessionPreferences copy={en.sessionPreferences} locale="en-US" dark
      onChoice={onChoice} onSignOut={onSignOut} signingOut />);
    expect(screen.getByRole('button', { name: 'Signing out' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Signing out' }).querySelector('[data-busy-motion="spinner"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(onChoice).toHaveBeenLastCalledWith('light');
  });

  it('renders on its own design-system root in the mode and language it is given, with every string role declared', () => {
    const { container } = render(<SessionPreferences copy={pt.sessionPreferences} locale="pt-BR" dark
      onChoice={() => undefined} onSignOut={() => undefined} signingOut={false} />);
    const root = container.querySelector('.lf-session-preferences')!;
    expect(root).toHaveClass('lf-rebuild');
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(root).toHaveAttribute('lang', 'pt-BR');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.trim()) expect(node.parentElement!.closest('[data-copy-role]'), node.textContent!).not.toBeNull();
    }
  });
});
