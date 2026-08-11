import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { LegalPage } from '../LegalPage';

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe('LegalPage', () => {
  it('renders Terms & Conditions with all clauses and metadata', () => {
    render(
      <MemoryRouter initialEntries={['/legal/terms']}>
        <Routes>
          <Route path="/legal/terms" element={<LegalPage doc="terms" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Terms & Conditions' })).toBeInTheDocument();
    expect(screen.getAllByText(/Legal Cyberx S.C./i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '1. DEFINITIONS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '20. CONTACT' })).toBeInTheDocument();
  });

  it('renders Privacy Notice with cookie controls and contact info', () => {
    render(
      <MemoryRouter initialEntries={['/legal/privacy']}>
        <Routes>
          <Route path="/legal/privacy" element={<LegalPage doc="privacy" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Notice' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. DATA CONTROLLER IDENTITY AND ADDRESS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cookies and measurement' })).toBeInTheDocument();
  });

  it('filters clauses when typing into search input', () => {
    render(
      <MemoryRouter initialEntries={['/legal/terms']}>
        <Routes>
          <Route path="/legal/terms" element={<LegalPage doc="terms" />} />
        </Routes>
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText('Search legal documents…');
    fireEvent.change(searchInput, { target: { value: 'DEFINITIONS' } });

    expect(screen.getByRole('heading', { name: '1. DEFINITIONS' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '20. CONTACT' })).not.toBeInTheDocument();
  });
});
