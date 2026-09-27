import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en-US/rebuild-core.json';
import pt from '../../i18n/pt-BR/rebuild-core.json';
import { SessionPreferences } from './SessionPreferences';

/* Settings' mode and sign-out (W2 Lane 0): what the legacy app shell's sidebar used to carry. */
describe('SessionPreferences', () => {
  it('offers the three modes and signs out once', () => {
    const onChoice = vi.fn();
    const onSignOut = vi.fn();
    const { rerender } = render(<SessionPreferences copy={en.sessionPreferences} locale="en-US" dark={false} choice="auto"
      onChoice={onChoice} onSignOut={onSignOut} signingOut={false} />);
    expect(screen.getByRole('heading', { level: 2, name: 'On this device' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Match system' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onChoice).toHaveBeenCalledWith('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    rerender(<SessionPreferences copy={en.sessionPreferences} locale="en-US" dark={false} choice="auto"
      onChoice={onChoice} onSignOut={onSignOut} signingOut />);
    expect(screen.getByRole('button', { name: 'Signing out' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Signing out' }).querySelector('[data-busy-motion="spinner"]')).not.toBeNull();
  });

  it('renders on its own design-system root in the mode and language it is given, with every string role declared', () => {
    const { container } = render(<SessionPreferences copy={pt.sessionPreferences} locale="pt-BR" dark choice="light"
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
