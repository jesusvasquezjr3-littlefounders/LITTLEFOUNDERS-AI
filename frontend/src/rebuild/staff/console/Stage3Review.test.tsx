import { selectOption } from '../../test/selectOption';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RebuildProvider, RebuildRoot } from '../../design/controls';
import type { Locale } from '../../design/copyBudget';
import en from '@/i18n/en-US/rebuild-staff.json';
import es from '@/i18n/es-MX/rebuild-staff.json';
import pt from '@/i18n/pt-BR/rebuild-staff.json';
import sections from './staffSectionFixtures.json';
import type { StaffApi, StaffResult } from './staffConsoleApi';
import { releaseRefusal } from './contentApi';
import { Stage3Review } from './Stage3Review';
import { stage3Body, stage3Status, STAGE3_ITEMS, type Stage3State } from './stage3Api';

/*
 * GAP-FIX-R6 learning, Appendix C Part 3 Stage 3 at the component boundary:
 * the panel names whether a passing review covers the content, and the form
 * saves only a complete review (the ten items each with a result and a named
 * finding, every open Forge flag resolved with a note, the Content Author),
 * posting exactly what Core validates. Core's refusals are named.
 */

const t = en.staffConsole.stage3;
const STATE = sections.stage3Review as unknown as Stage3State;
const LESSON = STATE.lessonId;
const FINDING = 'Checked against the Block B standard for this lesson.';

function Frame({ children, locale = 'en-US' }: { children: ReactNode; locale?: Locale }) {
  return <RebuildRoot theme="light" locale={locale}><RebuildProvider environment={{ theme: 'light', locale }} labels={{ dismiss: 'Dismiss' }}>{children}</RebuildProvider></RebuildRoot>;
}

function fakeApi(state: unknown, post: (body: unknown) => StaffResult<unknown> = () => ({ ok: true, data: { reviewId: 'r2', result: 'pass' } })) {
  const gets: string[] = [];
  const posts: { path: string; body: unknown }[] = [];
  const api: StaffApi = {
    get: async <T,>(path: string) => { gets.push(path); return { ok: true, data: state } as StaffResult<T>; },
    post: async <T,>(path: string, body: unknown) => { posts.push({ path, body }); return post(body) as StaffResult<T>; },
  };
  return { api, gets, posts };
}

async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: t.action.open }));
  return screen.getByRole('button', { name: t.action.save });
}

function answerAll(result: 'pass' | 'fail' = 'pass') {
  for (const item of STAGE3_ITEMS) {
    const box = document.querySelector(`[data-stage3-item="${item.id}"]`) as HTMLElement;
    fireEvent.click(within(box).getByRole('radio', { name: t.option[result] }));
    fireEvent.change(within(box).getByLabelText(t.body.finding), { target: { value: FINDING } });
  }
}

function resolveFlags() {
  for (const flag of STATE.openItems) {
    const box = document.querySelector(`[data-stage3-flag="${flag.id}"]`) as HTMLElement;
    fireEvent.click(within(box).getByRole('radio', { name: t.option.acceptable }));
    fireEvent.change(within(box).getByLabelText(t.body.note), { target: { value: 'It teaches the idea and offers nothing.' } });
  }
}

beforeEach(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); });
afterEach(cleanup);

describe('Stage 3 review panel', () => {
  it('names the latest failed review, its findings and the open Forge flags', async () => {
    const { api, gets } = fakeApi(STATE);
    render(<Frame><Stage3Review api={api} lessonId={LESSON} /></Frame>);
    const panel = await screen.findByRole('region', { name: t.heading.review });
    await waitFor(() => expect(panel).toHaveAttribute('data-stage3', 'failed'));
    expect(within(panel).getAllByText(t.body.failed).length).toBeGreaterThan(0);
    expect(panel).toHaveTextContent(t.body.failedNote);
    expect(gets).toEqual([`/admin/content/lessons/${LESSON}/pedagogical-review`]);
    expect(stage3Status({ ...STATE, refusal: null })).toBe('passed');
    expect(stage3Status({ ...STATE, latest: null })).toBe('needed');
    expect(stage3Status({ ...STATE, latest: { ...STATE.latest!, result: 'pass' } })).toBe('itemsOpen');
  });

  it('saves only a complete review, and posts exactly the review Core validates', async () => {
    const { api, posts, gets } = fakeApi(STATE);
    render(<Frame><Stage3Review api={api} lessonId={LESSON} /></Frame>);
    const save = await openForm();
    expect(save).toBeDisabled();
    expect(screen.getByText(t.body.incomplete)).toBeInTheDocument();
    answerAll();
    expect(save).toBeDisabled(); // flags and author still missing
    resolveFlags();
    expect(save).toBeDisabled();
    selectOption(screen.getByLabelText(t.body.author), STATE.authors[1]!.displayName);
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(await screen.findByText(t.body.recordedPass)).toBeInTheDocument();
    expect(posts).toHaveLength(1);
    expect(posts[0]!.path).toBe(`/admin/content/lessons/${LESSON}/pedagogical-review`);
    const body = posts[0]!.body as { fingerprint: string; authorId: string; checks: Record<string, unknown>; forgeItems: unknown[] };
    expect(body.fingerprint).toBe(STATE.fingerprint);
    expect(body.authorId).toBe(STATE.authors[1]!.userId);
    expect(Object.keys(body.checks)).toEqual(STAGE3_ITEMS.map((item) => item.id));
    expect(body.forgeItems).toEqual(STATE.openItems.map((flag) => ({ id: flag.id, resolution: 'acceptable', note: 'It teaches the idea and offers nothing.' })));
    await waitFor(() => expect(gets.length).toBe(2));
  });

  it('offers not applicable only on the four scoped items', async () => {
    const { api } = fakeApi(STATE);
    render(<Frame><Stage3Review api={api} lessonId={LESSON} /></Frame>);
    await openForm();
    for (const item of STAGE3_ITEMS) {
      const box = document.querySelector(`[data-stage3-item="${item.id}"]`) as HTMLElement;
      expect(within(box).queryByRole('radio', { name: t.option.not_applicable }) !== null, item.id).toBe(item.allowsNotApplicable);
    }
  });

  it('refuses a short finding in the body builder, and a version with a recorded author needs no author', () => {
    const draft = { authorId: '', forgeItems: {}, checks: Object.fromEntries(STAGE3_ITEMS.map((item) => [item.id, { result: 'pass' as const, finding: FINDING }])) };
    const version: Stage3State = { ...STATE, subject: 'version', fingerprint: null, documentVersionId: 'v-1', versionAuthorId: 'writer', openItems: [] };
    expect(stage3Body(version, draft)).toMatchObject({ documentVersionId: 'v-1' });
    expect(stage3Body(version, draft)).not.toHaveProperty('authorId');
    expect(stage3Body(version, { ...draft, checks: { ...draft.checks, practice_zone: { result: 'pass', finding: 'ok' } } })).toBeNull();
    expect(stage3Body(version, { ...draft, checks: { ...draft.checks, working_memory: { result: 'not_applicable', finding: FINDING } } })).toBeNull();
    expect(stage3Body({ ...version, versionAuthorId: null }, draft)).toBeNull();
  });

  it('names a refusal (the reviewer wrote the content) and an outage', async () => {
    const { api } = fakeApi(STATE, () => ({ ok: false, code: 'STAGE3_SELF_REVIEW' }));
    render(<Frame><Stage3Review api={api} lessonId={LESSON} /></Frame>);
    const save = await openForm();
    answerAll('fail');
    resolveFlags();
    selectOption(screen.getByLabelText(t.body.author), STATE.authors[0]!.displayName);
    fireEvent.click(save);
    expect(await screen.findByText(t.body.selfReview)).toBeInTheDocument();
  });

  it('a release refused for want of a review is named with its next step, in every locale', () => {
    expect(releaseRefusal('RELEASE_STAGE3_REVIEW_REQUIRED')).toBe('releaseStage3Required');
    for (const copy of [en, es, pt]) {
      expect(copy.staffConsole.content.body.releaseStage3Required).toBeTruthy();
      expect(Object.keys(copy.staffConsole.stage3.body)).toEqual(Object.keys(t.body));
    }
  });
});
