import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en-US/dataPractices.json';
import es from '../../i18n/es-MX/dataPractices.json';
import pt from '../../i18n/pt-BR/dataPractices.json';
import { checkCopy, firstViewLimit, wordCount, type AgeBand, type CopyRole, type Locale } from '../design/copyBudget';
import { DataPracticeConsent, practiceLabel, type DataPracticesCopy } from './DataPracticeConsent';
import { MyDataPractices } from './MyDataPractices';
import {
  fetchKidDataPractices, isDataPracticeState, PRACTICE_GROUPS, PRACTICE_KEYS, setKidDataPractice, setMyDataPractice,
  type DataPractice, type DataPracticeState, type PracticeKey,
} from './dataPracticesApi';
import type { Session, TransportResult } from './familyHubApi';

/*
 * S10.3 (OD-9 section 4.2) rebuilt surfaces: a migrated child's Tutor answers
 * each new data practice on its own, nothing preselected; nothing shows for a
 * child who is not a migrated child; research stays in its own section; the
 * account's own view offers a no always and a yes only where the database
 * allows it. Every text node declares its copy role; nothing celebrates; the
 * copy fits its budget in all three locales and keeps the glossary.
 */

const KID = '11111111-1111-4111-8111-111111111111';
const T = '2026-09-27T10:00:00Z';
const copy = en as DataPracticesCopy;

const kindOf = (key: PracticeKey): DataPractice['kind'] => key.startsWith('analytics.') ? 'analytics_event_class' : key.startsWith('mentor.') ? 'mentor_memory_type'
  : key.startsWith('learning.') ? 'learner_record' : key.startsWith('sharing.') ? 'sharing_surface' : 'research';
const practice = (key: PracticeKey, over: Partial<DataPractice> = {}): DataPractice => ({
  key, kind: kindOf(key), requirement: 'X.1', disclosureVersion: 1, ownFlow: key.startsWith('research.'),
  consented: false, applies: false, grantor: null, since: null, selfGrantable: false, ...over,
});
const state = (over: Partial<DataPracticeState> = {}, practices = PRACTICE_KEYS.map((k) => practice(k))): DataPracticeState => ({ migrated: true, hasTutor: true, practices, ...over });

function everyTextHasARole(container: HTMLElement) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
  }
}

function session(answer: (path: string, options: { method?: string; body?: unknown }) => TransportResult) {
  const calls: { path: string; method?: string; body?: unknown }[] = [];
  const s: Session = { token: 't', transport: (path, options) => { calls.push({ path, method: options.method, body: options.body }); return Promise.resolve(answer(path, options)); } };
  return { s, calls };
}

describe('DataPracticeConsent (the Tutor)', () => {
  const props = { copy, kidName: 'Ana', locale: 'en-US', dark: false, failed: false, busyKey: null, notice: null, onToggle: vi.fn() };

  it('shows nothing for a child who is not a migrated child, or before the state is read', () => {
    const { container, rerender } = render(<DataPracticeConsent {...props} open state={state({ migrated: false })} onAnswer={vi.fn()} />);
    expect(container.innerHTML).toBe('');
    rerender(<DataPracticeConsent {...props} open state={null} onAnswer={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('opens one group at a time, preselects nothing, leaves research to its own section, and names the disclosure a yes answers', () => {
    const onAnswer = vi.fn();
    const { container } = render(<DataPracticeConsent {...props} open state={state({}, [
      ...PRACTICE_KEYS.map((k) => practice(k, k === 'mentor.alliance_record' ? { consented: true, applies: true, grantor: 'tutor', since: T } : {})),
    ].map((p) => (p.key === 'analytics.motivation_events' ? { ...p, disclosureVersion: 2 } : p)))} onAnswer={onAnswer} />);
    expect(container.textContent).toContain('Choose each one for Ana.');
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: en.groups.analytics_event_class.heading }));
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(7);
    expect(container.querySelectorAll('[role="switch"][aria-checked="true"]')).toHaveLength(0);
    fireEvent.click(screen.getByRole('switch', { name: en.practices.analytics.motivation_events }));
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ key: 'analytics.motivation_events' }), { grant: true, disclosureVersion: 2 });
    fireEvent.click(screen.getByRole('button', { name: en.groups.mentor_memory_type.heading }));
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(3);
    fireEvent.click(screen.getByRole('switch', { name: en.practices.mentor.alliance_record }));
    expect(onAnswer).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'mentor.alliance_record' }), { grant: false });
    expect(container.textContent).not.toContain(en.practices.research.family_longitudinal);
    everyTextHasARole(container);
    expect(container.textContent).not.toMatch(/!/);
    expect(container.querySelector('[data-celebration], .lf-confetti, [data-milestone]')).toBeNull();
  });

  it('a failed read says so when opened, never an empty list', () => {
    const { container } = render(<DataPracticeConsent {...props} open failed state={null} onAnswer={vi.fn()} />);
    expect(container.textContent).toContain(en.tutor.loadFailed);
  });
});

describe('MyDataPractices (the account itself)', () => {
  it('a child sees only what their Tutor said yes to, and can turn it off', () => {
    const onAnswer = vi.fn();
    const { container } = render(<MyDataPractices copy={copy} locale="en-US" dark={false} busyKey={null} notice={null} onAnswer={onAnswer}
      state={state({}, PRACTICE_KEYS.map((k) => practice(k, k === 'learning.decision_journal' ? { consented: true, applies: true, grantor: 'tutor', since: T } : {})))} />);
    expect(container.textContent).toContain(en.self.bodyOff);
    fireEvent.click(screen.getByRole('button', { name: en.self.open }));
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('switch', { name: en.practices.learning.decision_journal }));
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ key: 'learning.decision_journal' }), { grant: false });
    everyTextHasARole(container);
  });

  it('a self-registered teen with no Tutor chooses the usage counts; nothing shows when there is nothing to answer', () => {
    const onAnswer = vi.fn();
    const { container, rerender } = render(<MyDataPractices copy={copy} locale="en-US" dark={false} busyKey={null} notice={null} onAnswer={onAnswer}
      state={state({ hasTutor: false }, PRACTICE_KEYS.map((k) => practice(k, { selfGrantable: k.startsWith('analytics.') })))} />);
    expect(container.textContent).toContain(en.self.bodyChoose);
    fireEvent.click(screen.getByRole('button', { name: en.self.open }));
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(7);
    fireEvent.click(screen.getByRole('switch', { name: en.practices.analytics.engagement_heartbeats }));
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ key: 'analytics.engagement_heartbeats' }), { grant: true, disclosureVersion: 1 });
    rerender(<MyDataPractices copy={copy} locale="en-US" dark={false} busyKey={null} notice={null} onAnswer={onAnswer} state={state({ migrated: false })} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('dataPracticesApi', () => {
  it('refuses a state it cannot trust: an unknown key, a consent without its grantor', () => {
    expect(isDataPracticeState(state())).toBe(true);
    expect(isDataPracticeState({ ...state(), practices: [{ ...practice('mentor.alliance_record'), key: 'ads.tracking' }] })).toBe(false);
    expect(isDataPracticeState({ ...state(), practices: [practice('mentor.alliance_record', { consented: true })] })).toBe(false);
  });

  it('calls Core only, with the child in the path and the answer in the body; a write must return the answer it made', async () => {
    const { s, calls } = session((path, options) => {
      if (options.method === 'PUT') return { data: state({}, [practice('mentor.alliance_record', { consented: true, applies: true, grantor: 'tutor', since: T })]), error: null };
      return { data: state(), error: null };
    });
    expect((await fetchKidDataPractices(KID, s)).ok).toBe(true);
    expect((await setKidDataPractice(KID, 'mentor.alliance_record', { grant: true, disclosureVersion: 1 }, s)).ok).toBe(true);
    expect(calls[1]).toEqual({ path: `/family-hub/kids/${KID}/data-practices/mentor.alliance_record`, method: 'PUT', body: { grant: true, disclosureVersion: 1 } });
    expect((await setMyDataPractice('mentor.alliance_record', { grant: false }, s)).ok).toBe(false);
  });
});

describe('Data practice copy (S10.3)', () => {
  const files = { 'en-US': en, 'es-MX': es, 'pt-BR': pt } as const;
  const flat = (o: Record<string, unknown>, p = ''): [string, string][] => Object.entries(o).flatMap(([k, v]) => typeof v === 'object' && v !== null
    ? flat(v as Record<string, unknown>, `${p}${k}.`) : [[`${p}${k}`, String(v)] as [string, string]]);
  const role = (key: string): CopyRole => {
    if (key.startsWith('practices.') || key.endsWith('.body') || /^(tutor|self)\.(lead|bodyOff|bodyChoose|saved|failed|loadFailed|loading)$/.test(key)) return 'body';
    if (key.endsWith('.heading')) return 'heading';
    if (/\.(open|close)$/.test(key)) return 'action';
    return 'option';
  };
  const band = (key: string): AgeBand => (key.startsWith('self.') ? '6-9' : 'adult');

  it('has identical keys in every locale and a label for every practice the code knows', () => {
    const keys = (f: Record<string, unknown>) => flat(f).map(([k]) => k).sort();
    expect(keys(es)).toEqual(keys(en));
    expect(keys(pt)).toEqual(keys(en));
    for (const key of PRACTICE_KEYS) for (const f of Object.values(files)) expect(practiceLabel(f as DataPracticesCopy, key), key).toBeTruthy();
    expect(Object.keys(en.groups).sort()).toEqual([...PRACTICE_GROUPS].sort());
  });

  for (const [locale, file] of Object.entries(files)) {
    it(`fits the Copy Budget and keeps the glossary in ${locale}`, () => {
      const all = flat(file);
      for (const [key, text] of all) {
        expect(checkCopy(text.replace('{name}', 'Ana'), role(key), { locale: locale as Locale, ageBand: band(key), surface: 'app' }), key).toEqual([]);
      }
      const text = all.map(([, v]) => v).join(' \n ');
      expect(text).not.toMatch(/—|!/);
      expect(text).not.toMatch(/\b(Tutor|money|dinero|dinheiro|bank|banco|bot|assistant|asistente|assistente|streak freeze)\b/i);
    });

    it(`keeps each view inside its band's first-view budget in ${locale}`, () => {
      const f = file as DataPracticesCopy;
      const ctx = (ageBand: AgeBand) => ({ locale: locale as Locale, ageBand, surface: 'app' as const });
      const adult = firstViewLimit(ctx('adult'))!;
      const young = firstViewLimit(ctx('6-9'))!;
      const groupView = (g: (typeof PRACTICE_GROUPS)[number]) => [f.groups[g].heading, f.groups[g].body,
        ...PRACTICE_KEYS.filter((k) => kindOf(k) === g).map((k) => practiceLabel(f, k))];
      const views: [number, string[]][] = [
        [adult, [f.tutor.heading, f.tutor.open, f.tutor.lead.replace('{name}', 'Ana')]],
        [adult, [f.tutor.heading, f.tutor.close, f.tutor.lead.replace('{name}', 'Ana'), ...PRACTICE_GROUPS.map((g) => f.groups[g].heading)]],
        ...PRACTICE_GROUPS.map((g) => [adult, groupView(g)] as [number, string[]]),
        [young, [f.self.heading, f.self.open, f.self.bodyChoose]],
      ];
      for (const [limit, view] of views) expect(wordCount(view.join(' ')), view[0]).toBeLessThanOrEqual(limit);
    });
  }
});
