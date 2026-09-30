import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, InlineNotice, SegmentedControl, TextAreaField, TextField } from '../design/controls';
import { pluralUnit } from '../design/plural';
import type { GateReviewBody, GateReviewOutcome, LearningQualityReport } from './learningQualityReport';

/*
 * GAP-FIX-R2 learning: the Appendix P Part 8 metrics (scorer parity, d′ before
 * and after, representation A/B, tap-alternative and locale coverage) and the
 * Appendix C 1.3 QA metrics (placement commit success, prerequisite gate,
 * forced update, defect escapes) in the staff learning-quality panel, with the
 * defect-escape entry form. Release metrics show their target; diagnostic
 * metrics are labelled as such and carry none. It never shows a learner.
 *
 * Gap-fix round 7 (Appendix C 1.3 Defect Escape Rate, Stage 6): each escape
 * opens a gate-effectiveness review. The open ones are listed with their gate,
 * owner and age (overdue past the logged cadence), each closed here with what
 * changed and why the gate missed it; Core and the database refuse the rest.
 */

type Signals = NonNullable<LearningQualityReport['qaSignals']>;
type OpenGateReview = NonNullable<Signals['gateReviews']>['open'][number];
export type GateReviewOutcomeResult = 'resolved' | 'conflict' | 'error';
export type DefectEscapeBody = { lessonId: string; gateId: string; kind: 'pedagogical' | 'psychological' | 'factual' | 'regional' | 'copy' };

type Copy = {
  title: string; pending: string; target: string; diagnostic: string; none: string;
  parity: (agreed: number, reported: number) => string; parityMiss: (misses: number) => string;
  phase: Record<'pre' | 'post' | 'practice', string>; dPrime: (value: string, responses: number) => string;
  cues: (hits: number, missed: number, falseTicks: number) => string;
  variant: (kc: string, variant: string, share: string, attempts: number) => string; entry: string; stage: Record<'concrete' | 'pictorial' | 'abstract', string>;
  placement: (ok: number, total: number) => string; prerequisite: (refused: number, passed: number) => string; forced: (blocked: number) => string;
  escapes: (escapes: number, published: number) => string; tap: (ok: number, total: number) => string; locale: (ok: number, total: number) => string;
  record: string; lesson: string; gate: string; kind: string; kinds: Record<DefectEscapeBody['kind'], string>; save: string; saved: string; failed: string;
  reviews: string; reviewsNone: string; reviewsPending: string; day: { one: string; other: string }; open: (gate: string, age: string) => string;
  owner: Record<OpenGateReview['ownerRole'], string>; overdue: (max: number) => string; outcome: string; outcomes: Record<GateReviewOutcome, string>;
  ref: string; why: string; whyHint: string; close: string; closing: string; closed: string; conflict: string; retry: string;
};

const copy: Record<Locale, Copy> = {
  'en-US': {
    title: 'Teaching-visual and release QA', pending: 'Available once the QA signal migrations are applied.', target: 'Target', diagnostic: 'Diagnostic, no target', none: 'No data in this window.',
    parity: (a, r) => `Scorer parity: ${a} of ${r} graded answers agreed.`, parityMiss: (m) => `${m} answers the browser read as valid were refused.`,
    phase: { pre: 'Before the lesson', post: 'After the lesson', practice: 'Practice' }, dPrime: (v, n) => `d′ ${v} over ${n} answers`,
    cues: (h, m, f) => `Cue ticks: ${h} right, ${m} missed, ${f} extra.`,
    variant: (kc, v, s, n) => `${kc}, ${v}: ${s} transfer success over ${n}`, entry: 'Where fading started', stage: { concrete: 'Objects', pictorial: 'Pictures', abstract: 'Symbols' },
    placement: (ok, n) => `Placement saved: ${ok} of ${n}.`, prerequisite: (r, p) => `Prerequisite gate: ${r} refused, ${p} opened.`,
    forced: (b) => `Update required instead of an unearned pass: ${b}.`, escapes: (e, p) => `Defect escapes: ${e} over ${p} published versions.`,
    tap: (ok, n) => `Tap alternatives: ${ok} of ${n} drags.`, locale: (ok, n) => `Three-locale rendering: ${ok} of ${n} kinds.`,
    record: 'Record a defect escape', lesson: 'Lesson id', gate: 'Gate that should have caught it', kind: 'Kind',
    kinds: { pedagogical: 'Pedagogy', psychological: 'Wellbeing', factual: 'Fact', regional: 'Regional', copy: 'Copy' },
    save: 'Record', saved: 'Recorded.', failed: 'Could not record it. Check the ids.',
    reviews: 'Gate reviews', reviewsNone: 'No open gate reviews.', reviewsPending: 'Available once the gate review migration is applied.',
    day: { one: 'day', other: 'days' }, open: (g, a) => `${g}: open ${a}`,
    owner: { pedagogical_lead: 'Owner: Pedagogical Lead', content_engineering: 'Owner: Content engineering' }, overdue: (m) => `Overdue: over ${m} days`,
    outcome: 'What changed', outcomes: { gate_changed: 'Gate fixed', lexicon_extended: 'Lexicon extended', accepted_limitation: 'Accepted limit' },
    ref: 'Commit or gate version', why: 'Why the gate missed it', whyHint: 'At least 10 characters. It goes to the audit log.',
    close: 'Close review', closing: 'Saving', closed: 'Review closed.', conflict: 'Already closed.', retry: 'Could not close it. Try again.',
  },
  'es-MX': {
    title: 'Calidad de visuales y de lanzamiento', pending: 'Disponible cuando se apliquen las migraciones de señales.', target: 'Meta', diagnostic: 'Diagnóstico, sin meta', none: 'Sin datos en este periodo.',
    parity: (a, r) => `Paridad del calificador: ${a} de ${r} respuestas coincidieron.`, parityMiss: (m) => `${m} respuestas válidas para el navegador fueron rechazadas.`,
    phase: { pre: 'Antes de la lección', post: 'Después de la lección', practice: 'Práctica' }, dPrime: (v, n) => `d′ ${v} en ${n} respuestas`,
    cues: (h, m, f) => `Señales marcadas: ${h} bien, ${m} omitidas, ${f} de más.`,
    variant: (kc, v, s, n) => `${kc}, ${v}: ${s} de éxito en transferencia en ${n}`, entry: 'Dónde empezó el desvanecimiento', stage: { concrete: 'Objetos', pictorial: 'Dibujos', abstract: 'Símbolos' },
    placement: (ok, n) => `Ubicación guardada: ${ok} de ${n}.`, prerequisite: (r, p) => `Requisito previo: ${r} rechazados, ${p} abiertos.`,
    forced: (b) => `Actualización pedida en vez de un aprobado no ganado: ${b}.`, escapes: (e, p) => `Defectos escapados: ${e} en ${p} versiones publicadas.`,
    tap: (ok, n) => `Alternativas de toque: ${ok} de ${n} arrastres.`, locale: (ok, n) => `Render en tres idiomas: ${ok} de ${n} tipos.`,
    record: 'Registrar un defecto escapado', lesson: 'Id de la lección', gate: 'Filtro que debió detectarlo', kind: 'Tipo',
    kinds: { pedagogical: 'Pedagogía', psychological: 'Bienestar', factual: 'Dato', regional: 'Regional', copy: 'Texto' },
    save: 'Registrar', saved: 'Registrado.', failed: 'No se pudo registrar. Revisa los ids.',
    reviews: 'Revisiones de filtros', reviewsNone: 'Sin revisiones abiertas.', reviewsPending: 'Disponible cuando se aplique la migración de revisiones.',
    day: { one: 'día', other: 'días' }, open: (g, a) => `${g}: abierta hace ${a}`,
    owner: { pedagogical_lead: 'Responsable: Líder pedagógico', content_engineering: 'Responsable: Ingeniería de contenido' }, overdue: (m) => `Vencida: más de ${m} días`,
    outcome: 'Qué cambió', outcomes: { gate_changed: 'Filtro corregido', lexicon_extended: 'Léxico ampliado', accepted_limitation: 'Límite aceptado' },
    ref: 'Commit o versión del filtro', why: 'Por qué el filtro no lo detectó', whyHint: 'Mínimo 10 caracteres. Queda en la bitácora de auditoría.',
    close: 'Cerrar revisión', closing: 'Guardando', closed: 'Revisión cerrada.', conflict: 'Ya estaba cerrada.', retry: 'No se pudo cerrar. Intenta otra vez.',
  },
  'pt-BR': {
    title: 'Qualidade de visuais e de lançamento', pending: 'Disponível quando as migrações de sinais forem aplicadas.', target: 'Meta', diagnostic: 'Diagnóstico, sem meta', none: 'Sem dados neste período.',
    parity: (a, r) => `Paridade do avaliador: ${a} de ${r} respostas coincidiram.`, parityMiss: (m) => `${m} respostas válidas para o navegador foram recusadas.`,
    phase: { pre: 'Antes da lição', post: 'Depois da lição', practice: 'Prática' }, dPrime: (v, n) => `d′ ${v} em ${n} respostas`,
    cues: (h, m, f) => `Sinais marcados: ${h} certos, ${m} perdidos, ${f} a mais.`,
    variant: (kc, v, s, n) => `${kc}, ${v}: ${s} de sucesso na transferência em ${n}`, entry: 'Onde o esmaecimento começou', stage: { concrete: 'Objetos', pictorial: 'Desenhos', abstract: 'Símbolos' },
    placement: (ok, n) => `Nivelamento salvo: ${ok} de ${n}.`, prerequisite: (r, p) => `Pré-requisito: ${r} recusados, ${p} abertos.`,
    forced: (b) => `Atualização pedida em vez de aprovação não conquistada: ${b}.`, escapes: (e, p) => `Defeitos escapados: ${e} em ${p} versões publicadas.`,
    tap: (ok, n) => `Alternativas de toque: ${ok} de ${n} arrastes.`, locale: (ok, n) => `Renderização em três idiomas: ${ok} de ${n} tipos.`,
    record: 'Registrar um defeito escapado', lesson: 'Id da lição', gate: 'Filtro que deveria ter pegado', kind: 'Tipo',
    kinds: { pedagogical: 'Pedagogia', psychological: 'Bem-estar', factual: 'Fato', regional: 'Regional', copy: 'Texto' },
    save: 'Registrar', saved: 'Registrado.', failed: 'Não foi possível registrar. Confira os ids.',
    reviews: 'Revisões de filtros', reviewsNone: 'Nenhuma revisão aberta.', reviewsPending: 'Disponível quando a migração de revisões for aplicada.',
    day: { one: 'dia', other: 'dias' }, open: (g, a) => `${g}: aberta há ${a}`,
    owner: { pedagogical_lead: 'Responsável: Líder pedagógico', content_engineering: 'Responsável: Engenharia de conteúdo' }, overdue: (m) => `Atrasada: mais de ${m} dias`,
    outcome: 'O que mudou', outcomes: { gate_changed: 'Filtro corrigido', lexicon_extended: 'Léxico ampliado', accepted_limitation: 'Limite aceito' },
    ref: 'Commit ou versão do filtro', why: 'Por que o filtro não pegou', whyHint: 'Pelo menos 10 caracteres. Vai para o registro de auditoria.',
    close: 'Fechar revisão', closing: 'Salvando', closed: 'Revisão fechada.', conflict: 'Já estava fechada.', retry: 'Não foi possível fechar. Tente de novo.',
  },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GATE = /^forge\.[a-z0-9][a-z0-9.-]{2,80}$/;
/** Core's and the database's reference shape: a commit hash or a gate version. */
const CHANGE_REF = /^[A-Za-z0-9][A-Za-z0-9._/@+-]{2,79}$/;

export function LearningQaSignals({ signals, locale, onRecordEscape, onResolveGateReview }: {
  signals: LearningQualityReport['qaSignals']; locale: Locale; onRecordEscape?: (body: DefectEscapeBody) => Promise<boolean>;
  /** Gap-fix round 7: closes a gate-effectiveness review through Core. */
  onResolveGateReview?: (reviewId: string, body: GateReviewBody) => Promise<GateReviewOutcomeResult>;
}) {
  const t = copy[locale];
  const id = useId();
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  if (!signals) return <section className="lf-quality-block" aria-labelledby={`${id}-qa`}><h3 id={`${id}-qa`} data-copy-role="heading">{t.title}</h3><p data-copy-role="body">{t.pending}</p></section>;
  const s: Signals = signals;
  const release = (text: string) => <li className="lf-quality-row"><p data-copy-role="data">{text}</p><p data-copy-role="data">{t.target}: 100%</p></li>;
  const diagnostic = (text: string, key: string) => <li key={key} className="lf-quality-row"><p data-copy-role="data">{text}</p><p data-copy-role="data">{t.diagnostic}</p></li>;
  const commits = s.placementCommit.ok + s.placementCommit.failed;
  return <section className="lf-quality-block" aria-labelledby={`${id}-qa`}>
    <h3 id={`${id}-qa`} data-copy-role="heading">{t.title}</h3>
    <ul className="lf-quality-list">
      {release(s.scorerParity.reported === 0 ? `${t.parity(0, 0)} ${t.none}` : t.parity(s.scorerParity.agreed, s.scorerParity.reported))}
      {s.scorerParity.refusedButClientValid > 0 ? <li className="lf-quality-row"><p data-copy-role="data">{t.parityMiss(s.scorerParity.refusedButClientValid)}</p></li> : null}
      {s.coverage ? release(t.tap(s.coverage.tap_alternative.with_alternative, s.coverage.tap_alternative.drag_interactions)) : null}
      {s.coverage ? release(t.locale(s.coverage.locale_rendering.covered, s.coverage.locale_rendering.kinds)) : null}
      {release(commits === 0 ? `${t.placement(0, 0)} ${t.none}` : t.placement(s.placementCommit.ok, commits))}
      {release(t.prerequisite(s.prerequisiteGate.refused, s.prerequisiteGate.passed))}
      {release(t.forced(s.forcedUpdate.blocked))}
      <li className="lf-quality-row"><p data-copy-role="data">{t.escapes(s.defectEscapes.escapes, s.defectEscapes.publishedVersions)}</p><p data-copy-role="data">{t.target}: 0</p></li>
    </ul>
    <ul className="lf-quality-list">
      {s.detectionByPhase.length === 0 ? diagnostic(t.none, 'phase-none') : s.detectionByPhase.map((row) => diagnostic(`${t.phase[row.item_phase]}: ${t.dPrime(row.dPrime.toFixed(2), row.responses)}`, row.item_phase))}
      {s.cueHits.responses > 0 ? diagnostic(t.cues(s.cueHits.hits, s.cueHits.missed, s.cueHits.false_ticks), 'cues') : null}
      {s.variantTransfer.rows.map((row) => diagnostic(t.variant(row.kc, row.variant, percent.format(row.success_share), row.first_attempts), `${row.kc}:${row.variant}`))}
      {s.cpaEntryStages.rows.length > 0 ? diagnostic(`${t.entry}: ${s.cpaEntryStages.rows.map((row) => `${t.stage[row.entry_stage]} ${row.runs}`).join(', ')}`, 'entry') : null}
    </ul>
    <GateReviews t={t} locale={locale} reviews={s.gateReviews ?? null} onResolve={onResolveGateReview} />
    {onRecordEscape ? <EscapeForm t={t} onRecordEscape={onRecordEscape} /> : null}
  </section>;
}

function GateReviews({ t, locale, reviews, onResolve }: {
  t: Copy; locale: Locale; reviews: Signals['gateReviews'] | null;
  onResolve?: (reviewId: string, body: GateReviewBody) => Promise<GateReviewOutcomeResult>;
}) {
  const id = useId();
  const [closed, setClosed] = useState<string[]>([]);
  const open = reviews ? reviews.open.filter((review) => !closed.includes(review.reviewId)) : [];
  return <section className="lf-quality-form" aria-labelledby={`${id}-reviews`}>
    <p id={`${id}-reviews`} className="lf-quality-name" data-copy-role="data">{t.reviews}</p>
    {!reviews ? <p data-copy-role="body">{t.reviewsPending}</p>
      : open.length === 0 ? <p data-copy-role="body">{closed.length > 0 ? t.closed : t.reviewsNone}</p>
        : <ul className="lf-quality-list">{open.map((review) => <li key={review.reviewId} className="lf-quality-review" data-status={review.overdue ? 'overdue' : 'open'}>
          <p data-copy-role="data">{t.open(review.gateId, `${review.ageDays} ${pluralUnit(locale, review.ageDays, t.day)}`)}</p>
          <p data-copy-role="data">{t.owner[review.ownerRole]}</p>
          {review.overdue ? <p data-copy-role="data">{t.overdue(reviews.maxOpenDays)}</p> : null}
          {onResolve ? <GateReviewForm t={t} review={review} onResolve={onResolve} onClosed={() => setClosed((ids) => [...ids, review.reviewId])} /> : null}
        </li>)}</ul>}
  </section>;
}

function GateReviewForm({ t, review, onResolve, onClosed }: {
  t: Copy; review: OpenGateReview; onResolve: (reviewId: string, body: GateReviewBody) => Promise<GateReviewOutcomeResult>; onClosed: () => void;
}) {
  const id = useId();
  const [outcome, setOutcome] = useState<GateReviewOutcome | null>(null);
  const [note, setNote] = useState('');
  const [ref, setRef] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'conflict' | 'error'>('idle');
  const changed = outcome === 'gate_changed';
  const ready = outcome !== null && note.trim().length >= 10 && note.trim().length <= 600 && (!changed || CHANGE_REF.test(ref.trim()));
  const submit = async () => {
    if (!ready || outcome === null) return;
    setStatus('saving');
    const result = await onResolve(review.reviewId, { outcome, note: note.trim(), ...(changed ? { gateChangeRef: ref.trim() } : {}) });
    if (result === 'resolved') { onClosed(); return; }
    setStatus(result);
  };
  return <form className="lf-quality-form" aria-labelledby={`${id}-gate`} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <p id={`${id}-gate`} data-copy-role="body">{review.gateDescription}</p>
    <SegmentedControl legend={t.outcome} name={`${id}-outcome`} value={outcome} onValueChange={(value) => { setOutcome(value); setStatus('idle'); }}
      options={(['gate_changed', 'lexicon_extended', 'accepted_limitation'] as const).map((value) => ({ value, label: t.outcomes[value] }))} />
    {changed ? <TextField label={t.ref} value={ref} autoComplete="off" maxLength={80} onChange={(event) => { setRef(event.target.value); setStatus('idle'); }} /> : null}
    <TextAreaField label={t.why} help={t.whyHint} value={note} maxLength={600} onChange={(event) => { setNote(event.target.value); setStatus('idle'); }} />
    {status === 'conflict' || status === 'error' ? <InlineNotice tone="error" live>{status === 'conflict' ? t.conflict : t.retry}</InlineNotice> : null}
    <div className="lf-actions"><Button type="submit" variant="accent" disabled={!ready || status === 'saving'}>{status === 'saving' ? t.closing : t.close}</Button></div>
  </form>;
}

function EscapeForm({ t, onRecordEscape }: { t: Copy; onRecordEscape: (body: DefectEscapeBody) => Promise<boolean> }) {
  const id = useId();
  const [lessonId, setLessonId] = useState('');
  const [gateId, setGateId] = useState('');
  const [kind, setKind] = useState<DefectEscapeBody['kind'] | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const ready = UUID.test(lessonId.trim()) && GATE.test(gateId.trim()) && kind !== null;
  const submit = async () => {
    if (!ready || kind === null) return;
    setStatus('saving');
    setStatus(await onRecordEscape({ lessonId: lessonId.trim(), gateId: gateId.trim(), kind }) ? 'saved' : 'failed');
  };
  return <form className="lf-quality-form" aria-labelledby={`${id}-escape`} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <p id={`${id}-escape`} className="lf-quality-name" data-copy-role="data">{t.record}</p>
    <TextField label={t.lesson} value={lessonId} autoComplete="off" onChange={(event) => { setLessonId(event.target.value); setStatus('idle'); }} />
    <TextField label={t.gate} value={gateId} autoComplete="off" onChange={(event) => { setGateId(event.target.value); setStatus('idle'); }} />
    <SegmentedControl legend={t.kind} name={`${id}-kind`} value={kind} onValueChange={(value) => { setKind(value); setStatus('idle'); }}
      options={(['pedagogical', 'psychological', 'factual', 'regional', 'copy'] as const).map((value) => ({ value, label: t.kinds[value] }))} />
    {status === 'saved' || status === 'failed' ? <InlineNotice tone={status === 'saved' ? 'success' : 'error'} live>{status === 'saved' ? t.saved : t.failed}</InlineNotice> : null}
    <div className="lf-actions"><Button type="submit" variant="accent" disabled={!ready || status === 'saving'}>{t.save}</Button></div>
  </form>;
}
