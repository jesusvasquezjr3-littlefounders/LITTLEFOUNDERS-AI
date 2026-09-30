import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgeBand, Locale } from '../design/copyBudget';
import { LessonDocumentView } from './LessonDocumentView';
import { loadLessonClientDocument, segmentCapabilities, type LessonClientDocument, type LessonClientSegment } from './lessonDocument';
import { V2_AGE_SCOPE, v2SegmentsForApproach } from './v2SegmentFamilies.generated';

/*
 * Gap-fix round 7 (Appendix P Parts 1-3 ages column, OD-16, B.7 part 3): the
 * player never refuses a lesson Core accepts. Who may see a kind is decided
 * once, by the shared V2_AGE_SCOPE (Core and loadLessonClientDocument run the
 * same v2AgeScopeProblem); the board switch used to add stricter pilot guards,
 * so every adult money lesson Forge emits showed "This lesson cannot open."
 */

vi.mock('../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type EmittedRow = { lesson_id: string; locale: Locale; document: LessonClientDocument };
const ROOT = resolve(process.cwd(), '..');
const EMITTED = JSON.parse(readFileSync(resolve(ROOT, 'coursegen/src/v2/fixtures/emitted.json'), 'utf8')) as EmittedRow[];
const noop = () => {};
const review = () => 'review' as const;
const handlers = {
  onGrade: review, onGradeNumberLine: review, onGradeFractionArea: review, onGradeBarModel: review, onGradeSchemaDiagram: review,
  onGradeWorkedExample: review, onGradeReasoning: () => ({ verdict: 'review' as const }),
  onGradeAny: () => ({ verdict: 'review' as const }), onView: async () => true,
};

afterEach(cleanup);

/** Every screen the learner could land on: each segment of the document, and of each approach's chain. */
function positions(document: LessonClientDocument): Array<{ approachId: string | null; viewed: string[] }> {
  const orders = document.approaches
    ? document.approaches.options.map((option) => ({ approachId: option.id, segments: v2SegmentsForApproach(document.segments, document.approaches!, option.id) }))
    : [{ approachId: null, segments: document.segments }];
  return orders.flatMap(({ approachId, segments }) => segments.map((_, index) => ({ approachId, viewed: segments.slice(0, index).map((item) => item.id) })));
}

/** Renders one step and returns the screen the player chose. */
function screenFor(document: LessonClientDocument, position: { approachId: string | null; viewed: string[] }): string | null {
  const { container } = render(<LessonDocumentView raw={document} locale={document.locale as Locale} ageBand={document.age_band as AgeBand} onBack={noop}
    {...handlers} viewedSegmentIds={position.viewed} approachId={position.approachId} onComplete={async () => true} />);
  const screen = container.querySelector('[data-screen]')?.getAttribute('data-screen') ?? null;
  cleanup();
  return screen;
}

const REFUSED = new Set(['lesson-unavailable', 'lesson-update']);

describe('the v2 player opens every lesson Core accepts', () => {
  it('plays every step of every Forge-emitted document, adult money included, in all three locales', () => {
    expect(EMITTED.some((row) => row.lesson_id === 'v2-adult-money')).toBe(true);
    const refused: string[] = [];
    for (const row of EMITTED) {
      const loaded = loadLessonClientDocument(row.document);
      expect(loaded.status, `${row.lesson_id} ${row.locale}`).toBe('ready');
      for (const position of positions(row.document)) {
        const screen = screenFor(row.document, position);
        if (!screen || REFUSED.has(screen)) refused.push(`${row.lesson_id} ${row.locale} step ${position.viewed.length + 1}${position.approachId ? ` (${position.approachId})` : ''}: ${screen}`);
      }
    }
    expect(refused).toEqual([]);
  }, 120_000);

  it('opens every adult money board: tax brackets, growth, ledger, worked example and ratio table', () => {
    const adult = EMITTED.filter((row) => row.lesson_id === 'v2-adult-money');
    expect(adult.map((row) => row.locale).sort()).toEqual(['en-US', 'es-MX', 'pt-BR']);
    const seen = new Set<string>();
    for (const row of adult) {
      for (const position of positions(row.document)) {
        const screen = screenFor(row.document, position);
        expect(REFUSED.has(screen ?? 'none'), `${row.locale} ${position.viewed.length}`).toBe(false);
        seen.add(row.document.segments[position.viewed.length]!.type);
      }
    }
    for (const kind of ['visual.tax-bracket.v2', 'visual.growth-comparison.v2', 'money.running-ledger.v2', 'math.worked-example.v2', 'math.ratio-table.v2']) {
      expect(seen.has(kind), kind).toBe(true);
    }
  });

  it('prices an adult ratio table in the market currency and a child one in coins (payload, not band)', () => {
    const row = EMITTED.find((item) => item.lesson_id === 'v2-adult-money' && item.locale === 'en-US')!;
    const ratioIndex = row.document.segments.findIndex((segment) => segment.type === 'math.ratio-table.v2');
    const local = structuredClone(row.document);
    (local.segments[ratioIndex]!.payload as { currency: string }).currency = 'local';
    expect(loadLessonClientDocument(local).status).toBe('ready');
    const viewed = local.segments.slice(0, ratioIndex).map((segment) => segment.id);
    const { container } = render(<LessonDocumentView raw={local} locale="en-US" ageBand="adult" onBack={noop} {...handlers} viewedSegmentIds={viewed} />);
    expect(container.querySelector('[data-screen]')?.getAttribute('data-screen')).not.toBe('lesson-unavailable');
    const lines = () => document.querySelector('[role="group"][aria-label^="Linked number lines"]')?.getAttribute('aria-label') ?? '';
    expect(lines()).toContain('USD');
    expect(lines()).not.toContain('coins');
    cleanup();
    render(<LessonDocumentView raw={row.document} locale="en-US" ageBand="adult" onBack={noop} {...handlers} viewedSegmentIds={viewed} />);
    expect(lines()).toMatch(/\d coins/);
  });

  it('keeps the learner-band check: a document never opens for another band', () => {
    const row = EMITTED.find((item) => item.lesson_id === 'v2-adult-money' && item.locale === 'en-US')!;
    const { container } = render(<LessonDocumentView raw={row.document} locale="en-US" ageBand="13-17" onBack={noop} {...handlers} />);
    expect(container.querySelector('[data-screen]')?.getAttribute('data-screen')).toBe('lesson-unavailable');
  });
});

/*
 * The static contract: for every kind V2_AGE_SCOPE lists and every band its
 * range (or `adult`) reaches, an emitted document of that kind moved into that
 * band either fails the shared document contract (a payload rule such as L2's
 * rule levels, which Core refuses too) or plays. The player may never be the
 * one that refuses.
 */
const BANDS: ReadonlyArray<{ band: AgeBand; ages: readonly [number, number] }> = [
  { band: '6-9', ages: [6, 9] }, { band: '10-12', ages: [10, 12] }, { band: '13-17', ages: [13, 17] }, { band: 'adult', ages: [18, 119] },
];

function allowedEligibility(scope: { ages: readonly [number, number]; adult: boolean }, band: typeof BANDS[number]) {
  if (band.band === 'adult') return scope.adult ? { minimum_age: 18, maximum_age: 119 } : null;
  const low = Math.max(scope.ages[0], band.ages[0]);
  const high = Math.min(scope.ages[1], band.ages[1]);
  return low <= high ? { minimum_age: low, maximum_age: high } : null;
}

function matches(key: string, segment: LessonClientSegment): boolean {
  const [type, visual] = key.split(':');
  return segment.type === type && (!visual || segment.visual.type === visual);
}

/** The emitted document narrowed to the kind's own steps (its whole chain or progression), moved into the band. */
function moved(document: LessonClientDocument, key: string, band: AgeBand, eligibility: { minimum_age: number; maximum_age: number }): LessonClientDocument {
  const type = key.split(':')[0]!;
  const family = type.startsWith('math.bar-model.') ? 'math.bar-model.' : type.startsWith('math.schema-diagram.') ? 'math.schema-diagram.' : type;
  const segments = document.segments.filter((segment) => segment.type.startsWith(family) && (family !== type || matches(key, segment)));
  const kept = new Set(segments.map((segment) => segment.id));
  const copy = structuredClone({ ...document, segments }) as LessonClientDocument & { approaches?: unknown };
  delete copy.approaches;
  if (copy.representation_progressions) {
    copy.representation_progressions = copy.representation_progressions.filter((progression) => progression.stages.every((stage) => kept.has(stage.segment_id)));
    if (copy.representation_progressions.length === 0) delete copy.representation_progressions;
  }
  copy.required_capabilities = [...new Set(segments.flatMap((segment) => segmentCapabilities(segment)))];
  return { ...copy, age_band: band, eligibility };
}

describe('the player never refuses a kind or band V2_AGE_SCOPE allows', () => {
  const documents = EMITTED.filter((row) => row.locale === 'en-US').map((row) => row.document);

  it('has no per-kind band guard left in the board switch', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/rebuild/learning/LessonDocumentView.tsx'), 'utf8');
    const renderer = source.slice(source.indexOf('function renderSegment('));
    expect(renderer.length).toBeGreaterThan(0);
    expect(renderer.match(/age_band\s*[!=]==/g) ?? []).toEqual([]);
  });

  for (const [key, scope] of Object.entries(V2_AGE_SCOPE)) {
    it(`plays ${key} in every band its Appendix P range reaches`, () => {
      const sources = documents.filter((document) => document.segments.some((segment) => matches(key, segment)));
      expect(sources.length, `no emitted document uses ${key}`).toBeGreaterThan(0);
      const refused: string[] = [];
      let played = 0;
      for (const band of BANDS) {
        const eligibility = allowedEligibility(scope, band);
        if (!eligibility) continue;
        for (const source of sources) {
          const document = moved(source, key, band.band, eligibility);
          if (loadLessonClientDocument(document).status !== 'ready') continue;
          for (const position of positions(document)) {
            const screen = screenFor(document, position);
            if (!screen || REFUSED.has(screen)) refused.push(`${source.lesson_id} as ${band.band}: ${screen}`);
            else played += 1;
          }
        }
      }
      expect(refused).toEqual([]);
      expect(played).toBeGreaterThan(0);
    }, 60_000);
  }
});
