import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import en from '../../i18n/en-US/rebuild-learn.json';
import es from '../../i18n/es-MX/rebuild-learn.json';
import pt from '../../i18n/pt-BR/rebuild-learn.json';
import { checkCopy, type Locale } from '../design/copyBudget';
import { isGenericPraise } from '../design/learnerRegisterPolicy.generated';
import { LessonDocumentView } from './LessonDocumentView';
import { loadLessonClientDocument } from './lessonDocument';
import { NAMED_FEEDBACK_KINDS, namedFeedback, namedFeedbackCopy } from './namedFeedback';
import { GradedFoot, verdictBannerText, type useSegmentGrade } from './segmentKit';

/*
 * GAP-FIX-R6 learning (B.20; Frontend Bible 02 §9.2; Appendix B §1.8; B.23):
 * a correct v2 step is answered with a banner that names what was done right,
 * and "not yet" carries a hint. The author's `feedback` wins; the board's own
 * named confirmation is the fallback. Never a bare "Correct" / "That works.".
 */

vi.mock('../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

const LOCALES: Locale[] = ['en-US', 'es-MX', 'pt-BR'];
/** The generic lines the v2 boards used to show (retired): a met text equal to any of them names nothing. */
const RETIRED_GENERIC = ['That works.', 'Eso funciona.', 'Isso funciona.', 'Correct', 'Correcto', 'Correto', 'You found it.', 'Lo encontraste.', 'Você encontrou.',
  'That choice works.', 'Esa decisión funciona.', 'Essa escolha funciona.'];
const NOT_YET: Record<Locale, string> = { 'en-US': 'Not yet.', 'es-MX': 'Todavía no.', 'pt-BR': 'Ainda não.' };
const SAMPLE = { total: '$12.50', price: '$3.25', paid: '$5.00', month: 12, years: 9, percent: 30, parts: 12, shaded: 11, value: '11/12 and 0.75' };

describe('named feedback (B.20, Bible 02 §9.2)', () => {
  it('names the action for every board kind, in budget, never generic, with a "not yet" hint', () => {
    for (const locale of LOCALES) {
      const seen = new Set<string>();
      for (const kind of NAMED_FEEDBACK_KINDS) {
        const { met, hint } = namedFeedback(locale, kind, SAMPLE);
        for (const text of [met, hint]) {
          expect(checkCopy(text, 'body', { locale, ageBand: '6-9', surface: 'app' }), `${locale} ${kind}: ${text}`).toEqual([]);
          expect(text, `${locale} ${kind}`).not.toMatch(/\{\w+\}/);
        }
        expect(RETIRED_GENERIC, `${locale} ${kind}`).not.toContain(met);
        expect(isGenericPraise(met), `${locale} ${kind}: ${met}`).toBe(false);
        expect(met.startsWith(NOT_YET[locale]), `${locale} ${kind}`).toBe(false);
        expect(hint.startsWith(NOT_YET[locale]), `${locale} ${kind}: ${hint}`).toBe(true);
        expect(hint.length, `${locale} ${kind}: the hint says what to check`).toBeGreaterThan(NOT_YET[locale].length + 10);
        seen.add(met);
      }
      // Kind-specific: no two boards confirm with the same words.
      expect(seen.size, locale).toBe(NAMED_FEEDBACK_KINDS.length);
      expect(Object.keys(namedFeedbackCopy[locale]).sort()).toEqual([...NAMED_FEEDBACK_KINDS].sort());
    }
  });

  it('retired the generic player verdict lines from rebuild-learn.json', () => {
    for (const copy of [en, es, pt]) {
      for (const key of ['met', 'review', 'reviewStructure', 'reviewAnswer']) expect(copy.player).not.toHaveProperty(key);
    }
  });

  it('every graded board takes the authored feedback and a named fallback (static pin over the board sources)', () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const boards = readdirSync(dir).filter((file) => file.endsWith('.tsx') && !file.includes('.test.'));
    let feet = 0; let banners = 0;
    for (const file of boards) {
      const source = readFileSync(path.join(dir, file), 'utf8');
      expect(source, file).not.toMatch(/correct: '(Correct|Correcto|Correto)'/);
      expect(source, file).not.toMatch(/player\.met\b|t\.met\s*:\s*t\.review|\? t\.correct\b/);
      for (const use of source.split('<GradedFoot ').slice(1)) {
        feet += 1;
        const props = use.slice(0, use.indexOf('/>'));
        expect(props, `${file}: GradedFoot passes a named confirmation`).toMatch(/named=\{namedFeedback\(|named=\{change \? namedFeedback\(/);
        expect(props, `${file}: GradedFoot passes the segment's feedback`).toContain('feedback={segment.feedback}');
      }
      if (file !== 'LessonFeedback.tsx' && file !== 'segmentKit.tsx' && source.includes('<LessonFeedback')) {
        banners += 1;
        expect(source, `${file}: its banner reads the authored feedback`).toMatch(/segment\.feedback/);
      }
    }
    expect(feet).toBeGreaterThanOrEqual(25);
    expect(banners).toBeGreaterThanOrEqual(10);
  });

  it('GradedFoot: authored feedback first, the named confirmation as fallback, a hint on a miss', () => {
    const grading = (verdict: 'met' | 'review') => ({ pending: false, result: { verdict }, check: () => {}, reset: () => {}, met: verdict === 'met' }) as ReturnType<typeof useSegmentGrade>;
    const named = namedFeedback('en-US', 'rule-cards');
    const view = render(<GradedFoot locale="en-US" grading={grading('met')} canCheck onCheck={() => {}} named={named} />);
    expect(screen.getByRole('status')).toHaveTextContent('You turned only the cards that could break the rule.');
    view.rerender(<GradedFoot locale="en-US" grading={grading('met')} canCheck onCheck={() => {}} named={named} feedback={{ met: 'You tested the 5 and the red card.' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('You tested the 5 and the red card.');
    view.rerender(<GradedFoot locale="en-US" grading={grading('review')} canCheck onCheck={() => {}} named={named} feedback={{ met: 'You tested the 5 and the red card.' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Not yet. Ask which cards could break the rule.');
    view.rerender(<GradedFoot locale="en-US" grading={grading('review')} canCheck onCheck={() => {}} named={named} feedback={{ not_yet: 'Not yet. Could the red card hide an odd number?' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Not yet. Could the red card hide an odd number?');
    expect(verdictBannerText('es-MX', 'unavailable', named)).toBe(es.player.unavailable);
  });

  it('explains the selected mistake without replacing success or network-error feedback', () => {
    const named = namedFeedback('en-US', 'story');
    const feedback = { met: 'You preserved the money for the bill.', not_yet: 'Compare the amounts.', choice_hints: { total: 'The total includes the money already reserved.', reserved: 'This is the protected amount, not the remainder.' } };
    expect(verdictBannerText('en-US', 'review', named, feedback, 'total')).toBe(feedback.choice_hints.total);
    expect(verdictBannerText('en-US', 'review', named, feedback, 'reserved')).toBe(feedback.choice_hints.reserved);
    expect(verdictBannerText('en-US', 'review', named, feedback, 'unknown')).toBe(feedback.not_yet);
    expect(verdictBannerText('en-US', 'met', named, feedback, 'total')).toBe(feedback.met);
    expect(verdictBannerText('en-US', 'unavailable', named, feedback, 'total')).not.toBe(feedback.choice_hints.total);
  });

  it('a lesson document carries feedback to the board, and the browser refuses malformed feedback', async () => {
    const cards = { id: 'cards-01', type: 'logic.rule-checker.v2', grading: 'server', prompt: 'Which cards must you turn?', visual: { type: 'rule-cards' },
      feedback: { met: 'You turned the cards that could hide a broken rule.', not_yet: 'Not yet. Which card could hide an odd number?' },
      payload: { rule: 'If a card is even, its back is red.', cards: [{ id: 'card-even', face: '8' }, { id: 'card-odd', face: '5' }, { id: 'card-red', face: 'Red' }, { id: 'card-blue', face: 'Blue' }] } };
    const doc = (segment: unknown) => ({
      schema_version: 2, course_id: 'financial-education', pathway_id: 'financial-tween', chapter_id: 'logic-basics', lesson_id: 'feedback-lesson',
      version_id: 'rev-1', locale: 'en-US', age_band: '10-12', eligibility: { minimum_age: 10, maximum_age: 12 }, knowledge_component_ids: ['kc-conditional'],
      adventure_scene_id: 'diorama-a', title: 'Test the rule', required_capabilities: ['visual.rule-cards.v1', 'operation.flip-card.v1'], segments: [segment],
    });
    expect(loadLessonClientDocument(doc(cards)).status).toBe('ready');
    for (const feedback of [{}, { met: '' }, { met: 'x'.repeat(161) }, { met: 'Named.', praise: 'Great job!' }]) {
      expect(loadLessonClientDocument(doc({ ...cards, feedback })).status, JSON.stringify(feedback)).not.toBe('ready');
    }
    const onGradeAny = vi.fn()
      .mockResolvedValueOnce({ verdict: 'review' as const })
      .mockResolvedValueOnce({ verdict: 'met' as const });
    render(<LessonDocumentView raw={doc(cards)} locale="en-US" ageBand="10-12" onBack={() => {}} onGradeAny={onGradeAny} />);
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByText('Not yet. Which card could hide an odd number?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await waitFor(() => expect(screen.getByText('You turned the cards that could hide a broken rule.')).toBeTruthy());
  });
});
