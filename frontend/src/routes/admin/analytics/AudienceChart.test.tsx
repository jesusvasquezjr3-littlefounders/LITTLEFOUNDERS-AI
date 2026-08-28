import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudienceChart } from './AudienceChart';
import type { AudienceSeriesPoint } from './analyticsShared';

/*
 * Recharts is mocked, following AnalyticsTrendChart.test.tsx. Its
 * ResponsiveContainer needs a ResizeObserver jsdom does not provide, and it
 * measures zero here anyway — so the bars are verified in a real browser
 * (/dev/audience-lab) and the logic is verified here. `Bar` renders a marker
 * so the tests can still assert WHICH series were drawn.
 */
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <svg>{children}</svg>,
  Bar: ({ dataKey }: { dataKey: string }) => <g data-testid={`bar-${dataKey}`} />,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en-US' },
  }),
}));

/*
 * The chart's honesty, not its pixels.
 *
 * Recharts renders through a ResponsiveContainer that measures zero in jsdom,
 * so the bars themselves are not assertable here and are verified in the
 * browser instead (/dev/audience-lab, both breakpoints). What IS assertable is
 * the part that decides whether a reader is misled: which way the staff toggle
 * defaults, and whether the two states that look identical on a chart — "we
 * measured nothing" and "we hid something" — say which one they are.
 */

const SERIES: AudienceSeriesPoint[] = [
  { date: '2026-08-11', anonymous: 10, registered: 18, staff: 8 },
  { date: '2026-08-12', anonymous: 2, registered: 6, staff: 3 },
];

const EMPTY: AudienceSeriesPoint[] = [
  { date: '2026-08-11', anonymous: 0, registered: 0, staff: 0 },
];

describe('AudienceChart', () => {
  it('includes staff BY DEFAULT, so the first read is the honest one', () => {
    /*
     * The direction of this default is the whole ethics of the control. Staff
     * were ~90% of volume when this shipped; defaulting to hidden would show
     * an operator an audience that does not exist.
     */
    render(<AudienceChart series={SERIES} />);
    const toggle = screen.getByRole('checkbox');
    expect((toggle as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText(/staffHidden/)).toBeNull();
    expect(screen.getByTestId('bar-staff')).toBeTruthy();
  });

  it('says out loud what it removed when staff are hidden', () => {
    render(<AudienceChart series={SERIES} />);
    fireEvent.click(screen.getByRole('checkbox'));
    // A smaller chart must never be mistakeable for a smaller reality.
    expect(screen.getByText(/staffHidden/)).toBeTruthy();
    expect(screen.queryByTestId('bar-staff')).toBeNull();
    expect(screen.getByTestId('bar-anonymous')).toBeTruthy();
  });

  it('distinguishes a measured zero from a failed read', () => {
    // §1.14 on a chart: flat zeros and "we could not load this" are the same
    // picture, so the empty case is stated in words.
    render(<AudienceChart series={EMPTY} />);
    expect(screen.getByText(/emptyWindow/)).toBeTruthy();
  });

  it('does not claim an empty window when only staff were hidden', () => {
    // Hiding staff on a staff-only day empties the CHART but not the DATA.
    // Saying "no sessions recorded" there would be a lie about the window.
    render(<AudienceChart series={[{ date: '2026-08-04', anonymous: 0, registered: 0, staff: 75 }]} />);
    expect(screen.queryByText(/emptyWindow/)).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText(/staffHidden/)).toBeTruthy();
  });

  it('offers the table view, because identity may not rest on colour alone', () => {
    // The palette sits in the 6-8 CVD band; the legend and this table are the
    // required secondary encoding, not a nicety.
    render(<AudienceChart series={SERIES} />);
    expect(screen.getByText(/showTable/)).toBeTruthy();
  });

  it('lists only the days that actually had sessions in the table', () => {
    render(<AudienceChart series={[...SERIES, { date: '2026-08-13', anonymous: 0, registered: 0, staff: 0 }]} />);
    expect(screen.getByText('2026-08-11')).toBeTruthy();
    expect(screen.queryByText('2026-08-13')).toBeNull();
  });
});
