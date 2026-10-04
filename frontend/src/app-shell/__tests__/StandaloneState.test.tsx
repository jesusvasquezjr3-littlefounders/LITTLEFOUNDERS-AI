import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/theme/useTheme';
import { StandaloneState } from '../StandaloneState';

describe('standalone route display controls', () => {
  it('keeps standalone application states free of the marketing topbar', () => {
    const { container } = render(<ThemeProvider><MemoryRouter initialEntries={['/no/such/page']}>
      <StandaloneState pageTitle="Unavailable"><h1 data-copy-role="heading">Unavailable</h1></StandaloneState>
    </MemoryRouter></ThemeProvider>);
    expect(container.querySelector('header')).toBeNull();
    expect(container.querySelector('.lf-appbar, .lf-site-header, .lf-standalone-header')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Unavailable' })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
