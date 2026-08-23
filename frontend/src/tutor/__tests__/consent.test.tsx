import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceConsentControl } from '../VoiceConsentControl';

/*
 * The microphone gate as a guardian meets it (/ORACLE.md §4.3).
 *
 * Two properties are asserted here and neither is cosmetic:
 *
 * 1. Granting sends the RENDERED wording, not a translation key. Core stores
 *    it verbatim so a later dispute is resolved against what was on the
 *    screen, and a key would make that record meaningless.
 * 2. Revoking takes ONE press while granting takes two. If a parent has second
 *    thoughts the product must not make them read anything first.
 */

const KID = '11111111-1111-4111-8111-111111111111';

let calls: { url: string; method: string; body?: string }[];

function stub(active: boolean, policy: 'allowed' | 'blocked' = 'allowed') {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });

      const payload =
        method === 'GET'
          ? { active, grantedAt: active ? '2026-08-01T00:00:00Z' : null, locale: 'es-MX', policy }
          : { granted: true, grantedAt: '2026-08-21T00:00:00Z' };

      return Promise.resolve(
        new Response(JSON.stringify({ data: payload, error: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }),
  );
}

beforeEach(() => stub(false));
afterEach(() => vi.unstubAllGlobals());

describe('VoiceConsentControl', () => {
  it('does not grant on the first press — it shows the wording first', async () => {
    render(<VoiceConsentControl kidUserId={KID} token="t" kidName="Ana" />);

    fireEvent.click(await screen.findByRole('button', { name: /allow the microphone/i }));

    // Nothing has been sent yet: the guardian has only opened the disclosure.
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect(screen.getByText(/talk out loud with the AI tutor/i)).toBeInTheDocument();
  });

  it('sends the exact wording that was shown, not a translation key', async () => {
    render(<VoiceConsentControl kidUserId={KID} token="t" kidName="Ana" />);

    fireEvent.click(await screen.findByRole('button', { name: /allow the microphone/i }));
    const shown = screen.getByText(/talk out loud with the AI tutor/i).textContent ?? '';
    fireEvent.click(screen.getByRole('button', { name: /i allow it/i }));

    const post = calls.find((c) => c.method === 'POST');
    const body = JSON.parse(post?.body ?? '{}') as { consentText: string; kidUserId: string };
    expect(body.kidUserId).toBe(KID);
    expect(body.consentText).toBe(shown);
    // A key would make the stored record meaningless.
    expect(body.consentText).not.toContain('tutor.consent');
  });

  it('revokes in ONE press — easier than granting, deliberately', async () => {
    stub(true);
    render(<VoiceConsentControl kidUserId={KID} token="t" kidName="Ana" />);

    fireEvent.click(await screen.findByRole('button', { name: /turn the microphone off/i }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
  });

  it('says the microphone is off when there is no consent', async () => {
    render(<VoiceConsentControl kidUserId={KID} token="t" kidName="Ana" />);
    expect(await screen.findByText(/the microphone is off/i)).toBeInTheDocument();
  });

  it('renders nothing at all without a token, rather than a broken control', async () => {
    const { container } = render(<VoiceConsentControl kidUserId={KID} token={null} kidName="Ana" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  /*
   * THE POLICY GATE (/ORACLE.md §16).
   *
   * While `TUTOR_VOICE_FOR_MINORS` is off there is nothing to consent to: the
   * socket refuses a minor's microphone whatever this control says. Offering
   * the switch anyway would take a guardian's agreement to wording that is
   * still a placeholder, in exchange for nothing — which is the specific
   * failure these three tests exist to prevent.
   */
  describe('while policy blocks minors’ voice', () => {
    it('offers no way to grant, and shows no consent wording', async () => {
      stub(false, 'blocked');
      render(<VoiceConsentControl kidUserId={KID} token="t" kidName="Ana" />);

      expect(await screen.findByText(/not offering the microphone to children yet/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /allow the microphone/i })).not.toBeInTheDocument();
      // The placeholder legal text must not be on screen at all — not hidden,
      // not collapsed behind a disclosure. Absent.
      expect(screen.queryByText(/talk out loud with the AI tutor/i)).not.toBeInTheDocument();
    });

    it('never POSTs a consent', async () => {
      stub(false, 'blocked');
      render(<VoiceConsentControl kidUserId={KID} token="t" kidName="Ana" />);
      await screen.findByText(/not offering the microphone to children yet/i);

      expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    });

    it('still lets a guardian revoke a consent granted before the policy closed', async () => {
      stub(true, 'blocked');
      render(<VoiceConsentControl kidUserId={KID} token="t" kidName="Ana" />);

      // Their decision is acknowledged, our limitation is stated, and the way
      // out stays open. Revocation is never gated.
      expect(await screen.findByText(/you allowed this/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /turn the microphone off/i }));
      await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    });

    it('treats a payload with no policy field as blocked, never as permission', async () => {
      calls = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(
            new Response(
              // An older Core, or a field lost in transit. Absent must fail closed.
              JSON.stringify({ data: { active: false, grantedAt: null, locale: 'es-MX' }, error: null }),
              { status: 200, headers: { 'Content-Type': 'application/json' } },
            ),
          ),
        ),
      );
      render(<VoiceConsentControl kidUserId={KID} token="t" kidName="Ana" />);

      expect(await screen.findByText(/not offering the microphone to children yet/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /allow the microphone/i })).not.toBeInTheDocument();
    });
  });
});
