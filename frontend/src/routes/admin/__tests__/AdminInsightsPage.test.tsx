import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminInsightsPage } from '../AdminInsightsPage';

describe('AdminInsightsPage', () => {
  it('keeps existing insight bookmarks on the unified learning console', () => {
    render(
      <MemoryRouter initialEntries={['/admin/insights']}>
        <Routes>
          <Route path="/admin/insights" element={<AdminInsightsPage />} />
          <Route path="/admin/intel" element={<p>Learning intelligence</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Learning intelligence')).toBeInTheDocument();
  });
});
