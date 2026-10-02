import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonDocumentView } from '../../LessonDocumentView';
import { assertBoardContract } from '../harness/boardContract';
import { horizonteFixtureDocument } from '../previewDocument';
import { COM_COPY } from './copy';

vi.mock('../../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div data-testid="tutor-stage" /> }));

type Locale = 'en-US' | 'es-MX' | 'pt-BR';

const show = (fixture: string, locale: Locale = 'en-US', ageBand: '10-12' | '13-17' = '10-12') => {
  const grade = vi.fn(() => ({ verdict: 'review' as const }));
  render(<LessonDocumentView raw={horizonteFixtureDocument('com', fixture, locale)} locale={locale} ageBand={ageBand} onBack={() => {}} onGradeAny={grade} />);
  return grade;
};
const status = () => document.querySelector('[data-hz-text-equivalent]') as HTMLElement;
const zone = (name: string) => screen.getByRole('group', { name });
const chip = (name: string) => screen.getByRole('button', { name });
const put = (piece: string, target: string) => { fireEvent.click(chip(piece)); fireEvent.click(zone(target)); };
const check = () => fireEvent.click(screen.getByRole('button', { name: 'Check' }));

const SLOT_CSS = ['com/slotBoard.css'];
const NETWORK_CSS = [...SLOT_CSS, 'com/NetworkBoard.css', 'plano/plano.css'];
const CIRCUITS_CSS = [...SLOT_CSS, 'com/CircuitsBoard.css'];
const EXPLORER_CSS = ['com/explorer.css', 'plano/plano.css'];

describe('com boards: the board contract', () => {
  it('network board: all four visuals in three locales', async () => {
    for (const fixtureId of ['konigsberg', 'bridge-walk', 'cheapest-route', 'team-picks', 'podium', 'pascal-evens']) {
      await assertBoardContract({ pack: 'com', fixtureId, copy: COM_COPY, css: NETWORK_CSS });
    }
    for (const fixtureId of ['cheapest-tie', 'pascal-threes']) {
      await assertBoardContract({ pack: 'com', fixtureId, copy: COM_COPY, css: NETWORK_CSS, locales: ['en-US'] });
    }
  }, 120_000);

  it('trig board: the unit circle and the circle to wave, in three locales', async () => {
    for (const fixtureId of ['unit-circle-cos', 'unit-circle-sin', 'circle-wave']) {
      await assertBoardContract({ pack: 'com', fixtureId, copy: COM_COPY, css: EXPLORER_CSS });
    }
  }, 120_000);

  it('calculus board: the four explorers in three locales', async () => {
    for (const fixtureId of ['secant-slope', 'linked-graphs', 'riemann-sums', 'area-so-far']) {
      await assertBoardContract({ pack: 'com', fixtureId, copy: COM_COPY, css: EXPLORER_CSS });
    }
  }, 120_000);

  it('circuits board: bits and gates in three locales', async () => {
    for (const fixtureId of ['bits-ten', 'bits-byte', 'gates-xor', 'gates-alarm']) {
      await assertBoardContract({ pack: 'com', fixtureId, copy: COM_COPY, css: CIRCUITS_CSS });
    }
  }, 120_000);
});

void within; void waitFor; void status; void put; void check;
