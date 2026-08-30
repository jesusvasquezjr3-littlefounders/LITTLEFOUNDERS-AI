import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceConsentControl } from '../VoiceConsentControl';
import { getVoiceConsent, grantVoiceConsent, revokeVoiceConsent } from '../tutorApi';

/*
 * The microphone consent control (/ORACLE.md §4.3), tested at the one place
 * a mistake here is a PARENT's problem: does the screen actually say what
 * just happened after they act on it. Round 30 (2026-08-30) found real
 * defects at exactly that seam that no existing test caught, because this
 * component had none.
 */

vi.mock('../tutorApi', async () => {
  const actual = await vi.importActual<typeof import('../tutorApi')>('../tutorApi');
  return { ...actual, getVoiceConsent: vi.fn(), grantVoiceConsent: vi.fn(), revokeVoiceConsent: vi.fn() };
});

const INACTIVE = { data: { active: false, grantedAt: null, locale: null, policy: 'allowed' as const }, error: null };
const ACTIVE = {
  data: { active: true, grantedAt: '2026-08-30T00:00:00.000Z', locale: 'en-US', policy: 'allowed' as const },
  error: null,
};
const READ_FAILED = { data: null, error: { code: 'INTERNAL', message: 'boom' } };

beforeEach(() => {
  vi.mocked(getVoiceConsent).mockResolvedValue(INACTIVE);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Opens the confirmation panel and presses through to the actual grant. */
async function grantThroughUi() {
  fireEvent.click(await screen.findByRole('button', { name: 'Allow the microphone' }));
  fireEvent.click(screen.getByRole('button', { name: 'I allow it' }));
}

/*
 * Found by adversarial review, round 30 (2026-08-30, MEDIUM): the grant
 * itself succeeded server-side, but the confirmation refresh right after it
 * failed — and that used to collapse the whole control to `'error'`, which
 * renders IDENTICALLY to "never granted": the Grant button reappears and
 * the status line says the microphone is off, even though it just turned
 * on. A guardian who completed the deliberate two-step confirmation would
 * see their own action apparently undone.
 */
describe('a grant that lands, followed by a refresh that fails', () => {
  it('still shows the microphone as active, not reverted to Grant', async () => {
    vi.mocked(grantVoiceConsent).mockResolvedValue({
      data: { granted: true, grantedAt: '2026-08-30T00:00:00.000Z' },
      error: null,
    });
    vi.mocked(getVoiceConsent).mockResolvedValueOnce(INACTIVE).mockResolvedValueOnce(READ_FAILED);

    render(<VoiceConsentControl kidUserId="kid-1" token="tok" kidName="Ana" />);
    await grantThroughUi();

    await waitFor(() => expect(getVoiceConsent).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Turn the microphone off' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Allow the microphone' })).not.toBeInTheDocument();
  });
});

/*
 * The sibling case: a revoke that lands, followed by a refresh that fails.
 * "Inactive" and "error" happen to render the identical button (Grant), so
 * the decisive difference is the error banner: pre-fix, the failed refresh
 * regressed the whole control to `'error'` and showed "We couldn't save
 * that" underneath a revoke that had, in fact, already succeeded.
 */
describe('a revoke that lands, followed by a refresh that fails', () => {
  it('does not show a failure message for a revoke that actually succeeded', async () => {
    vi.mocked(getVoiceConsent).mockResolvedValueOnce(ACTIVE).mockResolvedValueOnce(READ_FAILED);
    vi.mocked(revokeVoiceConsent).mockResolvedValue({ data: { revoked: true }, error: null });

    render(<VoiceConsentControl kidUserId="kid-1" token="tok" kidName="Ana" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Turn the microphone off' }));

    await waitFor(() => expect(getVoiceConsent).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Allow the microphone' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('a genuinely first, never-succeeded load', () => {
  it('still shows the error state — there is nothing confirmed yet to fall back to', async () => {
    vi.mocked(getVoiceConsent).mockResolvedValue(READ_FAILED);
    render(<VoiceConsentControl kidUserId="kid-1" token="tok" kidName="Ana" />);
    expect(await screen.findByRole('status')).toHaveTextContent(/try again/i);
  });
});
