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

function stub(active: boolean) {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });

      const payload =
        method === 'GET'
          ? { active, grantedAt: active ? '2026-08-01T00:00:00Z' : null, locale: 'es-MX' }
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
});
