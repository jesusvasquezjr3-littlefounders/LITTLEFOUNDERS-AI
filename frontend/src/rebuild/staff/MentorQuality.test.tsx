import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  flagResultFrom,
  MentorQualityDashboard,
  reviewResultFrom,
  signalLabel,
  type MentorQualityCopy,
} from './MentorQualityDashboard';
import { acknowledgeFlag, getMentorQualityDashboard, resolveFlag, signWeeklyReview } from './mentorQualityApi';
import { PREVIEW_SIGNAL_REGISTRY, previewMentorQuality } from './mentorQualityFixtures';
import en from '@/i18n/en-US/rebuild-staff.json';
import es from '@/i18n/es-MX/rebuild-staff.json';
import pt from '@/i18n/pt-BR/rebuild-staff.json';

/*
 * S06.13 — C.24's rebuilt staff surface: freshness and gaps in words, open
 * flags with their owner role, actions only for the named owner (Core still
 * enforces), a resolution that requires the root cause, every signal with a
 * label in every locale and its status in words, the weekly sign-off, and a
 * client layer that sends closed bodies and never guesses a success.
 */

const COPY: Record<string, MentorQualityCopy> = { 'en-US': en.staffMentorQuality, 'es-MX': es.staffMentorQuality, 'pt-BR': pt.staffMentorQuality };
const noop = async () => 'done' as const;

function renderDashboard(props: Partial<Parameters<typeof MentorQualityDashboard>[0]> = {}) {
  return render(<MentorQualityDashboard copy={en.staffMentorQuality} locale="en-US" dark={false} phase="ready"
    data={previewMentorQuality()} onAcknowledge={noop} onResolve={noop} onReview={noop} {...props} />);
}

afterEach(() => vi.unstubAllGlobals());

describe('MentorQualityDashboard', () => {
  it('labels every registered signal in every locale (no raw ids on screen)', () => {
    for (const copy of Object.values(COPY)) {
      for (const [id] of PREVIEW_SIGNAL_REGISTRY) expect(signalLabel(copy, id), id).not.toBe(id);
    }
  });

  it('states freshness, the last check and the roles nobody is named for, in words', () => {
    renderDashboard();
    expect(screen.getByText('Updated 2 hours ago')).toBeTruthy();
    expect(screen.getByText(en.staffMentorQuality.lastRun.ok)).toBeTruthy();
    expect(screen.getByText(en.staffMentorQuality.noOwner)).toBeTruthy();
    expect(document.querySelector('.lf-quality-gap [data-copy-role="data"]')!.textContent).toBe('Engineering lead');
  });

  it('says out of date when the numbers are older than 24 hours, and not computed when there are none', () => {
    const { unmount } = renderDashboard({ data: previewMentorQuality({ fresh: 'stale' }) });
    expect(screen.getByText('Out of date: last update 30 hours ago').getAttribute('data-stale')).toBe('true');
    unmount();
    renderDashboard({ data: previewMentorQuality({ fresh: 'never' }) });
    expect(screen.getByText(en.staffMentorQuality.never)).toBeTruthy();
    expect(screen.getAllByText(en.staffMentorQuality.notComputed).length).toBeGreaterThan(20);
  });

  it('shows loading and failure without any number', () => {
    const { unmount } = renderDashboard({ phase: 'loading', data: null });
    expect(screen.getByRole('status').textContent).toBe(en.staffMentorQuality.loading);
    expect(document.querySelector('[data-screen="staff-mentor-quality-signals"]')).toBeNull();
    unmount();
    renderDashboard({ phase: 'failed', data: null });
    expect(screen.getByRole('alert').textContent).toBe(en.staffMentorQuality.loadFailed);
  });

  it('lists open flags urgent-first with kind, owner and scope; only the named owner sees actions', () => {
    const { unmount } = renderDashboard();
    const emotion = document.querySelector('[data-flag="flag-emotion"]')!;
    expect(emotion.textContent).toContain('Urgent');
    expect(emotion.textContent).toContain(en.staffMentorQuality.kind.zero_tolerance);
    expect(emotion.textContent).toContain('Safety and trust lead, seen 25 times.');
    expect(document.querySelector('[data-flag="flag-friction"]')!.textContent).toContain('persona:dina/locale:es-MX');
    expect(emotion.querySelectorAll('button')).toHaveLength(2);
    // Already acknowledged: only Resolve remains.
    expect(document.querySelector('[data-flag="flag-bond"]')!.querySelectorAll('button')).toHaveLength(1);
    unmount();
    renderDashboard({ data: previewMentorQuality({ viewer: 'none' }) });
    expect(document.querySelectorAll('[data-screen="staff-mentor-quality-flags"] button')).toHaveLength(0);
    expect(document.querySelectorAll('[data-screen="staff-mentor-quality-review"] button')).toHaveLength(0);
  });

  it('acknowledges, and resolves only with the root cause in at least 10 characters', async () => {
    const onAcknowledge = vi.fn(async () => 'done' as const);
    const onResolve = vi.fn(async () => 'done' as const);
    renderDashboard({ onAcknowledge, onResolve });
    const emotion = document.querySelector('[data-flag="flag-emotion"]')!;
    await act(async () => { fireEvent.click(emotion.querySelectorAll('button')[0]!); });
    expect(onAcknowledge).toHaveBeenCalledWith('flag-emotion');
    expect(emotion.textContent).toContain(en.staffMentorQuality.acknowledged);
    fireEvent.click(Array.from(emotion.querySelectorAll('button')).find((b) => b.textContent === 'Resolve')!);
    const confirm = Array.from(emotion.querySelectorAll('button')).find((b) => b.textContent === 'Mark resolved')!;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Root cause'), { target: { value: 'too short' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Root cause'), { target: { value: 'Prompt v3 labelled moods; reverted.' } });
    expect(confirm.disabled).toBe(false);
    await act(async () => { fireEvent.click(confirm); });
    expect(onResolve).toHaveBeenCalledWith('flag-emotion', 'Prompt v3 labelled moods; reverted.');
    expect(emotion.textContent).toContain(en.staffMentorQuality.resolved);
  });

  it('says why an action did not land', async () => {
    renderDashboard({ onAcknowledge: async () => 'not_owner' });
    await act(async () => { fireEvent.click(document.querySelector('[data-flag="flag-emotion"] button')!); });
    expect(screen.getByRole('alert').textContent).toBe(en.staffMentorQuality.notOwner);
  });

  it('shows every signal with its status in words, a glyph only for on target / needs review', () => {
    renderDashboard();
    const rows = document.querySelectorAll('[data-signal]');
    expect(rows).toHaveLength(PREVIEW_SIGNAL_REGISTRY.length);
    const breach = document.querySelector('[data-signal="rubric.emotion_label"]')!;
    expect(breach.textContent).toContain('Needs review');
    expect(breach.querySelector('svg')).not.toBeNull();
    expect(document.querySelector('[data-signal="engagement.streak_anxiety"]')!.textContent).toContain('Not measured yet');
    // C.24 consolidates the Learning Quality tab: the Block B metrics read real sources now.
    expect(document.querySelector('[data-signal="engagement.session_efficiency"]')!.textContent).toContain('57%');
    expect(document.querySelector('[data-signal="engagement.mentor_resolution"]')!.textContent).toContain('6');
    expect(document.querySelector('[data-signal="bias_audit.coverage"]')!.textContent).toContain('Measured elsewhere');
    expect(document.querySelector('[data-signal="session_end.trigger_rate"]')!.querySelector('svg')).toBeNull();
    // Shares as percentages, counts as numbers, the bond proxy as a score.
    expect(document.querySelector('[data-signal="evaluation.coverage"]')!.textContent).toContain('99.6%');
    expect(document.querySelector('[data-signal="learning.time_to_mastery"]')!.textContent).toContain('5');
    expect(document.querySelector('[data-signal="alliance.bond_proxy"]')!.textContent).toContain('0.64');
    for (const el of document.querySelectorAll('section *')) {
      if (el.children.length === 0 && el.textContent?.trim() && el.tagName !== 'OPTION') expect(el.closest('[data-copy-role]'), el.textContent).not.toBeNull();
    }
  });

  it('GAP-FIX-R4: lists Delayed Retention per KC and window against its release, and Time-to-Mastery per age band', () => {
    const { container } = renderDashboard();
    const retention = container.querySelector('[data-signal="learning.delayed_retention"]')!;
    const toggle = retention.querySelector('button')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(retention.textContent).toContain('money.saving-basics, 60 days');
    expect(retention.textContent).toContain('Compared with release 2026.09.1');
    expect(retention.querySelector('[data-key="kc:money.saving-basics/days:60"]')?.getAttribute('data-status')).toBe('breach');
    const mastery = container.querySelector('[data-signal="learning.time_to_mastery"]')!;
    fireEvent.click(mastery.querySelector('button')!);
    expect(mastery.textContent).toContain('Ages 6-9');
    expect(mastery.textContent).toContain('Age not known');
    // Every breakdown string exists in every locale; a signal without a listed breakdown shows no toggle.
    for (const copy of Object.values(COPY)) for (const value of Object.values(copy.breakdown)) expect(value.length).toBeGreaterThan(0);
    expect(container.querySelector('[data-signal="learning.practice_success_band"] button')).toBeNull();
  });

  it('signs the weekly review for a role the reader owns, and says when it was already signed', async () => {
    const onReview = vi.fn(async () => 'already' as const);
    renderDashboard({ onReview });
    const safety = document.querySelector('[data-role="safety_trust_lead"]')!;
    expect(safety.textContent).toContain('Safety and trust lead: not signed yet');
    expect(document.querySelector('[data-role="pedagogical_lead"]')!.textContent).toContain('signed this week');
    await act(async () => { fireEvent.click(safety.querySelector('button')!); });
    expect(onReview).toHaveBeenCalledWith('safety_trust_lead');
    expect(safety.textContent).toContain(en.staffMentorQuality.reviewAlready);
    expect(screen.getByText('Last week: 50% of named owners signed')).toBeTruthy();
  });

  it('renders in every locale and theme without an English fallback', () => {
    for (const [locale, copy] of Object.entries(COPY)) {
      const { unmount } = render(<MentorQualityDashboard copy={copy} locale={locale} dark phase="ready" data={previewMentorQuality()}
        onAcknowledge={noop} onResolve={noop} onReview={noop} />);
      expect(screen.getByText(copy.title)).toBeTruthy();
      expect(document.querySelectorAll('[data-theme="dark"]').length).toBe(4);
      unmount();
    }
  });
});

describe('mentorQualityApi', () => {
  function stubFetch(status: number, body: unknown) {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    }));
    return calls;
  }

  it('sends closed bodies with the staff token', async () => {
    const calls = stubFetch(200, { data: { id: 'f', status: 'resolved' }, error: null });
    await acknowledgeFlag('tok', 'f/1');
    await resolveFlag('tok', 'f', '  root cause in words  ');
    await signWeeklyReview('tok', 'pedagogical_lead');
    await signWeeklyReview('tok', 'pedagogical_lead', 'read all signals');
    expect(calls[0]!.url).toContain('/admin/mentor-quality/flags/f%2F1/acknowledge');
    expect(calls[0]!.init?.body).toBe('{}');
    expect(JSON.parse(String(calls[1]!.init?.body))).toEqual({ note: 'root cause in words' });
    expect(JSON.parse(String(calls[2]!.init?.body))).toEqual({ role: 'pedagogical_lead' });
    expect(JSON.parse(String(calls[3]!.init?.body))).toEqual({ role: 'pedagogical_lead', note: 'read all signals' });
    expect((calls[0]!.init?.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('never guesses a success from a malformed answer or a network error, and maps Core codes', async () => {
    stubFetch(200, { ok: true });
    expect((await getMentorQualityDashboard('tok')).error?.code).toBe('INTERNAL');
    stubFetch(403, { data: null, error: { code: 'NOT_NAMED_OWNER', message: 'no' } });
    const refused = await acknowledgeFlag('tok', 'f');
    expect(flagResultFrom(refused.error)).toBe('not_owner');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(flagResultFrom((await resolveFlag('tok', 'f', 'x'.repeat(12))).error)).toBe('failed');
    expect(flagResultFrom({ code: 'ALREADY_DECIDED' })).toBe('changed');
    expect(reviewResultFrom({ code: 'ALREADY_REVIEWED' })).toBe('already');
    expect(reviewResultFrom(null)).toBe('done');
  });
});
