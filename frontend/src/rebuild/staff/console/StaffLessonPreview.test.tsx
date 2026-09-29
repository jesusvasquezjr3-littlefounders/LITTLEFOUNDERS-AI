import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RebuildProvider, RebuildRoot } from '../../design/controls';
import { allocationPilotDocument } from '../../learning/AllocationBoard';
import { loadLessonClientDocument } from '../../learning/lessonDocument';
import sections from './staffSectionFixtures.json';
import StaffLessonPreview from './StaffLessonPreview';
import type { LessonPreviewRequest } from './StaffContent';

/*
 * GAP-FIX-R6 (02 rule 23, D13, OD-24; Appendix C Part 3 Stage 3): a v2 lesson
 * under review plays in the learner's own rebuilt lesson view, in the
 * document's language and age band, with every answer checked through Core
 * (request.grade) and nothing else called.
 */

vi.mock('../../../tutor-scene/quality', () => ({
  getDeviceProbe: () => ({ cores: 8, memoryGb: 8, coarsePointer: false, devicePixelRatio: 1, webgl: 'webgl2', maxTextureSize: 8192, prefersReducedMotion: false }),
  pickInitialTier: () => 'medium',
}));
vi.mock('../../../tutor-scene/TutorStage', () => ({
  TutorStage: (props: { scene?: string; character?: string }) => <div data-testid="tutor-stage" data-scene={props.scene} data-character={props.character} />,
}));

afterEach(() => { document.title = ''; });

function lesson(): Record<string, unknown> {
  const document = structuredClone(allocationPilotDocument('es-MX', '6-9')) as { segments: { payload: { total: number; step: number } }[] };
  document.segments[0]!.payload.total = 2;
  document.segments[0]!.payload.step = 1;
  return document as unknown as Record<string, unknown>;
}

function request(overrides: Partial<LessonPreviewRequest> = {}): LessonPreviewRequest {
  return {
    lessonId: 'l1', locale: 'es-MX', schemaVersion: 2, document: lesson(), audio: {},
    grade: vi.fn(async () => ({ verdict: 'met' as const })),
    labels: { start: 'Start', next: 'Next', loading: 'Opening', dialog: 'Lesson preview', bar: 'Staff preview. Nothing is saved.', close: 'Close preview' },
    onExit: vi.fn(),
    ...overrides,
  };
}

function mount(value: LessonPreviewRequest) {
  return render(<RebuildRoot theme="light" locale="en-US"><RebuildProvider environment={{ theme: 'light', locale: 'en-US' }} labels={{ dismiss: 'Dismiss' }}>
    <StaffLessonPreview request={value} />
  </RebuildProvider></RebuildRoot>);
}

describe('the staff v2 lesson preview', () => {
  it('opens a modal layer with the staff bar and the learner lesson, in the lesson language', async () => {
    mount(request());
    const dialog = await screen.findByRole('dialog', { name: 'Lesson preview' });
    expect(dialog.closest('[data-overlay="lesson-preview"]')).not.toBeNull();
    expect(screen.getByText('Staff preview. Nothing is saved.')).toBeTruthy();
    expect(dialog.querySelector('[data-shell="lesson"]')?.getAttribute('lang')).toBe('es-MX');
    expect(dialog.querySelector('main')).not.toBeNull();
    // Never the legacy chrome.
    expect(document.querySelector('[data-testid="lesson-player"]')).toBeNull();
  });

  it('checks an answer through Core and nothing else', async () => {
    const value = request();
    mount(value);
    await screen.findByRole('dialog', { name: 'Lesson preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar: Añadir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar: Añadir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    await waitFor(() => expect(value.grade).toHaveBeenCalledWith('allocate-01', { save: 2, spend: 0, share: 0 }));
  });

  it('closes on its own button and on Escape, and gives the console its title back', async () => {
    document.title = 'Content · LittleFounders';
    const value = request();
    const view = mount(value);
    await screen.findByRole('dialog', { name: 'Lesson preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(value.onExit).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(document.title).toBe('Content · LittleFounders');
  });

  it('the preview entry and the audit fixtures are documents the learner renderer accepts', () => {
    for (const row of [...sections.lessonDocumentsV2, sections.versionDocument]) {
      expect(loadLessonClientDocument(row.document).status, row.locale).toBe('ready');
    }
  });
});
