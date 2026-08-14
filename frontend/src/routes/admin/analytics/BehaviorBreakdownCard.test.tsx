import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BehaviorBreakdownCard } from './BehaviorBreakdownCard';

/*
 * The behavioural breakdowns exist because twelve dimensions of Umami data
 * were being collected and never read. What can now go wrong quietly is the
 * LABELLING: a raw code rendered as-is is not obviously broken on screen, it
 * just makes the panel useless. Hence these.
 */

/*
 * useAdminData is mocked directly rather than through useAuth: returning a
 * fresh getToken identity from a useAuth mock changes the hook's useCallback
 * on every render, which re-fires its effect and loops until the heap dies.
 * (It did — this test OOM'd the worker before it was written this way.)
 */
const { mockAdminData } = vi.hoisted(() => ({ mockAdminData: vi.fn() }));

vi.mock('../adminShared', async () => {
  const actual = await vi.importActual<typeof import('../adminShared')>('../adminShared');
  return { ...actual, useAdminData: mockAdminData };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Return the KEY even when a defaultValue is given, so an assertion can
            // name the error code the operator would actually be shown.
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

function rows(data: { label: string; value: number }[]) {
  mockAdminData.mockReturnValue({
    data: { state: 'ready', data: { period: '30d', dimension: 'region', rows: data } },
    reload: vi.fn(),
  });
}

beforeEach(() => mockAdminData.mockReset());

describe('BehaviorBreakdownCard', () => {
  it('resolves an ISO 3166-2 region into a readable subdivision and country', async () => {
    // Umami reports "MX-CMX" where Plausible reports a plain name. Rendering
    // the raw code makes the busiest region in the product unreadable.
    rows([{ label: 'MX-CMX', value: 26 }]);
    render(<BehaviorBreakdownCard dimension="region" icon="map" periodQuery={'period=30d' as never} />);
    await waitFor(() => expect(screen.getAllByText(/CMX/).length).toBeGreaterThan(0));
    // Table renders a desktop row and a mobile card, so matches are duplicated.
    expect(screen.getAllByText(/Mexico|México/).length).toBeGreaterThan(0);
  });

  it('names the "not recorded" bucket instead of rendering a blank cell', async () => {
    // Umami returns "" for no-referrer. A blank cell reads as a broken render,
    // and dropping the row makes the percentages stop summing.
    rows([{ label: '', value: 40 }]);
    render(<BehaviorBreakdownCard dimension="referrer" icon="travel_explore" periodQuery={'period=30d' as never} />);
    await waitFor(() =>
      expect(screen.getAllByText('admin.analytics.behavior.notRecorded').length).toBeGreaterThan(0),
    );
  });

  it('computes share against the rows shown, and says so', async () => {
    rows([
      { label: 'a', value: 75 },
      { label: 'b', value: 25 },
    ]);
    render(<BehaviorBreakdownCard dimension="path" icon="description" periodQuery={'period=30d' as never} />);
    await waitFor(() => expect(screen.getAllByText('75%').length).toBeGreaterThan(0));
    expect(screen.getAllByText('25%').length).toBeGreaterThan(0);
    // The denominator must be disclosed — a share measured against a different
    // total than the list it sits on is worse than showing no share.
    expect(screen.getByText('admin.analytics.behavior.shareNote')).toBeInTheDocument();
  });

  it('distinguishes an upstream failure from an empty result', async () => {
    mockAdminData.mockReturnValue({ data: { state: 'error', code: 'UPSTREAM_FAILED' }, reload: vi.fn() });
    render(<BehaviorBreakdownCard dimension="path" icon="description" periodQuery={'period=30d' as never} />);
    await waitFor(() => expect(screen.getByText('errors.api.UPSTREAM_FAILED')).toBeInTheDocument());
    // Specifically NOT the empty-state copy: an operator must never read
    // "no behaviour recorded" when the truth is "Umami did not answer".
    expect(screen.queryByText('admin.analytics.behavior.noRows')).not.toBeInTheDocument();
  });

  it('shows the empty state when the window genuinely has no rows', async () => {
    rows([]);
    render(<BehaviorBreakdownCard dimension="event" icon="bolt" periodQuery={'period=30d' as never} />);
    await waitFor(() => expect(screen.getByText('admin.analytics.behavior.noRows')).toBeInTheDocument());
  });
});
