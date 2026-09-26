import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveContentStatusPanel, LiveReviewDecision, PackRelease, type LiveContentCopy } from './LiveContentGovernance';
import { decideLiveItem, getLiveContentStatus, reviewBody, setPackStatus, type LiveContentStatus, type TutorPackSummary } from './liveContentApi';
import en from '@/i18n/en-US/rebuild-staff.json';
import es from '@/i18n/es-MX/rebuild-staff.json';
import pt from '@/i18n/pt-BR/rebuild-staff.json';

/*
 * C.5 / C.6 staff surfaces: the per-category status, one review decision
 * (three equal controls; a rejection names its issue class) and the curated
 * pack release (a refusal lists every reason). The client layer sends only
 * closed values and never guesses a success.
 */

const COPY: Record<string, LiveContentCopy> = { 'en-US': en.staffLiveContent, 'es-MX': es.staffLiveContent, 'pt-BR': pt.staffLiveContent };

const STATUS: LiveContentStatus = {
  calibration: { state: 'passed', ageDays: 12, judgeModel: 'qwen3-max', recordedAt: '2026-09-12T00:00:00Z', maxAgeDays: 35 },
  categories: [
    { category: 'standard', suspended: false, reasons: [], rate: 0.5, baseline: 0.15, floor: 0.15, elevated: true, decisionsToRestore: 64, pending: 3, overdue: 0 },
    { category: 'sensitive', suspended: true, reasons: ['concordance_below_floor'], rate: 1, baseline: 0.5, floor: 0.5, elevated: true, decisionsToRestore: 100, pending: 5, overdue: 2 },
  ],
  reviewSlaDays: 7,
};

const PACK: TutorPackSummary = {
  id: 'p1', skill_key: 'kc:money.percent-intro', kc_key: 'money.percent-intro', tier: 3, locale: 'es-MX', status: 'review', pack_version: 1,
  risk_category: 'standard', source: 'hand_authored', demand_pattern: 'kc_without_catalog_content',
  pack: { segments: [{ id: 'a', type: 'number_input' }, { id: 'b', type: 'quiz_mcq' }, { id: 'c', type: 'number_input' }, { id: 'd', type: 'number_input' }] },
};

afterEach(() => vi.unstubAllGlobals());

describe('LiveContentStatusPanel', () => {
  it('states each category in words: open and raised, or paused and why, with the floor', () => {
    render(<LiveContentStatusPanel copy={en.staffLiveContent} locale="en-US" dark={false} phase="ready" status={STATUS} />);
    const standard = document.querySelector('[data-category="standard"]')!;
    expect(standard.textContent).toContain(en.staffLiveContent.open);
    expect(standard.textContent).toContain('50% reviewed, never below 15%');
    expect(standard.textContent).toContain('64 clean reviews to go');
    const sensitive = document.querySelector('[data-category="sensitive"]')!;
    expect(sensitive.getAttribute('data-suspended')).toBe('true');
    expect(sensitive.textContent).toContain(en.staffLiveContent.reason.concordance_below_floor);
    expect(sensitive.textContent).toContain('2 reviews overdue');
    expect(screen.getByText('Calibrated 12 days ago')).toBeTruthy();
    for (const el of document.querySelectorAll('section *')) {
      if (el.children.length === 0 && el.textContent?.trim()) expect(el.closest('[data-copy-role]'), el.textContent).not.toBeNull();
    }
  });

  it('says why everything is paused while the judge is uncalibrated, in every locale', () => {
    for (const [locale, copy] of Object.entries(COPY)) {
      const { unmount } = render(<LiveContentStatusPanel copy={copy} locale={locale} dark phase="ready" status={{
        ...STATUS,
        calibration: { state: 'uncalibrated', ageDays: null, judgeModel: null, recordedAt: null, maxAgeDays: 35 },
        categories: STATUS.categories.map((c) => ({ ...c, suspended: true, reasons: ['uncalibrated'], elevated: false })),
      }} />);
      expect(screen.getByText(copy.judge.uncalibrated)).toBeTruthy();
      expect(screen.getAllByText(copy.reason.uncalibrated)).toHaveLength(2);
      unmount();
    }
  });

  it('shows the loading and failure states without inventing numbers', () => {
    const { rerender } = render(<LiveContentStatusPanel copy={en.staffLiveContent} locale="en-US" dark={false} phase="loading" status={null} />);
    expect(screen.getByRole('status').textContent).toBe(en.staffLiveContent.loading);
    rerender(<LiveContentStatusPanel copy={en.staffLiveContent} locale="en-US" dark={false} phase="failed" status={null} />);
    expect(screen.getByRole('alert').textContent).toBe(en.staffLiveContent.loadFailed);
    expect(document.querySelector('[data-category]')).toBeNull();
  });
});

describe('LiveReviewDecision', () => {
  const item = { id: 's1', category: 'standard' as const, prompt: 'A notebook costs 7 coins.' };

  it('offers three EQUAL decisions, none pre-selected, and reports the one chosen', async () => {
    const onDecide = vi.fn(async () => 'recorded' as const);
    render(<LiveReviewDecision copy={en.staffLiveContent} locale="en-US" dark={false} item={item} onDecide={onDecide} />);
    const buttons = screen.getByRole('group', { name: en.staffLiveContent.reviewLabel }).querySelectorAll('button');
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(b.className).toBe(buttons[0]!.className);
    expect(document.activeElement).not.toBe(buttons[0]);
    expect(screen.getByText(item.prompt).getAttribute('data-copy-role')).toBe('data');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.staffLiveContent.safety })); });
    expect(onDecide).toHaveBeenCalledWith('safety');
    expect(screen.getByRole('status').textContent).toBe(en.staffLiveContent.decided);
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('keeps the decisions on a failed save and says a stale decision was already made', async () => {
    const { unmount } = render(<LiveReviewDecision copy={en.staffLiveContent} locale="en-US" dark={false} item={item} onDecide={async () => 'failed'} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.staffLiveContent.approve })); });
    expect(screen.getByRole('alert').textContent).toBe(en.staffLiveContent.decideFailed);
    expect(screen.getByRole('group')).toBeTruthy();
    unmount();
    render(<LiveReviewDecision copy={en.staffLiveContent} locale="en-US" dark={false} item={item} onDecide={async () => 'already'} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.staffLiveContent.quality })); });
    expect(screen.getByRole('status').textContent).toBe(en.staffLiveContent.alreadyDecided);
  });
});

describe('PackRelease', () => {
  it('publishes a pack and lists every reason when Core refuses one', async () => {
    const onStatus = vi.fn()
      .mockResolvedValueOnce({ ok: false, failures: ['segment pack-x-1: bad key', 'tier below tier_min'] })
      .mockResolvedValueOnce({ ok: true });
    render(<PackRelease copy={en.staffLiveContent} locale="en-US" dark={false} packs={[PACK]} onStatus={onStatus} />);
    expect(screen.getByText('Tier 3, es-MX, 4 activities')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.staffLiveContent.publish })); });
    expect(onStatus).toHaveBeenLastCalledWith('p1', 'published');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(en.staffLiveContent.refused);
    expect(alert.querySelectorAll('li')).toHaveLength(2);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en.staffLiveContent.publish })); });
    expect(screen.getByRole('status').textContent).toBe(en.staffLiveContent.published);
  });

  it('says so when nothing waits', () => {
    render(<PackRelease copy={es.staffLiveContent} locale="es-MX" dark={false} packs={[]} onStatus={vi.fn()} />);
    expect(screen.getByText(es.staffLiveContent.packsEmpty)).toBeTruthy();
  });
});

describe('the client API layer', () => {
  it('maps each decision to a closed verdict body', () => {
    expect(reviewBody('approve')).toEqual({ status: 'approved' });
    expect(reviewBody('quality')).toEqual({ status: 'rejected', issue: 'quality' });
    expect(reviewBody('safety')).toEqual({ status: 'rejected', issue: 'safety' });
  });

  it('sends the staff session and the verdict, and reads the envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 's1', status: 'rejected', issue: 'safety' }, error: null }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await decideLiveItem('tok', 's1', 'safety');
    expect(result.data).toEqual({ id: 's1', status: 'rejected', issue: 'safety' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/admin/tutor/review-queue/s1/status');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(String(init.body))).toEqual({ status: 'rejected', issue: 'safety' });
  });

  it('carries the contract failures of a refused publish, and never guesses a success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: null, error: { code: 'PACK_CONTRACT_FAILED', message: 'x', failures: ['a', 'b'] },
    }), { status: 422 })));
    expect(await setPackStatus('tok', 'p1', 'published')).toEqual({
      data: null, error: { code: 'PACK_CONTRACT_FAILED', message: 'x', failures: ['a', 'b'] },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
    expect((await getLiveContentStatus('tok')).error?.code).toBe('INTERNAL');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await getLiveContentStatus('tok')).error?.message).toBe('Network error');
  });
});
