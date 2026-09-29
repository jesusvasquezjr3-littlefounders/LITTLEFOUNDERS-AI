import { act, fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonStageProvider } from './lessonStage';
import { loadLessonClientDocument, type LessonClientDocument } from './lessonDocument';
import { gradeStageVerdict, type SegmentGrade } from './segmentKit';
import { TaxBracketBoard, taxBracketPilotDocument } from './TaxBracketBoard';
import { PlaceValueBoard, placeValuePilotDocument } from './PlaceValueBoard';
import { RatioTableBoard, ratioTablePilotDocument } from './RatioTableBoard';
import { PercentGridBoard, percentGridPilotDocument } from './PercentGridBoard';
import { GrowthComparisonBoard, growthComparisonPilotDocument } from './GrowthComparisonBoard';
import { RunningLedgerBoard, runningLedgerPilotDocument } from './RunningLedgerBoard';
import { SavingsRuleBoard, savingsRulePilotDocument } from './SavingsRuleBoard';
import { GoalBulletBoard, goalBulletPilotDocument } from './GoalBulletBoard';
import { DecisionReasonsBoard, decideJustifyPilotDocument } from './DecisionReasonsBoard';

/*
 * B.8, OD-15, OD-19, Bible 08 §11 (GAP-FIX-R5 learning): the compact Mentor
 * stage reacts to every graded v2 answer with the lesson reaction vocabulary:
 * the met pose after a met grade, the encouraging pose after a miss, and never
 * a celebration (OD-7). The server grade reaches the boards through
 * `useSegmentGrade`; here its result is driven by hand so each board's wiring
 * to `LessonStageSlot` is what is under test. The stage is replaced by a double
 * that exposes the state it was asked to play.
 */
const harness = vi.hoisted(() => ({ result: null as SegmentGrade | 'unavailable' | null }));

vi.mock('./segmentKit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./segmentKit')>();
  return {
    ...actual,
    useSegmentGrade: () => ({
      pending: false, result: harness.result, check: () => {}, reset: () => {},
      met: harness.result !== null && harness.result !== 'unavailable' && harness.result.verdict === 'met',
    }),
  };
});
vi.mock('./CompactMentorStage', async () => {
  const { lessonStateFor } = await import('../mentor/stageStates');
  return {
    CompactMentorStage: ({ verdict }: { verdict: 'met' | 'review' | null }) => <div data-testid="compact-stage" data-state={lessonStateFor(verdict)} />,
  };
});

type Board = ComponentType<{ document: LessonClientDocument; segment: never; onBack: () => void; onGrade?: unknown }>;
const graded = (raw: unknown): LessonClientDocument => {
  const document = structuredClone(raw) as { segments: Array<{ grading: string }> };
  document.segments[0]!.grading = 'server';
  const loaded = loadLessonClientDocument(document);
  if (loaded.status !== 'ready') throw new Error('pilot did not load');
  return loaded.document;
};

const BOARDS: Array<[string, Board, () => unknown]> = [
  ['visual.tax-bracket.v2 (M20)', TaxBracketBoard as unknown as Board, () => taxBracketPilotDocument('en-US')],
  ['math.place-value.v2 (M5)', PlaceValueBoard as unknown as Board, () => placeValuePilotDocument('en-US')],
  ['math.ratio-table.v2 (M14)', RatioTableBoard as unknown as Board, () => ratioTablePilotDocument('en-US')],
  ['visual.percent-grid.v2 (M15)', PercentGridBoard as unknown as Board, () => percentGridPilotDocument('en-US', '10-12')],
  ['visual.growth-comparison.v2 (M19, money 8)', GrowthComparisonBoard as unknown as Board, () => growthComparisonPilotDocument('en-US')],
  ['money.running-ledger.v2 (money 5)', RunningLedgerBoard as unknown as Board, () => runningLedgerPilotDocument('en-US')],
  ['logic.savings-rule.v2 (L2)', SavingsRuleBoard as unknown as Board, () => savingsRulePilotDocument('en-US')],
  ['visual.goal-bullet.v2', GoalBulletBoard as unknown as Board, () => goalBulletPilotDocument('en-US', '10-12')],
];

const STAGE = { character: 'dina', scene: 'diorama-a' } as const;
const state = () => screen.getByTestId('compact-stage').dataset.state;

beforeEach(() => { harness.result = null; });

describe('B.8: every graded v2 board hands its server grade to the Mentor stage', () => {
  it.each(BOARDS)('%s: neutral, then the met pose, then the encouraging pose, never a celebration', (_name, Board, pilot) => {
    const document = graded(pilot());
    const view = () => <LessonStageProvider stage={STAGE} ageBand={document.age_band} theme="light">
      <Board document={document} segment={document.segments[0] as never} onBack={() => {}} onGrade={() => 'met'} />
    </LessonStageProvider>;
    const { rerender } = render(view());
    expect(state()).toBe('idle');
    harness.result = { verdict: 'met' };
    rerender(view());
    expect(state()).toBe('acknowledging');
    harness.result = { verdict: 'review', diagnostic: 'value' };
    rerender(view());
    expect(state()).toBe('encouraging');
    harness.result = 'unavailable';
    rerender(view());
    expect(state()).toBe('idle');
    expect(state()).not.toBe('celebrating');
  });

  it('B.12 decide-and-justify: the choice grade reaches the stage (review, then met)', async () => {
    const document = graded(decideJustifyPilotDocument('en-US', '10-12'));
    const grade = vi.fn().mockResolvedValueOnce({ verdict: 'review', judgment: 'unsupported' }).mockResolvedValueOnce({ verdict: 'met', judgment: 'sound' });
    render(<LessonStageProvider stage={STAGE} ageBand="10-12" theme="light">
      <DecisionReasonsBoard document={document} segment={document.segments[0] as never} onBack={() => {}} onGrade={grade} />
    </LessonStageProvider>);
    expect(state()).toBe('idle');
    fireEvent.click(screen.getByRole('button', { name: 'Spend all now' }));
    fireEvent.click(screen.getByRole('button', { name: 'It gets me closer' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })); });
    expect(state()).toBe('encouraging');
    const choices = document.segments[0]!.type === 'reasoning.decide-justify.v2' ? document.segments[0]!.payload.choices : [];
    fireEvent.click(screen.getByRole('button', { name: choices[0]!.label }));
    expect(state()).toBe('idle');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Check' })); });
    expect(state()).toBe('acknowledging');
  });

  it('reads only met or a miss from a grade', () => {
    expect(gradeStageVerdict(null)).toBeNull();
    expect(gradeStageVerdict('unavailable')).toBeNull();
    expect(gradeStageVerdict({ verdict: 'invalid' })).toBeNull();
    expect(gradeStageVerdict({ verdict: 'met' })).toBe('met');
    expect(gradeStageVerdict({ verdict: 'review', diagnostic: 'partial' })).toBe('review');
  });
});

/*
 * Static check: a board that grades (it calls `useSegmentGrade` or receives
 * an `onGrade`) must hand a verdict to every `LessonStageSlot` it mounts, and
 * to every `BoardShell` it renders. Only boards that never grade may mount the
 * slot bare.
 */
describe('static: no graded board mounts the Mentor stage without its verdict', () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const sources = readdirSync(dir).filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'));
  /** Each exported component with its own source text. */
  const components = sources.flatMap((file) => {
    const text = readFileSync(path.join(dir, file), 'utf8');
    return text.split(/\n(?=export function [A-Z])/).filter((chunk) => chunk.startsWith('export function ')).map((chunk) => ({ file, name: /export function (\w+)/.exec(chunk)![1]!, chunk }));
  });

  it('finds the graded boards (the check is not vacuous)', () => {
    const gradedBoards = components.filter((c) => /useSegmentGrade\(|onGrade\(|onGrade=|grade\(\(\) => onGrade/.test(c.chunk) && /<LessonStageSlot|<BoardShell/.test(c.chunk));
    expect(gradedBoards.length).toBeGreaterThanOrEqual(30);
    for (const name of ['TaxBracketBoard', 'PlaceValueBoard', 'RatioTableBoard', 'PercentGridBoard', 'GrowthComparisonBoard', 'RunningLedgerBoard', 'SavingsRuleBoard', 'GoalBulletBoard', 'DecisionReasonsBoard']) {
      expect(gradedBoards.map((c) => c.name)).toContain(name);
    }
  });

  it('every LessonStageSlot and BoardShell in a graded board carries verdict=', () => {
    const offenders: string[] = [];
    for (const component of components) {
      if (!/useSegmentGrade\(|onGrade\(|grade\(\(\) => onGrade/.test(component.chunk)) continue;
      for (const tag of component.chunk.match(/<LessonStageSlot[^>]*\/>/g) ?? []) if (!/verdict=/.test(tag)) offenders.push(`${component.file} ${component.name}: ${tag}`);
      for (const match of component.chunk.matchAll(/<BoardShell\b/g)) {
        const open = component.chunk.slice(match.index!, component.chunk.indexOf('foot=', match.index!) + 1 || undefined);
        if (!/verdict=/.test(open)) offenders.push(`${component.file} ${component.name}: BoardShell without verdict`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
