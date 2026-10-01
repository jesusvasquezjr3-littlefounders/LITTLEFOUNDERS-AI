import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/theme/useTheme';
import { StandaloneState } from '../StandaloneState';

describe('standalone route display controls', () => {
  it('keeps the official graphic and global language and icon-only mode controls on an unavailable route', () => {
    const { container } = render(<ThemeProvider><MemoryRouter initialEntries={['/no/such/page']}>
      <StandaloneState pageTitle="Unavailable"><h1 data-copy-role="heading">Unavailable</h1></StandaloneState>
    </MemoryRouter></ThemeProvider>);
    const header = container.querySelector('header')!;
    expect(header.querySelector('img[data-asset-id="brand.mark"]')).toHaveAttribute('src', '/rebuild/brand/mark.svg');
    const language = within(header).getByRole('combobox', { name: 'Language' });
    fireEvent.click(language);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.keyDown(language, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    const mode = header.querySelector<HTMLButtonElement>('.lf-icon-button')!;
    expect(mode).toHaveAccessibleName();
    expect(mode.textContent).toBe('');
    const before = document.documentElement.classList.contains('dark');
    fireEvent.click(mode);
    expect(document.documentElement.classList.contains('dark')).toBe(!before);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
