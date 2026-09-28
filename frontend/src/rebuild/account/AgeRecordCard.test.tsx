import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import en from '../../i18n/en-US/rebuild-profile.json';
import { AgeRecordCard, ageRecordKind, correctionState } from './AgeRecordCard';
import { AnalyticsChoice } from '../privacy/AnalyticsChoice';

/*
 * S-04 (OD-28, E.4): the locked age card is read-only and shown only to a
 * self-managed teen (or one who moved to adult at 18). M-12 (OD-26): the teen's
 * own usage-data choice says it also enrols them in the hint-style test only
 * when Core says it does.
 */

afterEach(() => cleanup());

const screening = (over: Record<string, unknown> = {}) => ({ required: false, ageBand: '13_to_17', protectedOrigin: false, birthMonthRecorded: true, adultByBirthMonth: false, ...over });

describe('ageRecordKind', () => {
  it('names what the card says for each teen state', () => {
    expect(ageRecordKind(screening())).toBe('teenMonth');
    expect(ageRecordKind(screening({ birthMonthRecorded: false }))).toBe('teenBand');
    expect(ageRecordKind(screening({ birthMonthRecorded: undefined }))).toBe('teenBand');
    expect(ageRecordKind(screening({ ageBand: 'adult', adultByBirthMonth: true }))).toBe('adultByMonth');
    // E.4 (OD-3): a self-registered adult sees their group too, so they can ask for a correction.
    expect(ageRecordKind(screening({ ageBand: 'adult', adultByBirthMonth: false }))).toBe('adult');
  });
  it('shows nothing to a child, an unscreened account or a malformed read', () => {
    expect(ageRecordKind(screening({ ageBand: 'under_13', protectedOrigin: true }))).toBeNull();
    expect(ageRecordKind(screening({ protectedOrigin: true }))).toBeNull();
    expect(ageRecordKind(screening({ required: true, ageBand: null }))).toBeNull();
    expect(ageRecordKind(null)).toBeNull();
    expect(ageRecordKind({})).toBeNull();
  });
});

describe('AgeRecordCard', () => {
  it('states the record and the lock, with no control to change it', () => {
    const { container } = render(<AgeRecordCard copy={en.ageRecord} kind="teenMonth" />);
    expect(screen.getByText(en.ageRecord.teenMonth)).toBeInTheDocument();
    expect(screen.getByText(en.ageRecord.locked)).toBeInTheDocument();
    expect(container.querySelectorAll('input, button, select, textarea, [role="switch"]')).toHaveLength(0);
  });
});

describe('the staff-reviewed correction (E.4, OD-3)', () => {
  it('reads the eligibility and status Core returns, and nothing else', () => {
    expect(correctionState({ eligible: true, request: null })).toEqual({ eligible: true, status: null });
    expect(correctionState({ eligible: true, request: { status: 'pending' } })).toEqual({ eligible: true, status: 'pending' });
    expect(correctionState({ eligible: 'yes' })).toBeNull();
    expect(correctionState(null)).toBeNull();
  });

  it('is not offered when Core says the account may not ask', () => {
    render(<AgeRecordCard copy={en.ageRecord} kind="teenMonth" correction={{ eligible: false, status: null }} onRequest={vi.fn()} />);
    expect(screen.queryByRole('button', { name: en.ageRecord.request })).toBeNull();
  });

  it('sends the date once and shows the pending status instead of a second request', async () => {
    const onRequest = vi.fn().mockResolvedValue(null);
    const { rerender } = render(<AgeRecordCard copy={en.ageRecord} kind="adult" correction={{ eligible: true, status: null }} onRequest={onRequest} />);
    fireEvent.click(screen.getByRole('button', { name: en.ageRecord.request }));
    expect(screen.getByText(en.ageRecord.requestHelp)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(en.ageRecord.birthDate), { target: { value: '2011-05-17' } });
    fireEvent.click(screen.getByRole('button', { name: en.ageRecord.send }));
    await waitFor(() => expect(onRequest).toHaveBeenCalledWith('2011-05-17'));
    rerender(<AgeRecordCard copy={en.ageRecord} kind="adult" correction={{ eligible: true, status: 'pending' }} onRequest={onRequest} />);
    expect(screen.getByText(en.ageRecord.pending)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: en.ageRecord.request })).toBeNull();
  });

  it('explains a refusal and keeps the form open', async () => {
    const onRequest = vi.fn().mockResolvedValue('unchanged');
    render(<AgeRecordCard copy={en.ageRecord} kind="teenBand" correction={{ eligible: true, status: 'rejected' }} onRequest={onRequest} />);
    expect(screen.getByText(en.ageRecord.rejected)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.ageRecord.request }));
    fireEvent.change(screen.getByLabelText(en.ageRecord.birthDate), { target: { value: '2011-05-17' } });
    fireEvent.click(screen.getByRole('button', { name: en.ageRecord.send }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.ageRecord.unchanged);
    expect(screen.getByRole('button', { name: en.ageRecord.send })).toBeInTheDocument();
  });
});

describe('AnalyticsChoice and the hint-style test (M-12)', () => {
  const base = { copy: en.analyticsChoice, locale: 'en-US', dark: false, enabled: false, loading: false, saving: false, error: null, onToggle: vi.fn(), onRetry: vi.fn() };
  it('says the choice also enrols the teen only when Core marks it', () => {
    const { rerender } = render(<AnalyticsChoice {...base} experiment />);
    expect(screen.getByText(en.analyticsChoice.experiment)).toBeInTheDocument();
    rerender(<AnalyticsChoice {...base} />);
    expect(screen.queryByText(en.analyticsChoice.experiment)).toBeNull();
  });
});
