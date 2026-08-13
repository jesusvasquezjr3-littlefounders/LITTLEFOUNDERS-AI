import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { LegalPage } from '../LegalPage';
import enMarketing from '@/i18n/en-US/marketing.json';

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
    expect(screen.getByRole('heading', { name: '20. Contact' })).toBeInTheDocument();
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
    expect(screen.queryByRole('heading', { name: '20. Contact' })).not.toBeInTheDocument();
  });
});

/*
 * The contract must be displayed in full.
 *
 * The viewer used to decide which paragraphs existed from a hard-coded list
 * ("c2, c4, c5… have a p2"), so 48 paragraphs sat in the locale files and were
 * never rendered in any language — most of the personal-data clause and all but
 * the opening line of clauses 14 and 15. It looked complete, which is what made
 * it dangerous. These tests read the locale file as the expectation, so the
 * page and the published terms cannot drift apart again.
 */
describe('LegalPage — the whole document is rendered', () => {
  const terms = enMarketing.legal.terms as unknown as Record<string, Record<string, string>>;

  function renderTerms() {
    render(
      <MemoryRouter initialEntries={['/legal/terms']}>
        <Routes>
          <Route path="/legal/terms" element={<LegalPage doc="terms" />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('renders every clause heading the locale defines', () => {
    renderTerms();
    const clauses = Object.keys(terms).filter((key) => /^c\d+$/.test(key));
    expect(clauses.length).toBe(20);
    for (const clause of clauses) {
      expect(screen.getByRole('heading', { name: terms[clause]!.title! })).toBeInTheDocument();
    }
  });

  it('renders every paragraph of every clause, not just the first', () => {
    renderTerms();
    const missing: string[] = [];
    let checked = 0;
    for (const [clause, body] of Object.entries(terms)) {
      if (!/^c\d+$/.test(clause)) continue;
      for (const [key, text] of Object.entries(body)) {
        if (!/^p\d+$/.test(key) || typeof text !== 'string') continue;
        checked += 1;
        // Long clauses are matched on a distinctive opening fragment: exact
        // whole-string matching is brittle against whitespace normalisation.
        const probe = text.slice(0, 60).trim();
        if (screen.queryAllByText((_, node) => node?.textContent?.includes(probe) ?? false).length === 0) {
          missing.push(`${clause}.${key}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(missing, `these paragraphs are published but never shown: ${missing.join(', ')}`).toEqual([]);
  });
});
