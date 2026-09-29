import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { AccountSettingsPreview, AGE_RECORD_FOCUS, DISCOVERABLE_FOCUS, SETTINGS_PREVIEW_STATES } from './ProfileScreensPreview';

/*
 * GAP-FIX-R6 social (Bible 02 §7 item 10, 06 §7, 03 §5; CLAUDE.md: text fit,
 * proportion and copy budget before merging UI): Settings' age card (S-04,
 * OD-28; E.4 as amended by OD-3) and discoverable card (OD-27 (2), S-03) are
 * reached by the audit lane in every state. The preview must render the state
 * each name promises, the lane must list every preview state, and the lane's
 * real-route states must be answered as Core answers them.
 */
type LaneState = { id: string; entry: string; path?: string; scenario?: string; open?: string[]; readyAll?: string[]; query?: Record<string, string> };
type Spec = Record<string, unknown> & { ageScreen?: Record<string, boolean>; ageCorrection?: string; profile?: { social?: { discoverable?: { enabled: boolean } } } };
const lane = await import(/* @vite-ignore */ pathToFileURL(resolve(__dirname, '../../../scripts/audits/lanes/profile.mjs')).href) as {
  states: LaneState[]; scenarios: Record<string, Spec>; SETTINGS_FOCUS_STATES: string[]; correctionAnswer: (spec: Spec) => { eligible: boolean; request: { status: string } | null };
};

afterEach(() => cleanup());

describe('account-settings preview focus states', () => {
  it('renders each age-card kind and correction receipt', () => {
    for (const [state, { kind, status }] of Object.entries(AGE_RECORD_FOCUS)) {
      const { container, unmount } = render(<AccountSettingsPreview locale="en-US" theme="light" state={state} />);
      const card = container.querySelector('[data-setting="age-record"]');
      expect(card?.getAttribute('data-age-record'), state).toBe(kind);
      expect(card?.getAttribute('data-correction'), state).toBe(status ?? 'none');
      unmount();
    }
  });

  it('opens the correction form by a real press, as the lane does', () => {
    const { container } = render(<AccountSettingsPreview locale="es-MX" theme="dark" state="ageForm" />);
    const open = lane.states.find((state) => state.id === 'account-settings@ageForm')!.open![0]!;
    fireEvent.click(container.querySelector(open)!);
    expect(container.querySelector('[data-setting="age-record"] [data-correction-form] input[type="date"]')).not.toBeNull();
    // A pending request offers no second request.
    cleanup();
    const pending = render(<AccountSettingsPreview locale="pt-BR" theme="light" state="agePending" />);
    expect(pending.container.querySelector(open)).toBeNull();
  });

  it('renders the discoverable card in each state, the confirmation included', () => {
    for (const [state, view] of Object.entries(DISCOVERABLE_FOCUS)) {
      const { container, unmount } = render(<AccountSettingsPreview locale="en-US" theme="light" state={state} />);
      expect(container.querySelector('[data-setting="discoverable"] [role="switch"]')?.getAttribute('aria-checked'), state).toBe(String(view.enabled));
      expect(document.querySelector('[role="alertdialog"]') !== null, state).toBe(view.confirming);
      unmount();
    }
  });

  it('is listed in the audit lane, state for state', () => {
    const listed = new Set(lane.states.filter((state) => state.entry === 'preview' && state.query?.screen === 'account-settings').map((state) => state.query!.state));
    const focus = [...Object.keys(AGE_RECORD_FOCUS), ...Object.keys(DISCOVERABLE_FOCUS)];
    expect(new Set(lane.SETTINGS_FOCUS_STATES)).toEqual(new Set(focus));
    for (const state of focus) {
      expect(SETTINGS_PREVIEW_STATES as readonly string[]).toContain(state);
      expect(listed.has(state), state).toBe(true);
    }
  });
});

describe('Settings real-route audit states', () => {
  const byId = (id: string) => lane.states.find((state) => state.id === `app:/profile/settings@${id}`)!;

  it('reaches the correction form, a pending request, both birth-month cards and the discoverable confirmation', () => {
    for (const id of ['teen-age-correction', 'teen-age-correction-pending', 'teen-age-month', 'adult-by-month', 'teen-discoverable-confirm', 'teen-discoverable-on']) {
      expect(byId(id), id).toBeDefined();
    }
    expect(byId('teen-age-correction').open).toEqual(['[data-setting="age-record"] button[aria-expanded="false"]']);
    expect(byId('teen-discoverable-confirm').open?.[0]).toMatch(/\[data-setting="discoverable"\] \[role="switch"\]/);
    expect(lane.scenarios[byId('teen-age-month').scenario!]!.ageScreen).toEqual({ birthMonthRecorded: true, adultByBirthMonth: false });
    expect(lane.scenarios[byId('adult-by-month').scenario!]!.ageScreen?.adultByBirthMonth).toBe(true);
    expect(lane.scenarios[byId('teen-discoverable-on').scenario!]!.profile?.social?.discoverable?.enabled).toBe(true);
  });

  it('answers GET /account/age-correction with Core\'s eligibility rule', () => {
    expect(lane.correctionAnswer(lane.scenarios['settings-teen']!)).toEqual({ eligible: true, request: null });
    expect(lane.correctionAnswer(lane.scenarios['settings-teen-correction-pending']!).request?.status).toBe('pending');
    // A parent-created child and a guest may never ask (E.4: the Tutor gives a child's age; a guest has no account age).
    expect(lane.correctionAnswer(lane.scenarios['profile-kid']!).eligible).toBe(false);
    expect(lane.correctionAnswer(lane.scenarios['profile-guest']!).eligible).toBe(false);
  });
});
