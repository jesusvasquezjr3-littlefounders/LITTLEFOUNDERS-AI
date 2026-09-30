import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { clientScorerVerdict } from './clientScorerVerdict';
import { LearningQaSignals } from './LearningQaSignals';
import { loadLessonClientDocument, type LessonClientDocument } from './lessonDocument';
import { schemaDiagramPilotDocument } from './SchemaDiagramBoard';

/* GAP-FIX-R2 learning: Appendix P Part 8 scorer parity and the QA panel (Appendix C 1.3). */

const signals = {
  scorerParity: { graded: 40, reported: 38, agreed: 38, agreement_share: 1, refusedButClientValid: 1, target: 1 as const },
  detectionByPhase: [{ item_phase: 'pre' as const, responses: 10, hits: 5, misses: 5, false_alarms: 4, correct_rejections: 6, dPrime: 0.25 },
    { item_phase: 'post' as const, responses: 10, hits: 9, misses: 1, false_alarms: 1, correct_rejections: 9, dPrime: 2.1 }],
  cueHits: { responses: 3, hits: 4, missed: 1, false_ticks: 2, diagnostic: true as const },
  variantTransfer: { rows: [{ kc: 'kc-unit-price', variant: 'ratio-lines', first_attempts: 4, successes: 3, success_share: 0.75 }], diagnostic: true as const },
  cpaEntryStages: { rows: [{ entry_stage: 'pictorial' as const, runs: 3 }], diagnostic: true as const },
  placementCommit: { ok: 9, failed: 1, successRate: 0.9, byMethod: { adaptive_quiz: 9 }, target: 1 as const },
  prerequisiteGate: { refused: 3, passed: 5, target: 1 as const },
  forcedUpdate: { blocked: 2, target: 1 as const },
  defectEscapes: { escapes: 1, publishedVersions: 30, byGate: [{ gateId: 'forge.gate.18.wellbeing-language', escapes: 1 }], target: 0 as const },
  coverage: { generated_at: '2026-09-28', tap_alternative: { drag_interactions: 2, with_alternative: 2, share: 1, missing: [] },
    locale_rendering: { kinds: 48, covered: 48, share: 1, missing: [] } },
};

describe('learning QA signals (GAP-FIX-R2)', () => {
  it('reads an answer with the canonical scorer, never a rubric', () => {
    const loaded = loadLessonClientDocument(schemaDiagramPilotDocument('en-US'));
    const document = (loaded as { document: LessonClientDocument }).document;
    expect(clientScorerVerdict(document, 'schema-structure-01', { schema: 'change' })).toBe('valid');
    expect(clientScorerVerdict(document, 'schema-structure-01', { schema: 'combine' })).toBe('invalid');
    expect(clientScorerVerdict(document, 'schema-slots-01', { schema: 'change', slots: { start: 'earned' } })).toBe('invalid');
    expect(clientScorerVerdict(document, 'no-such-segment', {})).toBeUndefined();
  });

  it('shows release targets and labels diagnostic metrics', () => {
    render(<LearningQaSignals signals={signals} locale="en-US" />);
    expect(screen.getByText('Scorer parity: 38 of 38 graded answers agreed.')).toBeTruthy();
    expect(screen.getByText('Placement saved: 9 of 10.')).toBeTruthy();
    expect(screen.getByText('Before the lesson: d′ 0.25 over 10 answers')).toBeTruthy();
    expect(screen.getByText('After the lesson: d′ 2.10 over 10 answers')).toBeTruthy();
    expect(screen.getAllByText('Diagnostic, no target').length).toBeGreaterThan(2);
    expect(screen.getByText('Tap alternatives: 2 of 2 drags.')).toBeTruthy();
    expect(screen.getByText('Three-locale rendering: 48 of 48 kinds.')).toBeTruthy();
  });

  it('records a defect escape only with a lesson uuid, a Forge gate id and a kind', async () => {
    const onRecordEscape = vi.fn(async () => true);
    render(<LearningQaSignals signals={signals} locale="es-MX" onRecordEscape={onRecordEscape} />);
    const save = screen.getByRole('button', { name: 'Registrar' });
    fireEvent.change(screen.getByLabelText('Id de la lección'), { target: { value: 'not-a-uuid' } });
    fireEvent.change(screen.getByLabelText('Filtro que debió detectarlo'), { target: { value: 'forge.gate.18.wellbeing-language' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Bienestar' }));
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Id de la lección'), { target: { value: '11111111-2222-4333-8444-555555555555' } });
    fireEvent.click(save);
    await waitFor(() => expect(onRecordEscape).toHaveBeenCalledWith({ lessonId: '11111111-2222-4333-8444-555555555555', gateId: 'forge.gate.18.wellbeing-language', kind: 'psychological' }));
    expect(await screen.findByText('Registrado.')).toBeTruthy();
  });

  it('says when the migrations are not applied', () => {
    render(<LearningQaSignals signals={null} locale="pt-BR" />);
    expect(screen.getByText('Disponível quando as migrações de sinais forem aplicadas.')).toBeTruthy();
  });
});

/* Gap-fix round 7 (Appendix C 1.3 Defect Escape Rate, Stage 6): the open gate-effectiveness reviews and how one closes. */
const REVIEW = 'cccccccc-0000-4000-8000-000000000001';
const openReview = (overrides: Partial<{ reviewId: string; ageDays: number; overdue: boolean; ownerRole: 'pedagogical_lead' | 'content_engineering' }> = {}) => ({
  reviewId: REVIEW, escapeId: 'eeeeeeee-0000-4000-8000-000000000001', lessonId: '11111111-2222-4333-8444-555555555555', gateId: 'forge.gate.12.tone',
  gateDescription: 'Gate 12: Law 2 tone', ownerRole: 'pedagogical_lead' as const, defectKind: 'pedagogical', openedAt: '2026-06-01T00:00:00Z',
  ageDays: 120, overdue: true, ...overrides,
});
const withReviews = (open: ReturnType<typeof openReview>[]) => ({ ...signals, gateReviews: { open, overdue: open.filter((r) => r.overdue).length, maxOpenDays: 90 } });

describe('gate-effectiveness reviews (gap-fix round 7)', () => {
  it('lists each open review with its gate, owner and age, and marks the overdue one', () => {
    render(<LearningQaSignals signals={withReviews([openReview(), openReview({ reviewId: 'cccccccc-0000-4000-8000-000000000002', ageDays: 1, overdue: false, ownerRole: 'content_engineering' })])} locale="en-US" />);
    expect(screen.getByText('Gate reviews')).toBeTruthy();
    expect(screen.getByText('forge.gate.12.tone: open 120 days')).toBeTruthy();
    expect(screen.getByText('forge.gate.12.tone: open 1 day')).toBeTruthy();
    expect(screen.getByText('Owner: Pedagogical Lead')).toBeTruthy();
    expect(screen.getByText('Owner: Content engineering')).toBeTruthy();
    expect(screen.getAllByText('Overdue: over 90 days')).toHaveLength(1);
    expect(document.querySelector('[data-status="overdue"]')).toBeTruthy();
    // Read-only without the writer.
    expect(screen.queryByRole('button', { name: 'Close review' })).toBeNull();
  });

  it('says when nothing is open, and when the migration is missing', () => {
    const { rerender } = render(<LearningQaSignals signals={withReviews([])} locale="es-MX" />);
    expect(screen.getByText('Sin revisiones abiertas.')).toBeTruthy();
    rerender(<LearningQaSignals signals={{ ...signals, gateReviews: null }} locale="pt-BR" />);
    expect(screen.getByText('Disponível quando a migração de revisões for aplicada.')).toBeTruthy();
  });

  it('never closes a review without an outcome and a note, and a fixed gate names its commit or version', async () => {
    const onResolve = vi.fn(async () => 'resolved' as const);
    render(<LearningQaSignals signals={withReviews([openReview()])} locale="en-US" onResolveGateReview={onResolve} />);
    const close = screen.getByRole('button', { name: 'Close review' });
    expect(close).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Why the gate missed it/), { target: { value: 'The tone lexicon had no entry for this idiom.' } });
    expect(close).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Gate fixed' }));
    expect(close).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Commit or gate version'), { target: { value: '-bad' } });
    expect(close).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Commit or gate version'), { target: { value: 'a1b2c3d4' } });
    expect(close).toBeEnabled();
    fireEvent.click(close);
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith(REVIEW, { outcome: 'gate_changed', note: 'The tone lexicon had no entry for this idiom.', gateChangeRef: 'a1b2c3d4' }));
    expect(await screen.findByText('Review closed.')).toBeTruthy();
    expect(screen.queryByText('forge.gate.12.tone: open 120 days')).toBeNull();
  });

  it('sends no reference for the other outcomes and reports a conflict', async () => {
    const onResolve = vi.fn(async () => 'conflict' as const);
    render(<LearningQaSignals signals={withReviews([openReview()])} locale="pt-BR" onResolveGateReview={onResolve} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Filtro corrigido' }));
    fireEvent.change(screen.getByLabelText('Commit ou versão do filtro'), { target: { value: 'a1b2c3d4' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Limite aceito' }));
    expect(screen.queryByLabelText('Commit ou versão do filtro')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Por que o filtro não pegou/), { target: { value: 'Nenhum filtro lê o subtexto da imagem.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar revisão' }));
    await waitFor(() => expect(onResolve).toHaveBeenCalledWith(REVIEW, { outcome: 'accepted_limitation', note: 'Nenhum filtro lê o subtexto da imagem.' }));
    expect(await screen.findByText('Já estava fechada.')).toBeTruthy();
  });
});
