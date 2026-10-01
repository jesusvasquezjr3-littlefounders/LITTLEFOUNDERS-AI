import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allocationPilotDocument } from './AllocationBoard';
import { goalBulletPilotDocument } from './GoalBulletBoard';
import { AuthenticatedLessonDocument } from './AuthenticatedLessonDocument';
import { paintApprovedStill } from '../mentor/__tests__/paintApprovedStill';

/* The Mentor stage renders its live 3D only where the renderer's device probe finds WebGL (Bible 08 §7). */
vi.mock('../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../tutor-scene/TutorStage', () => ({
  TutorStage: (props: { scene?: string; character?: string }) => (
    <div data-testid="tutor-stage" data-scene={props.scene} data-character={props.character} />
  ),
}));

describe('authenticated v2 lesson delivery', () => {
  it('renders from client-safe document metadata without receiving an age value', () => {
    render(<AuthenticatedLessonDocument raw={goalBulletPilotDocument('en-US', '6-9')} responseLocale="en-US" onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Reach a savings goal' })).toBeTruthy();
  });

  it('fails closed for a malformed delivered v2 document', () => {
    render(<AuthenticatedLessonDocument raw={{ schema_version: 2 }} responseLocale="es-MX" onBack={vi.fn()} />);
    expect(screen.getByText('Esta lección no se puede abrir.')).toBeTruthy();
  });

  describe('mentor stage projection', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    });
    afterEach(() => vi.unstubAllGlobals());

    it('mounts the compact stage from the response projection', async () => {
      render(<AuthenticatedLessonDocument raw={allocationPilotDocument('en-US', '6-9')} responseLocale="en-US"
        mentorStage={{ character: 'zara', scene: 'diorama-a' }} onBack={vi.fn()} onGrade={vi.fn()} />);
      expect(document.querySelector('.lf-mentor-band')?.getAttribute('data-mentor-character')).toBe('zara');
      await paintApprovedStill();
      expect(await screen.findByTestId('tutor-stage')).toHaveAttribute('data-scene', 'diorama-a');
      expect(screen.getByRole('heading', { name: 'Split your money' })).toBeTruthy();
    });

    it('renders the lesson without a stage for a malformed projection', () => {
      render(<AuthenticatedLessonDocument raw={allocationPilotDocument('en-US', '6-9')} responseLocale="en-US"
        mentorStage={{ character: 'mickey', scene: 'diorama-z' }} onBack={vi.fn()} onGrade={vi.fn()} />);
      expect(document.querySelector('.lf-mentor-band')).toBeNull();
      expect(screen.getByRole('heading', { name: 'Split your money' })).toBeTruthy();
    });

    it('renders the lesson without a stage when the response carries no projection', () => {
      render(<AuthenticatedLessonDocument raw={allocationPilotDocument('en-US', '6-9')} responseLocale="en-US"
        onBack={vi.fn()} onGrade={vi.fn()} />);
      expect(document.querySelector('.lf-mentor-band')).toBeNull();
      expect(screen.getByRole('heading', { name: 'Split your money' })).toBeTruthy();
    });
  });
});
