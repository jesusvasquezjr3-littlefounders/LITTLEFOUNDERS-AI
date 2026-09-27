import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mentorCopy } from '../screen/MentorRoute';
import { VoiceConsent, type VoiceConsentApi } from '../VoiceConsent';
import type { ConsentState } from '../session/tutorApi';

/*
 * W2M.3 (C.2): the microphone permission a verified Tutor gives for one child,
 * rebuilt from the legacy control's contract: policy before consent, two
 * presses to grant with the stored wording shown first, one press to revoke,
 * and a failed refresh never undoing a confirmed write.
 */
const copy = mentorCopy('en-US').mentorVoiceConsent;

/** A Core that remembers its writes, as the real one does. */
function api(state: Partial<ConsentState> | null, overrides: Partial<VoiceConsentApi> = {}): VoiceConsentApi {
  let record: ConsentState | null = state === null ? null : { active: false, grantedAt: null, locale: null, policy: 'allowed', ...state };
  return {
    read: vi.fn(async () => record),
    grant: vi.fn(async () => { record = record && { ...record, active: true, grantedAt: '2026-09-26T10:00:00Z' }; return { grantedAt: '2026-09-26T10:00:00Z' }; }),
    revoke: vi.fn(async () => { record = record && { ...record, active: false, grantedAt: null }; return true; }),
    ...overrides,
  };
}

const show = (calls: VoiceConsentApi) => render(<VoiceConsent kidUserId="kid-1" kidName="Ana" api={calls} copy={copy} locale="en-US" />);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('the microphone permission (C.2)', () => {
  it('shows the stored wording before a grant, and sends exactly that wording', async () => {
    const calls = api({});
    show(calls);
    await flush();
    expect(screen.getByText(copy.inactive)).toBeInTheDocument();
    expect(screen.queryByText(copy.body)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: copy.grant }));
    expect(screen.getByText(copy.body)).toBeInTheDocument();
    expect(screen.getByText('For Ana')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.confirm })); });
    expect(calls.grant).toHaveBeenCalledWith({ kidUserId: 'kid-1', consentText: copy.body, locale: 'en-US' });
    expect(screen.getByRole('button', { name: copy.revoke })).toBeInTheDocument();
  });

  it('offers nothing to agree to while minors’ voice is not offered, and says why', async () => {
    show(api({ policy: 'blocked' }));
    await flush();
    expect(screen.getByText(copy.unavailable)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reads an answer without the policy field as blocked, never as permission', async () => {
    show(api({ policy: undefined as unknown as 'allowed' }));
    await flush();
    expect(screen.queryByRole('button', { name: copy.grant })).toBeNull();
  });

  it('keeps revoking open when the policy closed after a grant, in one press', async () => {
    const calls = api({ active: true, grantedAt: '2026-09-01T00:00:00Z', policy: 'blocked' });
    show(calls);
    await flush();
    expect(screen.getByText(copy.pausedByPolicy)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.revoke })); });
    expect(calls.revoke).toHaveBeenCalledWith('kid-1');
    expect(screen.queryByRole('button', { name: copy.revoke })).toBeNull();
  });

  it('keeps a confirmed grant when the refresh after it fails', async () => {
    let reads = 0;
    const calls = api({}, { read: vi.fn(async () => (reads++ === 0 ? { active: false, grantedAt: null, locale: null, policy: 'allowed' as const } : null)) });
    show(calls);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: copy.grant }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.confirm })); });
    await flush();
    expect(screen.getByRole('button', { name: copy.revoke })).toBeInTheDocument();
    expect(screen.queryByText(copy.failed)).toBeNull();
  });

  it('says so when Core cannot be read or a write is refused', async () => {
    const { unmount } = show(api(null));
    await flush();
    expect(screen.getByText(copy.failed)).toBeInTheDocument();
    unmount();
    show(api({}, { grant: vi.fn(async () => null) }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: copy.grant }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.confirm })); });
    expect(screen.getByText(copy.failed)).toBeInTheDocument();
  });

  it('does not read again when the caller hands a new api object on every render', async () => {
    const read = vi.fn(async () => ({ active: false, grantedAt: null, locale: null, policy: 'allowed' as const }));
    const { rerender } = show(api({}, { read }));
    await flush();
    rerender(<VoiceConsent kidUserId="kid-1" kidName="Ana" api={api({}, { read })} copy={copy} locale="en-US" />);
    await flush();
    expect(read).toHaveBeenCalledTimes(1);
  });
});
