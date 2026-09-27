import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import en from '../../i18n/en-US/rebuild-profile.json';
import { AgeRecordCard, ageRecordKind } from './AgeRecordCard';
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
  });
  it('shows nothing to a child, an adult who declared as an adult, an unscreened account or a malformed read', () => {
    expect(ageRecordKind(screening({ ageBand: 'under_13', protectedOrigin: true }))).toBeNull();
    expect(ageRecordKind(screening({ protectedOrigin: true }))).toBeNull();
    expect(ageRecordKind(screening({ ageBand: 'adult', adultByBirthMonth: false }))).toBeNull();
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

describe('AnalyticsChoice and the hint-style test (M-12)', () => {
  const base = { copy: en.analyticsChoice, locale: 'en-US', dark: false, enabled: false, loading: false, saving: false, error: null, onToggle: vi.fn(), onRetry: vi.fn() };
  it('says the choice also enrols the teen only when Core marks it', () => {
    const { rerender } = render(<AnalyticsChoice {...base} experiment />);
    expect(screen.getByText(en.analyticsChoice.experiment)).toBeInTheDocument();
    rerender(<AnalyticsChoice {...base} />);
    expect(screen.queryByText(en.analyticsChoice.experiment)).toBeNull();
  });
});
