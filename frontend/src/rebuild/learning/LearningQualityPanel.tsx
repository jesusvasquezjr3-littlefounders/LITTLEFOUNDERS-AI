import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import {
  bandInsideGuardRails, decisionsFor, learningQualityReportSchema,
  type LearningQualityReport, type ReviewDecision, type ReviewDecisionBody,
} from './learningQualityReport';
import './learningQuality.css';

/*
 * S05.3d staff surface for the content and learning-design team (B.19: the
 * target band must be a visible, tracked metric per lesson). It shows Core's
 * report and records calibration decisions through Core, which re-checks the
 * content permission and the database guard rails. It never shows a learner.
 */

export type LearningQualityState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; report: unknown };
export type DecisionOutcome = 'resolved' | 'conflict' | 'error';

type Copy = {
  title: string; intro: (lower: number, upper: number) => string; reviewDue: string; loading: string; failed: string; retry: string;
  practice: string; practiceEmpty: string; tries: (successes: number, attempts: number) => string; band: (lower: number, upper: number) => string;
  status: Record<LearningQualityReport['lessons'][number]['status'], string>; lessonBand: string;
  reviews: string; reviewsEmpty: string; sync: string; syncing: string; windows: (current: string, previous: string) => string;
  direction: Record<'below_band' | 'above_band', string>; decision: Record<ReviewDecision, string>;
  note: string; noteHint: string; lower: string; upper: string; record: string; recording: string; bandInvalid: string; conflict: string;
  reasoning: string; reasoningEmpty: string; diverge: (share: string, attempts: number) => string;
  signal: Record<LearningQualityReport['judgment'][number]['status'], string>;
  replay: string; replayRate: (shown: number, total: number) => string; replayNone: string; replayLow: string;
  motivation: string; motivationPending: string; restDays: (kept: number, lapsed: number) => string; restDaysNone: string;
  lever: Record<'path' | 'mentor' | 'pace', string>; adoption: (exercised: number, offered: number) => string; adoptionNone: string;
};

const copy: Record<Locale, Copy> = {
  'en-US': {
    title: 'Learning quality', intro: (l, u) => `Practice should land at ${l}-${u}% first-try success per lesson.`,
    reviewDue: 'The default band is due for its quarterly review.', loading: 'Loading learning quality', failed: 'Could not load learning quality.', retry: 'Try again',
    practice: 'Practice difficulty', practiceEmpty: 'No graded practice in this window.', tries: (s, a) => `${s} of ${a} first tries`, band: (l, u) => `Band ${l}-${u}%`,
    status: { in_band: 'In band', above_band: 'Too easy', below_band: 'Too hard', insufficient_sample: 'Not enough data' }, lessonBand: 'Lesson band',
    reviews: 'Calibration reviews', reviewsEmpty: 'No open reviews.', sync: 'Check for reviews', syncing: 'Checking',
    windows: (c, p) => `Now ${c}%, before ${p}%.`,
    direction: { above_band: 'Too easy twice in a row', below_band: 'Too hard twice in a row' },
    decision: { make_harder: 'Make harder', make_easier: 'Make easier', adjust_band: 'Adjust band', no_change: 'Keep as is' },
    note: 'Decision note', noteHint: 'At least 10 characters. It goes to the audit log.', lower: 'Lower %', upper: 'Upper %',
    record: 'Record decision', recording: 'Recording', bandInvalid: 'Keep the band between 50 and 95%, at least 5 points wide.', conflict: 'Someone already decided this review.',
    reasoning: 'Reasoning signal', reasoningEmpty: 'No reasoning answers in this window.', diverge: (share, n) => `${share} of ${n} answers differ from correctness.`,
    signal: { distinct: 'Measures reasoning', tracks_correctness: 'Tracks correctness only', insufficient_sample: 'Not enough data' },
    replay: 'Replay notice', replayRate: (s, n) => `${s} of ${n} lower replays showed the saved best.`, replayNone: 'No lower replays in this window.', replayLow: 'Below the 100% target.',
    motivation: 'Motivation signals', motivationPending: 'Available once the motivation migration is applied.',
    restDays: (k, n) => `Rest days kept ${k} of ${n} streaks that met a missed day.`, restDaysNone: 'No missed days in this window.',
    lever: { path: 'Path choice', mentor: 'Mentor choice', pace: 'Pace choice' }, adoption: (e, o) => `${e} of ${o} chose it themselves.`, adoptionNone: 'No data in this window.',
  },
  'es-MX': {
    title: 'Calidad del aprendizaje', intro: (l, u) => `La práctica debe lograr ${l}-${u}% de aciertos al primer intento por lección.`,
    reviewDue: 'La banda general necesita su revisión trimestral.', loading: 'Cargando calidad del aprendizaje', failed: 'No se pudo cargar la calidad del aprendizaje.', retry: 'Reintentar',
    practice: 'Dificultad de práctica', practiceEmpty: 'No hay práctica calificada en este periodo.', tries: (s, a) => `${s} de ${a} primeros intentos`, band: (l, u) => `Banda ${l}-${u}%`,
    status: { in_band: 'En la banda', above_band: 'Muy fácil', below_band: 'Muy difícil', insufficient_sample: 'Faltan datos' }, lessonBand: 'Banda de la lección',
    reviews: 'Revisiones de calibración', reviewsEmpty: 'No hay revisiones abiertas.', sync: 'Buscar revisiones', syncing: 'Buscando',
    windows: (c, p) => `Ahora ${c}%, antes ${p}%.`,
    direction: { above_band: 'Muy fácil dos veces seguidas', below_band: 'Muy difícil dos veces seguidas' },
    decision: { make_harder: 'Hacer más difícil', make_easier: 'Hacer más fácil', adjust_band: 'Ajustar banda', no_change: 'Dejar igual' },
    note: 'Nota de la decisión', noteHint: 'Mínimo 10 caracteres. Queda en la bitácora de auditoría.', lower: 'Mínimo %', upper: 'Máximo %',
    record: 'Registrar decisión', recording: 'Registrando', bandInvalid: 'La banda va de 50 a 95%, con al menos 5 puntos.', conflict: 'Alguien ya decidió esta revisión.',
    reasoning: 'Señal de razonamiento', reasoningEmpty: 'No hay respuestas razonadas en este periodo.', diverge: (share, n) => `${share} de ${n} respuestas difieren del acierto.`,
    signal: { distinct: 'Mide el razonamiento', tracks_correctness: 'Solo sigue el acierto', insufficient_sample: 'Faltan datos' },
    replay: 'Aviso al repetir', replayRate: (s, n) => `${s} de ${n} repeticiones más bajas mostraron la mejor marca.`, replayNone: 'No hay repeticiones más bajas en este periodo.', replayLow: 'Debajo de la meta de 100%.',
    motivation: 'Señales de motivación', motivationPending: 'Disponible cuando se aplique la migración de motivación.',
    restDays: (k, n) => `Los días de descanso mantuvieron ${k} de ${n} rachas con un día sin práctica.`, restDaysNone: 'No hubo días sin práctica en este periodo.',
    lever: { path: 'Elección de ruta', mentor: 'Elección de Mentor', pace: 'Elección de ritmo' }, adoption: (e, o) => `${e} de ${o} lo eligieron por su cuenta.`, adoptionNone: 'Sin datos en este periodo.',
  },
  'pt-BR': {
    title: 'Qualidade da aprendizagem', intro: (l, u) => `A prática deve ter ${l}-${u}% de acertos na primeira tentativa por lição.`,
    reviewDue: 'A faixa padrão precisa da revisão trimestral.', loading: 'Carregando qualidade da aprendizagem', failed: 'Não foi possível carregar a qualidade da aprendizagem.', retry: 'Tentar de novo',
    practice: 'Dificuldade da prática', practiceEmpty: 'Nenhuma prática corrigida neste período.', tries: (s, a) => `${s} de ${a} primeiras tentativas`, band: (l, u) => `Faixa ${l}-${u}%`,
    status: { in_band: 'Na faixa', above_band: 'Fácil demais', below_band: 'Difícil demais', insufficient_sample: 'Poucos dados' }, lessonBand: 'Faixa da lição',
    reviews: 'Revisões de calibração', reviewsEmpty: 'Nenhuma revisão aberta.', sync: 'Buscar revisões', syncing: 'Buscando',
    windows: (c, p) => `Agora ${c}%, antes ${p}%.`,
    direction: { above_band: 'Fácil demais duas vezes seguidas', below_band: 'Difícil demais duas vezes seguidas' },
    decision: { make_harder: 'Deixar mais difícil', make_easier: 'Deixar mais fácil', adjust_band: 'Ajustar faixa', no_change: 'Manter como está' },
    note: 'Nota da decisão', noteHint: 'Pelo menos 10 caracteres. Vai para o registro de auditoria.', lower: 'Mínimo %', upper: 'Máximo %',
    record: 'Registrar decisão', recording: 'Registrando', bandInvalid: 'A faixa vai de 50 a 95%, com pelo menos 5 pontos.', conflict: 'Alguém já decidiu esta revisão.',
    reasoning: 'Sinal de raciocínio', reasoningEmpty: 'Nenhuma resposta justificada neste período.', diverge: (share, n) => `${share} de ${n} respostas diferem do acerto.`,
    signal: { distinct: 'Mede o raciocínio', tracks_correctness: 'Só acompanha o acerto', insufficient_sample: 'Poucos dados' },
    replay: 'Aviso de repetição', replayRate: (s, n) => `${s} de ${n} repetições mais baixas mostraram o recorde.`, replayNone: 'Nenhuma repetição mais baixa neste período.', replayLow: 'Abaixo da meta de 100%.',
    motivation: 'Sinais de motivação', motivationPending: 'Disponível quando a migração de motivação for aplicada.',
    restDays: (k, n) => `Os dias de descanso mantiveram ${k} de ${n} sequências com um dia sem prática.`, restDaysNone: 'Nenhum dia sem prática neste período.',
    lever: { path: 'Escolha de trilha', mentor: 'Escolha de Mentor', pace: 'Escolha de ritmo' }, adoption: (e, o) => `${e} de ${o} escolheram por conta própria.`, adoptionNone: 'Sem dados neste período.',
  },
};

function titleOf(title: Record<string, unknown> | null, slug: string, locale: Locale): string {
  const value = title?.[locale] ?? title?.['es-MX'] ?? Object.values(title ?? {})[0];
  return typeof value === 'string' && value.trim() ? value : slug;
}

function evidencePct(evidence: Record<string, unknown>, key: 'current' | 'previous'): string {
  const window = evidence[key];
  const value = window && typeof window === 'object' ? (window as Record<string, unknown>).success_pct : undefined;
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '-';
}

export function LearningQualityPanel({ state, locale, dark, onRetry, onSync, onResolve, fixture = false }: {
  state: LearningQualityState; locale: Locale; dark: boolean;
  onRetry: () => void;
  onSync: () => Promise<boolean>;
  onResolve: (reviewId: string, body: ReviewDecisionBody) => Promise<DecisionOutcome>;
  fixture?: boolean;
}) {
  const t = copy[locale];
  const headingId = useId();
  const [syncing, setSyncing] = useState(false);
  const parsed = state.status === 'ready' ? learningQualityReportSchema.safeParse(state.report) : null;
  const host = { className: 'lf-rebuild lf-quality', 'data-theme': dark ? 'dark' : 'light', lang: locale, 'data-surface': 'app',
    'data-screen': fixture ? 'learning-quality-preview' : 'learning-quality', 'aria-labelledby': headingId } as const;
  if (state.status === 'loading') return <section {...host} aria-busy="true"><h2 id={headingId} data-copy-role="heading">{t.title}</h2>
    <p role="status" data-copy-role="body">{t.loading}</p></section>;
  if (state.status === 'error' || !parsed?.success) return <section {...host}><h2 id={headingId} data-copy-role="heading">{t.title}</h2>
    <p role="alert" data-copy-role="body">{t.failed}</p><div className="lf-actions"><Button onClick={onRetry}>{t.retry}</Button></div></section>;
  const report = parsed.data;
  const titles = new Map(report.lessons.map((lesson) => [lesson.lesson_id, titleOf(lesson.lesson_title, lesson.lesson_slug, locale)]));
  const nameOf = (lessonId: string) => titles.get(lessonId) ?? lessonId.slice(0, 8);
  const open = report.reviews.filter((review) => review.status === 'open');
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const sync = async () => { setSyncing(true); const done = await onSync(); setSyncing(false); if (done) onRetry(); };

  return <section {...host}>
    <header className="lf-quality-head">
      <h2 id={headingId} data-copy-role="heading">{t.title}</h2>
      {report.defaultBand ? <p data-copy-role="body">{t.intro(report.defaultBand.lower_pct, report.defaultBand.upper_pct)}</p> : null}
      {report.defaultBand?.reviewDue ? <p className="lf-quality-flag" data-copy-role="body">{t.reviewDue}</p> : null}
    </header>

    <section className="lf-quality-block" aria-labelledby={`${headingId}-practice`}>
      <h3 id={`${headingId}-practice`} data-copy-role="heading">{t.practice}</h3>
      {report.lessons.length === 0 ? <p data-copy-role="body">{t.practiceEmpty}</p>
        : <ul className="lf-quality-list">{report.lessons.map((lesson) => <li key={lesson.lesson_id} className="lf-quality-row" data-status={lesson.status}>
          <p className="lf-quality-name" data-copy-role="data">{nameOf(lesson.lesson_id)}</p>
          <p data-copy-role="data"><strong>{Math.round(lesson.success_pct)}%</strong> {t.tries(lesson.successes, lesson.first_attempts)}</p>
          <p data-copy-role="data">{t.band(lesson.lower_pct, lesson.upper_pct)}{lesson.band_scope === 'lesson' ? ` (${t.lessonBand})` : ''}</p>
          <span className="lf-quality-chip" data-copy-role="data">{t.status[lesson.status]}</span>
        </li>)}</ul>}
    </section>

    <section className="lf-quality-block" aria-labelledby={`${headingId}-reviews`}>
      <div className="lf-quality-block-head"><h3 id={`${headingId}-reviews`} data-copy-role="heading">{t.reviews}</h3>
        <Button onClick={() => void sync()} disabled={syncing}>{syncing ? t.syncing : t.sync}</Button></div>
      {open.length === 0 ? <p data-copy-role="body">{t.reviewsEmpty}</p>
        : <ul className="lf-quality-list">{open.map((review) => <li key={review.id} className="lf-quality-review">
          <ReviewForm locale={locale} name={nameOf(review.lesson_id)} review={review} t={t}
            onResolve={(body) => onResolve(review.id, body)} onResolved={onRetry} />
        </li>)}</ul>}
    </section>

    <section className="lf-quality-block" aria-labelledby={`${headingId}-reasoning`}>
      <h3 id={`${headingId}-reasoning`} data-copy-role="heading">{t.reasoning}</h3>
      {report.judgment.length === 0 ? <p data-copy-role="body">{t.reasoningEmpty}</p>
        : <ul className="lf-quality-list">{report.judgment.map((row) => <li key={row.lesson_id} className="lf-quality-row" data-status={row.status}>
          <p className="lf-quality-name" data-copy-role="data">{nameOf(row.lesson_id)}</p>
          <p data-copy-role="data">{t.diverge(percent.format(row.divergent_share), row.attempts)}</p>
          <span className="lf-quality-chip" data-copy-role="data">{t.signal[row.status]}</span>
        </li>)}</ul>}
    </section>

    <section className="lf-quality-block" aria-labelledby={`${headingId}-replay`}>
      <h3 id={`${headingId}-replay`} data-copy-role="heading">{t.replay}</h3>
      <p data-copy-role="body">{report.replayNotice.below_best === 0 ? t.replayNone : t.replayRate(report.replayNotice.shown, report.replayNotice.below_best)}</p>
      {report.replayNotice.belowTarget ? <p className="lf-quality-flag" data-copy-role="body">{t.replayLow}</p> : null}
    </section>

    {/* S05.3e: Appendix C's rest-day utilization (B.21) and autonomy adoption (B.24), diagnostic. */}
    <section className="lf-quality-block" aria-labelledby={`${headingId}-motivation`}>
      <h3 id={`${headingId}-motivation`} data-copy-role="heading">{t.motivation}</h3>
      {!report.motivation ? <p data-copy-role="body">{t.motivationPending}</p> : <>
        <p data-copy-role="body">{report.motivation.restDays.learners_with_lapse === 0 ? t.restDaysNone
          : t.restDays(report.motivation.restDays.kept_by_rest_days, report.motivation.restDays.learners_with_lapse)}</p>
        <ul className="lf-quality-list">{report.motivation.autonomy.map((row) => <li key={row.lever} className="lf-quality-row">
          <p className="lf-quality-name" data-copy-role="data">{t.lever[row.lever]}</p>
          <p data-copy-role="data">{row.offered === 0 ? t.adoptionNone : t.adoption(row.exercised, row.offered)}</p>
        </li>)}</ul>
      </>}
    </section>
  </section>;
}

function ReviewForm({ locale, name, review, t, onResolve, onResolved }: {
  locale: Locale; name: string; review: LearningQualityReport['reviews'][number]; t: Copy;
  onResolve: (body: ReviewDecisionBody) => Promise<DecisionOutcome>; onResolved: () => void;
}) {
  const id = useId();
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [note, setNote] = useState('');
  const [lower, setLower] = useState('');
  const [upper, setUpper] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'band' | 'conflict' | 'error'>('idle');
  const band = decision === 'adjust_band';
  const bandOk = !band || bandInsideGuardRails(Number(lower), Number(upper));
  const ready = decision !== null && note.trim().length >= 10 && (!band || (lower !== '' && upper !== ''));
  const submit = async () => {
    if (!ready || decision === null) return;
    if (!bandOk) { setStatus('band'); return; }
    setStatus('saving');
    const outcome = await onResolve({ decision, note: note.trim(), ...(band ? { lowerPct: Number(lower), upperPct: Number(upper) } : {}) });
    if (outcome === 'resolved') { setStatus('idle'); onResolved(); return; }
    setStatus(outcome === 'conflict' ? 'conflict' : 'error');
  };
  return <form className="lf-quality-form" lang={locale} aria-labelledby={`${id}-name`} onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <p id={`${id}-name`} className="lf-quality-name" data-copy-role="data">{name}</p>
    <p data-copy-role="body">{t.direction[review.direction]}. {t.windows(evidencePct(review.evidence, 'current'), evidencePct(review.evidence, 'previous'))}</p>
    <div className="lf-quality-decisions" role="group" aria-label={t.record}>
      {decisionsFor(review.direction).map((option) => <button type="button" key={option} className="lf-quality-decision" data-copy-role="action"
        aria-pressed={decision === option} onClick={() => { setDecision(option); setStatus('idle'); }}>{t.decision[option]}</button>)}
    </div>
    {band ? <div className="lf-quality-band">
      <label data-copy-role="body">{t.lower}<input inputMode="numeric" value={lower} onChange={(event) => setLower(event.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
      <label data-copy-role="body">{t.upper}<input inputMode="numeric" value={upper} onChange={(event) => setUpper(event.target.value.replace(/\D/g, '').slice(0, 2))} /></label>
    </div> : null}
    <label className="lf-quality-note" data-copy-role="body">{t.note}
      <textarea value={note} maxLength={600} aria-describedby={`${id}-hint`} onChange={(event) => setNote(event.target.value)} /></label>
    <p id={`${id}-hint`} data-copy-role="body">{t.noteHint}</p>
    {status === 'band' || status === 'conflict' || status === 'error' ? <p role="alert" data-copy-role="body">
      {status === 'band' ? t.bandInvalid : status === 'conflict' ? t.conflict : t.retry}</p> : null}
    <div className="lf-actions"><Button type="submit" variant="accent" disabled={!ready || status === 'saving'}>{status === 'saving' ? t.recording : t.record}</Button></div>
  </form>;
}
