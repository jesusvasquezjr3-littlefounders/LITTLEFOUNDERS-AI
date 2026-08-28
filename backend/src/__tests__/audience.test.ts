import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bandForRole,
  readAudience,
  readAnonAcquisition,
  readRegistrations,
  readSignupFunnelIntegrity,
} from '../services/audience.js';

/*
 * The audience readers, and specifically the places they refuse to invent a
 * number.
 *
 * This whole service exists because of one production measurement: 31 accounts
 * exist and the client-emitted funnel has reported `signup_complete` ZERO
 * times, on every day any of them were created. A console reading only that
 * stream states "no signups, ever" with complete confidence, and an operator
 * has no way to tell that from the truth. Every assertion below is about
 * keeping the two distinguishable (/AGENTS.md §1.14).
 */

const ROWS: Record<string, unknown[]> = {};

function stubRest(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const view = String(url).split('/rest/v1/')[1]?.split('?')[0] ?? '';
      const body = ROWS[view];
      if (body === undefined) return Promise.resolve(new Response('null', { status: 500 }));
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
    }),
  );
}

beforeEach(() => {
  for (const key of Object.keys(ROWS)) delete ROWS[key];
  vi.stubEnv('SUPABASE_URL', 'http://vault.test');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key-0123456789');
  stubRest();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('bandForRole — staff are their own band, on purpose', () => {
  it('separates anonymous, registered and staff', () => {
    expect(bandForRole('anon')).toBe('anonymous');
    expect(bandForRole('universal')).toBe('registered');
    expect(bandForRole('parent')).toBe('registered');
    expect(bandForRole('kid')).toBe('registered');
    expect(bandForRole('bigfounder')).toBe('registered');
    expect(bandForRole('admin')).toBe('staff');
    expect(bandForRole('superadmin')).toBe('staff');
  });

  it('treats an unknown role as registered rather than dropping it', () => {
    // A role we cannot classify is still a person who was here. Dropping the
    // row would quietly shrink every total; the safe direction is to count it
    // among the people the chart is FOR.
    expect(bandForRole('something_new')).toBe('registered');
  });
});

describe('readSignupFunnelIntegrity — the gap is reported, never smoothed', () => {
  it('reports accounts the client funnel never observed', async () => {
    ROWS.insights_signup_funnel_integrity = [
      { day: '2026-08-27', accounts_created: 3, signup_start: 0, signup_submit: 0, signup_complete: 0, unobserved: 3 },
      { day: '2026-08-11', accounts_created: 6, signup_start: 1, signup_submit: 0, signup_complete: 0, unobserved: 6 },
    ];
    const out = await readSignupFunnelIntegrity(30);
    expect(out?.accountsCreated).toBe(9);
    expect(out?.signupComplete).toBe(0);
    expect(out?.unobserved).toBe(9);
    expect(out?.observedShare).toBe(0);
  });

  it('reports NULL, not 100%, when there was nothing to observe', async () => {
    /*
     * The distinction the whole service is about. A quiet week with no
     * registrations must not render as "we observed everything" — that teaches
     * an operator to trust a number computed from an empty set.
     */
    ROWS.insights_signup_funnel_integrity = [
      { day: '2026-08-27', accounts_created: 0, signup_start: 0, signup_submit: 0, signup_complete: 0, unobserved: 0 },
    ];
    const out = await readSignupFunnelIntegrity(30);
    expect(out?.observedShare).toBeNull();
  });

  it('never lets a negative day drag the unobserved total below the truth', async () => {
    // The client can legitimately report more completions than accounts on a
    // day — a retry, a clock skew across midnight. That is not evidence of
    // fewer missing accounts on the other days, so it clamps at zero.
    ROWS.insights_signup_funnel_integrity = [
      { day: '2026-08-27', accounts_created: 0, signup_start: 2, signup_submit: 2, signup_complete: 2, unobserved: -2 },
      { day: '2026-08-26', accounts_created: 5, signup_start: 0, signup_submit: 0, signup_complete: 0, unobserved: 5 },
    ];
    const out = await readSignupFunnelIntegrity(30);
    expect(out?.unobserved).toBe(5);
  });

  it('returns null when the view is unreachable, rather than an empty window', async () => {
    // An unreachable view and a quiet week are different facts. Collapsing
    // them is the defect this service was written to stop.
    const out = await readSignupFunnelIntegrity(30);
    expect(out).toBeNull();
  });
});

describe('readAudience — a quiet day is a zero, not a gap', () => {
  it('bands roles and fills every day in the window', async () => {
    const today = new Date().toISOString().slice(0, 10);
    ROWS.insights_audience_daily = [
      { day: today, role: 'anon', sessions: 4, users: 0, visitors: 2, events: 8, surfaces: 1 },
      { day: today, role: 'superadmin', sessions: 6, users: 2, visitors: 0, events: 52, surfaces: 4 },
      { day: today, role: 'universal', sessions: 1, users: 1, visitors: 0, events: 6, surfaces: 2 },
    ];
    const out = await readAudience(7);
    expect(out?.series).toHaveLength(7);
    expect(out?.series.at(-1)).toEqual({ date: today, anonymous: 4, registered: 1, staff: 6 });
    // The six days before today had no rows at all and must render as zeros.
    expect(out?.series.slice(0, 6).every((p) => p.anonymous === 0 && p.registered === 0 && p.staff === 0)).toBe(true);
    expect(out?.totals).toEqual({ anonymous: 4, registered: 1, staff: 6 });
  });

  it('reports the share of sessions that were not us', async () => {
    const today = new Date().toISOString().slice(0, 10);
    ROWS.insights_audience_daily = [
      { day: today, role: 'anon', sessions: 2, users: 0, visitors: 2, events: 4, surfaces: 1 },
      { day: today, role: 'superadmin', sessions: 8, users: 1, visitors: 0, events: 90, surfaces: 5 },
    ];
    const out = await readAudience(7);
    expect(out?.externalShare).toBeCloseTo(0.2);
  });

  it('reports NULL external share on an empty window', async () => {
    ROWS.insights_audience_daily = [];
    const out = await readAudience(7);
    expect(out?.externalShare).toBeNull();
  });

  it('keeps a row that falls outside the computed window', async () => {
    // The window is a floor on what is DRAWN, never a filter on what was
    // MEASURED — the same rule the analytics timeseries follows.
    ROWS.insights_audience_daily = [
      { day: '2020-01-01', role: 'anon', sessions: 3, users: 0, visitors: 3, events: 3, surfaces: 1 },
    ];
    const out = await readAudience(7);
    expect(out?.series.some((p) => p.date === '2020-01-01')).toBe(true);
    expect(out?.totals.anonymous).toBe(3);
  });
});

describe('readAnonAcquisition — the table nothing had ever read', () => {
  it('groups by every dimension and computes a real conversion rate', async () => {
    ROWS.insights_anon_acquisition = [
      { first_seen_day: '2026-08-11', landing_route: '/', referrer_class: 'direct', device: 'desktop', locale: 'es-MX', utm_source: '(none)', utm_campaign: '(none)', visitors: 6, converted: 1, avg_days_to_convert: 2 },
      { first_seen_day: '2026-08-12', landing_route: '/', referrer_class: 'social', device: 'mobile', locale: 'en-US', utm_source: '(none)', utm_campaign: '(none)', visitors: 2, converted: 0, avg_days_to_convert: null },
    ];
    const out = await readAnonAcquisition(30);
    expect(out?.visitors).toBe(8);
    expect(out?.converted).toBe(1);
    expect(out?.conversionRate).toBeCloseTo(0.125);
    expect(out?.byReferrer.map((r) => r.label)).toEqual(['direct', 'social']);
    expect(out?.byDevice.find((d) => d.label === 'desktop')?.converted).toBe(1);
  });

  it('reports NULL conversion when nobody arrived, never a fabricated 0%', async () => {
    ROWS.insights_anon_acquisition = [];
    const out = await readAnonAcquisition(30);
    expect(out?.conversionRate).toBeNull();
    expect(out?.noCampaignsTagged).toBe(false);
  });

  it('says plainly when no link we ever shared carried a campaign tag', async () => {
    // A marketing gap, not a data gap — and worth stating, because an empty
    // campaign card reads as "the feature is broken".
    ROWS.insights_anon_acquisition = [
      { first_seen_day: '2026-08-11', landing_route: '/', referrer_class: 'direct', device: 'desktop', locale: 'es-MX', utm_source: '(none)', utm_campaign: '(none)', visitors: 6, converted: 0, avg_days_to_convert: null },
    ];
    const out = await readAnonAcquisition(30);
    expect(out?.noCampaignsTagged).toBe(true);
  });
});

describe('readRegistrations — the denominator no cookie banner can suppress', () => {
  it('reads server-side account creation, independent of the event stream', async () => {
    ROWS.insights_registrations_daily = [
      { day: '2026-08-27', role: 'universal', registrations: 3 },
      { day: '2026-07-28', role: 'universal', registrations: 14 },
    ];
    const out = await readRegistrations(90);
    expect(out).toHaveLength(2);
    expect(out?.reduce((t, e) => t + e.registrations, 0)).toBe(17);
  });

  it('returns null when the view is unreachable', async () => {
    expect(await readRegistrations(30)).toBeNull();
  });
});
