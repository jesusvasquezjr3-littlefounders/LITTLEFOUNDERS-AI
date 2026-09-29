import { useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { DiscoverableCard, discoverableVisible, type DiscoverableCopy, type DiscoverableReason, type DiscoverableStatus } from '@/rebuild/account/DiscoverableCard';
import { isOffline } from './profileRouteKit';

/*
 * P3 data plane for OD-27 (2) (S-03): a 16- or 17-year-old opts in to, or
 * out of, a discoverable profile.
 *
 *   read   Settings' own GET /profile: `social.discoverable { canChoose, enabled }`,
 *          sent only for the teen tier. Absent or malformed = not offered (an
 *          older Core, a child, an adult): private stays the default.
 *   write  PUT /profile/discoverable { discoverable }. Core decides again
 *          (DISCOVERABLE_NOT_ELIGIBLE for a child, a 13-15-year-old, a teen
 *          whose age evidence cannot prove 16, a flagged profile, an adult,
 *          a guest). The card changes only on Core's receipt, and shows the
 *          state Core returns, never the one that was asked for.
 *   OD-9   4.2 (GAP-FIX-R3): `reason: 'DATA_PRACTICE_CONSENT_REQUIRED'` (read or
 *          a refused write) means a migrated teen whose Tutor has not yet
 *          consented to the discoverable-profile practice: the card says a
 *          Tutor must allow it first and offers no switch. Any other or
 *          absent reason names nothing.
 */

export interface DiscoverableState { enabled: boolean; canChoose: boolean; reason: DiscoverableReason }

const readReason = (raw: unknown): DiscoverableReason => (raw === 'DATA_PRACTICE_CONSENT_REQUIRED' ? 'consentRequired' : null);

/** `social.discoverable` from GET /profile (or the PUT receipt's `discoverable`). */
function parseState(state: { canChoose?: unknown; enabled?: unknown; reason?: unknown } | null | undefined): DiscoverableState | null {
  if (!state || typeof state.canChoose !== 'boolean' || typeof state.enabled !== 'boolean') return null;
  return { canChoose: state.canChoose, enabled: state.enabled, reason: readReason(state.reason) };
}

/** `social.discoverable` from GET /profile, only for the teen tier. */
export function parseDiscoverable(raw: unknown): DiscoverableState | null {
  const social = (raw as { social?: { tier?: unknown; discoverable?: { canChoose?: unknown; enabled?: unknown; reason?: unknown } | null } | null } | null)?.social;
  if (social?.tier !== 'teen') return null;
  return parseState(social.discoverable);
}

export function DiscoverableSetting({ copy, initial }: { copy: DiscoverableCopy; initial: DiscoverableState | null }) {
  const { getToken } = useAuth();
  const [state, setState] = useState<DiscoverableState | null>(initial);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<DiscoverableStatus>(null);
  const inFlight = useRef(false);

  if (!state || (!discoverableVisible(state) && status !== 'notEligible' && status !== 'consentRequired')) return null;

  async function save(next: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setStatus(null);
    const token = await getToken();
    const result = token ? await api<{ discoverable?: unknown }>('/profile/discoverable', { method: 'PUT', token, body: { discoverable: next } }) : null;
    inFlight.current = false;
    setSaving(false);
    setConfirming(false);
    if (!result || result.error) {
      const code = result?.error?.code;
      if (code === 'DISCOVERABLE_NOT_ELIGIBLE') {
        // Core no longer offers turning it on: hide the switch, keep what Core last said is on.
        setState((current) => current ? { enabled: next ? current.enabled : false, canChoose: false, reason: null } : current);
        setStatus('notEligible');
        return;
      }
      if (code === 'DATA_PRACTICE_CONSENT_REQUIRED') {
        // OD-9 4.2: a Tutor must consent first. Hide the switch and say so.
        setState((current) => current ? { enabled: next ? current.enabled : false, canChoose: false, reason: 'consentRequired' } : current);
        setStatus('consentRequired');
        return;
      }
      setStatus(isOffline(result?.error) ? 'offline' : 'failed');
      return;
    }
    const receipt = parseState(result.data?.discoverable as { canChoose?: unknown; enabled?: unknown; reason?: unknown } | undefined);
    if (!receipt || receipt.enabled !== next) {
      setStatus('failed');
      return;
    }
    setState(receipt);
    setStatus('saved');
  }

  return <DiscoverableCard copy={copy} view={{ ...state, confirming, saving, status }}
    onToggle={(next) => {
      if (saving) return;
      setStatus(null);
      // Turning it on widens who can see a minor: ask first. Turning it off is one press.
      if (next) setConfirming(true);
      else void save(false);
    }}
    onConfirm={() => void save(true)}
    onKeep={() => { if (!saving) setConfirming(false); }} />;
}
