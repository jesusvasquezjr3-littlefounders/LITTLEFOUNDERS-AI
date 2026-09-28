import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import en from '@/i18n/en-US/familyGovernance.json';
import { MyResearch } from '@/rebuild/family/MyResearch';
import { ResearchSetting } from '../ResearchSetting';

/*
 * GAP-FIX-R2 (owner review H-25, D.22): a young adult whose Tutor's research
 * yes lapsed at 18 is asked again in their own Settings. The ask is one short
 * sentence, the disclosure, and Yes / No with nothing preselected; Yes sends
 * the adult's own yes naming the disclosure version, No deletes. Nobody else
 * sees the panel: a guest, an account not taking part, a child (the child's
 * note stays on the wallet pages).
 */

const mocks = vi.hoisted(() => ({
  auth: { session: { user: { id: 'young-adult' } } as unknown, isGuest: false, getToken: vi.fn().mockResolvedValue('jwt') },
  api: vi.fn(),
}));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ isDark: false }) }));
vi.mock('@/lib/api', () => ({ api: mocks.api, BASE_URL: 'http://core.test' }));

const T = '2025-02-01T00:00:00.000Z';
const state = (over: Record<string, unknown> = {}) => ({
  participating: true, recording: false, grantor: 'tutor', since: T, disclosureVersion: 1, adult: true, months: 7, lapsed: true, ...over,
});
const view = (research: Record<string, unknown>) => ({ data: { research, currentVersion: 1 }, error: null });
const copy = en.researchAtEighteen;

beforeEach(async () => {
  await i18n.changeLanguage('en-US');
  mocks.auth.session = { user: { id: 'young-adult' } };
  mocks.auth.isGuest = false;
  mocks.api.mockReset();
});

describe('ResearchSetting (H-25)', () => {
  it('asks an 18-year-old former family child once, with nothing preselected', async () => {
    mocks.api.mockResolvedValue(view(state()));
    const { container } = render(<ResearchSetting />);
    expect(await screen.findByText(copy.lapsed)).toBeVisible();
    for (const line of [copy.what, copy.how, copy.ask]) expect(screen.getByText(line)).toBeVisible();
    const yes = screen.getByRole('button', { name: copy.yes });
    const no = screen.getByRole('button', { name: copy.no });
    for (const button of [yes, no]) {
      expect(button).not.toHaveAttribute('aria-pressed');
      expect(button).not.toHaveAttribute('aria-checked');
    }
    expect(container.querySelector('input:checked')).toBeNull();
    expect(container.querySelector('[data-governance="adult-research"]')).toHaveAttribute('data-research-state', 'lapsed');
    expect(mocks.api).toHaveBeenCalledWith('/family-hub/research/me', expect.objectContaining({ token: 'jwt' }));
  });

  it('records the young adult\'s own yes, naming the disclosure version', async () => {
    mocks.api.mockResolvedValueOnce(view(state())).mockResolvedValueOnce(view(state({ grantor: 'self', lapsed: false, since: '2026-09-28T00:00:00.000Z' })));
    render(<ResearchSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.yes }));
    expect(await screen.findByText(copy.joined)).toBeVisible();
    expect(mocks.api).toHaveBeenLastCalledWith('/family-hub/research/me', expect.objectContaining({ method: 'PUT', body: { participate: true, disclosureVersion: 1 } }));
    // Now taking part on their own yes: they can stop, and are not asked again.
    expect(screen.getByText(copy.self)).toBeVisible();
    expect(screen.queryByRole('button', { name: copy.yes })).toBeNull();
  });

  it('deletes everything on the young adult\'s no', async () => {
    mocks.api.mockResolvedValueOnce(view(state()))
      .mockResolvedValueOnce(view(state({ participating: false, grantor: null, since: null, months: 0, lapsed: false })));
    render(<ResearchSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.no }));
    expect(await screen.findByText(copy.deleted)).toBeVisible();
    expect(mocks.api).toHaveBeenLastCalledWith('/family-hub/research/me', expect.objectContaining({ method: 'PUT', body: { participate: false } }));
    expect(screen.queryByRole('button', { name: copy.yes })).toBeNull();
  });

  it('says it did not save when Core refuses, and keeps the ask', async () => {
    mocks.api.mockResolvedValueOnce(view(state())).mockResolvedValueOnce({ data: null, error: { code: 'RESEARCH_CONSENT_NOT_ALLOWED', message: 'x' } });
    render(<ResearchSetting />);
    fireEvent.click(await screen.findByRole('button', { name: copy.yes }));
    expect(await screen.findByText(copy.failed)).toBeVisible();
    expect(screen.getByRole('button', { name: copy.yes })).toBeEnabled();
  });

  it.each([
    ['an account not taking part', state({ participating: false, grantor: null, since: null, months: 0, lapsed: false, adult: true })],
    ['a child whose Tutor said yes (their note is on the wallet pages)', state({ adult: false, recording: true, lapsed: false })],
  ])('shows nothing to %s', async (_label, research) => {
    mocks.api.mockResolvedValue(view(research));
    const { container } = render(<ResearchSetting />);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    await Promise.resolve();
    expect(container.innerHTML).toBe('');
  });

  it('never asks from a guest session', async () => {
    mocks.auth.isGuest = true;
    const { container } = render(<ResearchSetting />);
    expect(container.innerHTML).toBe('');
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it('leaves an adult out of the child\'s wallet note (the ask lives in Settings)', () => {
    const { container } = render(<MyResearch copy={en.myResearch} locale="en-US" dark={false} research={state() as never} busy={false} notice={null} onStop={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
