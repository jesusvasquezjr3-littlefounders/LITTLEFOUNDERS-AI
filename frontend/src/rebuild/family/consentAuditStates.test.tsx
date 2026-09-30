import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import enPractices from '../../i18n/en-US/dataPractices.json';
import esPractices from '../../i18n/es-MX/dataPractices.json';
import ptPractices from '../../i18n/pt-BR/dataPractices.json';
import enGovernance from '../../i18n/en-US/familyGovernance.json';
import { AdultResearch } from './AdultResearch';
import { DataPracticeConsent, practiceLabel, type DataPracticesCopy } from './DataPracticeConsent';
import { MyDataPractices } from './MyDataPractices';
import {
  fetchKidDataPractices, fetchMyDataPractices, PRACTICE_GROUPS, setKidDataPractice, setMyDataPractice,
  type DataPracticeState, type PracticeGroup,
} from './dataPracticesApi';
import type { Session } from './familyHubApi';
import { fetchMyResearch, type Research } from './governanceApi';

/*
 * GAP-FIX-R8 (OD-9 section 4.2, S10.3c; owner review H-25; Bible 02 section 7 item 10, 03 section 5, 06 section 7; CLAUDE.md:
 * text fit, proportion and copy budget before merging UI): the OD-9 consent panels and the H-25 research card render only for a
 * migrated child or a lapsed/own research yes, so the audits measured them only once the synthetic Core answered such a
 * population. This pins (1) core.mjs's not-migrated default still answering every other scenario, (2) every new lane answer
 * against the validators the pages use (a refused shape would render nothing, and the audit would measure nothing with every gate
 * green), and (3) every selector the new audit states press to the markup the surfaces render.
 */
type Answer = { status: number; body: { data: unknown; error: { code: string } | null } } | { fail: string } | undefined;
type Request = { method: string; postData?: string };
type Responder = (args: { core: object; spec: Record<string, unknown>; locale: string; path: string; request: Request; ok: (data: unknown) => Answer }) => Answer;
type LaneState = { id: string; entry: string; path?: string; scenario?: string; open?: string[]; openReady?: string; readyAll?: string[]; firstView?: boolean };
type Lane = { respond: Responder; scenarios: Record<string, Record<string, unknown>>; states: LaneState[] };

const load = async <T,>(file: string) => await import(/* @vite-ignore */ pathToFileURL(resolve(__dirname, `../../../scripts/audits/lanes/${file}`)).href) as T;
const core = await load<Lane>('core.mjs');
const family = await load<Lane & {
  PRACTICES: { toggle: string; group: (group: string) => string; missing: string; refused: string; own: string };
  PRACTICE_STATES: Array<[string, PracticeGroup]>;
}>('family.mjs');
const profile = await load<Lane & { RESEARCH_CARD: { ask: string; stop: string; confirm: string } }>('profile.mjs');
const { PRACTICES } = family;
const { RESEARCH_CARD } = profile;

const KID_A = '22222222-2222-4222-8222-222222222222';
const KID_B = '33333333-3333-4333-8333-333333333333';
const ok = (data: unknown): Answer => ({ status: 200, body: { data, error: null } });
const COPY: Record<string, DataPracticesCopy> = { 'en-US': enPractices as DataPracticesCopy, 'es-MX': esPractices as DataPracticesCopy, 'pt-BR': ptPractices as DataPracticesCopy };

/** A session whose transport is the lane's synthetic Core for one scenario (the lane order of synthetic-core.mjs: core first). */
function session(lane: Lane, scenario: string): Session {
  const spec = lane.scenarios[scenario]!;
  expect(spec, scenario).toBeDefined();
  return {
    token: 'synthetic',
    transport: async (path, options) => {
      const request = { method: options.method ?? 'GET', postData: options.body === undefined ? undefined : JSON.stringify(options.body) };
      const args = { core: {}, spec, locale: 'en-US', path, request, ok };
      const answer = core.respond(args) ?? lane.respond(args);
      if (!answer || 'fail' in answer) throw new Error(`the synthetic Core does not answer ${request.method} ${path} in ${scenario}`);
      return answer.body as never;
    },
  };
}

afterEach(() => cleanup());

describe('the synthetic Core for the OD-9 consent surfaces', () => {
  it('keeps core.mjs\'s not-migrated default for every scenario that declares no migrated child', () => {
    for (const [lane, scenario] of [[family, 'family-two'], [family, 'money-child'], [family, 'money-teen'], [profile, 'profile-adult'], [profile, 'profile-kid']] as const) {
      for (const path of ['/family-hub/data-practices/me', `/family-hub/kids/${KID_A}/data-practices`]) {
        const answer = core.respond({ core: {}, spec: lane.scenarios[scenario]!, locale: 'en-US', path, request: { method: 'GET' }, ok });
        expect(answer, `${scenario} ${path}`).toMatchObject({ status: 200, body: { data: { migrated: false, practices: [] } } });
      }
    }
    // The scenarios that declare one are left to the family lane.
    for (const scenario of ['family-practices', 'family-practices-refused', 'money-child-practices', 'money-teen-practices']) {
      expect(core.respond({ core: {}, spec: family.scenarios[scenario]!, locale: 'en-US', path: '/family-hub/data-practices/me', request: { method: 'GET' }, ok }), scenario).toBeUndefined();
    }
  });

  it('answers the Tutor a migrated child with every group, some answered and some not, and any other child as not migrated', async () => {
    const res = await fetchKidDataPractices(KID_A, session(family, 'family-practices'));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toMatchObject({ migrated: true, hasTutor: true });
    const answerable = res.data.practices.filter((p) => !p.ownFlow);
    for (const group of PRACTICE_GROUPS) expect(answerable.some((p) => p.kind === group), group).toBe(true);
    expect(answerable.some((p) => p.consented)).toBe(true);
    expect(answerable.some((p) => !p.consented)).toBe(true);
    // For a migrated child a practice applies only with a consent, and research stays in its own flow.
    expect(res.data.practices.every((p) => p.applies === p.consented)).toBe(true);
    expect(res.data.practices.filter((p) => p.ownFlow).map((p) => p.key)).toEqual(['research.family_longitudinal']);
    expect(res.data.practices.some((p) => p.selfGrantable)).toBe(false);
    const other = await fetchKidDataPractices(KID_B, session(family, 'family-practices'));
    expect(other).toMatchObject({ ok: true, data: { migrated: false } });
  });

  it('answers a Tutor\'s yes in the answered shape, and refuses it in the refused scenario', async () => {
    const yes = await setKidDataPractice(KID_A, 'analytics.engagement_heartbeats', { grant: true, disclosureVersion: 1 }, session(family, 'family-practices'));
    expect(yes.ok).toBe(true);
    if (yes.ok) expect(yes.data.practices.find((p) => p.key === 'analytics.engagement_heartbeats')).toMatchObject({ consented: true, grantor: 'tutor', applies: true });
    const refused = await setKidDataPractice(KID_A, 'analytics.engagement_heartbeats', { grant: true, disclosureVersion: 1 }, session(family, 'family-practices-refused'));
    expect(refused).toEqual({ ok: false, code: 'DATA_PRACTICE_NOT_ALLOWED' });
    // The refused scenario still reads (the panel re-reads after a refusal).
    expect(await fetchKidDataPractices(KID_A, session(family, 'family-practices-refused'))).toMatchObject({ ok: true, data: { migrated: true } });
  });

  it('answers the migrated child\'s own view (a no only) and the migrated teen\'s (the usage counts self-grantable)', async () => {
    const child = await fetchMyDataPractices(session(family, 'money-child-practices'));
    expect(child).toMatchObject({ ok: true, data: { migrated: true, hasTutor: true } });
    if (child.ok) {
      expect(child.data.practices.some((p) => p.selfGrantable)).toBe(false);
      expect(child.data.practices.some((p) => p.consented && p.grantor === 'tutor')).toBe(true);
    }
    const teen = await fetchMyDataPractices(session(family, 'money-teen-practices'));
    expect(teen).toMatchObject({ ok: true, data: { migrated: true, hasTutor: false } });
    if (teen.ok) {
      const selfGrantable = teen.data.practices.filter((p) => p.selfGrantable);
      expect(selfGrantable.length).toBeGreaterThan(0);
      expect(selfGrantable.every((p) => p.kind === 'analytics_event_class')).toBe(true);
      expect(selfGrantable.some((p) => !p.consented)).toBe(true);
    }
    const own = await setMyDataPractice('analytics.engagement_heartbeats', { grant: true, disclosureVersion: 1 }, session(family, 'money-teen-practices'));
    expect(own.ok).toBe(true);
    if (own.ok) expect(own.data.practices.find((p) => p.key === 'analytics.engagement_heartbeats')).toMatchObject({ consented: true, grantor: 'self' });
  });

  it('answers the H-25 research card: the lapsed yes asks again, the adult\'s own yes can stop', async () => {
    const lapsed = await fetchMyResearch(session(profile, 'settings-research-lapsed'));
    expect(lapsed).toMatchObject({ ok: true, data: { research: { lapsed: true, participating: true, grantor: 'tutor', adult: true, recording: false } } });
    const self = await fetchMyResearch(session(profile, 'settings-research-self'));
    expect(self).toMatchObject({ ok: true, data: { research: { participating: true, grantor: 'self', adult: true } } });
  });
});

describe('the audit states reach each consent surface through a real route', () => {
  const state = (lane: Lane, id: string) => {
    const found = lane.states.find((s) => s.id === `app:${id}`);
    expect(found, id).toBeDefined();
    return found!;
  };

  it('declares each state on the route that mounts the surface, signed in as the population it serves', () => {
    for (const [suffix] of family.PRACTICE_STATES) expect(state(family, `/family@data-practices${suffix}`)).toMatchObject({ path: `/family?child=${KID_A}`, scenario: 'family-practices' });
    expect(state(family, '/family@data-practices-closed')).toMatchObject({ scenario: 'family-practices' });
    expect(state(family, '/family@data-practices-refused')).toMatchObject({ scenario: 'family-practices-refused', openReady: PRACTICES.refused });
    for (const id of ['/family-wallet@child-practices', '/family-wallet@child-practices-open']) expect(state(family, id)).toMatchObject({ path: '/family-wallet', scenario: 'money-child-practices' });
    for (const id of ['/wallet@teen-practices', '/wallet@teen-practices-open']) expect(state(family, id)).toMatchObject({ path: '/wallet', scenario: 'money-teen-practices' });
    expect(state(profile, '/profile/settings@research-lapsed')).toMatchObject({ path: '/profile/settings', scenario: 'settings-research-lapsed' });
    expect(state(profile, '/profile/settings@research-self')).toMatchObject({ scenario: 'settings-research-self', open: [RESEARCH_CARD.stop], openReady: RESEARCH_CARD.confirm });
    // Every group is opened by some state, so every practice label is measured.
    expect(new Set(family.PRACTICE_STATES.map(([, group]) => group))).toEqual(new Set(PRACTICE_GROUPS));
  });

  it('presses controls the Tutor\'s panel renders, group by group, in every locale', async () => {
    const res = await fetchKidDataPractices(KID_A, session(family, 'family-practices'));
    const data = (res as { ok: true; data: DataPracticeState }).data;
    for (const [locale, copy] of Object.entries(COPY)) {
      const props = { copy, kidName: 'Sofía', locale, dark: false, state: data, failed: false, busyKey: null, notice: null, onToggle: () => undefined, onAnswer: () => undefined };
      const closed = render(<DataPracticeConsent {...props} open={false} />);
      expect(closed.container.querySelector(PRACTICES.toggle), locale).not.toBeNull();
      closed.unmount();
      for (const [, group] of family.PRACTICE_STATES) {
        const { container, unmount } = render(<DataPracticeConsent {...props} open />);
        fireEvent.click(container.querySelector(PRACTICES.group(group))!);
        const switches = [...container.querySelectorAll(`[data-practice-group="${group}"] [role="switch"]`)];
        expect(switches.length, `${locale} ${group}`).toBe(data.practices.filter((p) => p.kind === group && !p.ownFlow).length);
        for (const p of data.practices.filter((q) => q.kind === group)) expect(practiceLabel(copy, p.key), `${locale} ${p.key}`).not.toBe('');
        if (group === 'analytics_event_class') expect(container.querySelector(PRACTICES.missing), locale).not.toBeNull();
        unmount();
      }
      const refused = render(<DataPracticeConsent {...props} open notice={{ text: copy.tutor.failed, error: true }} />);
      expect(refused.container.querySelector(PRACTICES.refused)?.textContent).toBe(copy.tutor.failed);
      refused.unmount();
    }
  });

  it('presses the account\'s own panel open for the migrated child and the migrated teen', async () => {
    for (const [scenario, choose] of [['money-child-practices', false], ['money-teen-practices', true]] as const) {
      const res = await fetchMyDataPractices(session(family, scenario));
      const data = (res as { ok: true; data: DataPracticeState }).data;
      const copy = COPY['en-US']!;
      const { container, unmount } = render(<MyDataPractices copy={copy} locale="en-US" dark={false} state={data} busyKey={null} notice={null} onAnswer={() => undefined} />);
      expect(container.textContent, scenario).toContain(choose ? copy.self.bodyChoose : copy.self.bodyOff);
      fireEvent.click(container.querySelector(PRACTICES.own)!);
      const switches = [...container.querySelectorAll('[data-governance="my-data-practices"] [role="switch"]')];
      expect(switches.length, scenario).toBeGreaterThan(0);
      // The child can only say no (every shown practice is on); the teen may also say yes to an unanswered usage count.
      expect(switches.some((s) => (s as HTMLButtonElement).disabled), scenario).toBe(false);
      expect(switches.some((s) => s.getAttribute('aria-checked') === 'false'), scenario).toBe(choose);
      unmount();
    }
  });

  it('presses the H-25 card: the ask offers Yes and No, the stop opens its confirmation', async () => {
    const view = async (scenario: string) => ((await fetchMyResearch(session(profile, scenario))) as { ok: true; data: { research: Research } }).data.research;
    const copy = enGovernance.researchAtEighteen;
    const lapsed = render(<AdultResearch copy={copy} locale="en-US" dark={false} research={await view('settings-research-lapsed')} busy={false} notice={null} onAnswer={() => undefined} />);
    expect([...lapsed.container.querySelectorAll(RESEARCH_CARD.ask)].map((b) => b.textContent)).toEqual([copy.yes, copy.no]);
    lapsed.unmount();
    const self = render(<AdultResearch copy={copy} locale="en-US" dark={false} research={await view('settings-research-self')} busy={false} notice={null} onAnswer={() => undefined} />);
    expect(self.container.querySelector(RESEARCH_CARD.confirm)).toBeNull();
    fireEvent.click(self.container.querySelector(RESEARCH_CARD.stop)!);
    expect([...self.container.querySelectorAll(RESEARCH_CARD.confirm)].map((b) => b.textContent)).toEqual([copy.confirmYes, copy.confirmNo]);
    self.unmount();
  });
});
