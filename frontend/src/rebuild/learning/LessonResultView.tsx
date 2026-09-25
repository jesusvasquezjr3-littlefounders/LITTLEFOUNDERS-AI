import { useEffect, useRef } from 'react';
import { z } from 'zod';
import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import './result.css';

const id = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,100}$/);
export const lessonCompletionReceiptSchema = z.object({
  schema_version: z.literal(2),
  completion_id: id,
  lesson_id: id,
  version_id: id,
  locale: z.enum(['en-US', 'es-MX', 'pt-BR']),
  first_try_correct: z.number().int().nonnegative().safe(),
  graded_count: z.number().int().positive().safe(),
  awarded_xp: z.number().int().nonnegative().safe(),
  duration_seconds: z.number().int().positive().safe(),
  previous_best_percent: z.number().int().min(0).max(100),
  /*
   * B.5 (S05.3d): Core's own replay facts. When present they decide the
   * notice; the browser never infers "your best is kept" on its own. Optional
   * only so a sample fixture without them still renders.
   */
  replay: z.object({
    kind: z.enum(['first', 'retry', 'replay']),
    notice: z.enum(['best_kept', 'new_best', 'none']),
    best_score_kept: z.boolean(),
    xp_policy: z.literal('improvement_only'),
  }).strict().optional(),
  /* B.12: counts only; never the reasons themselves or how each was judged. */
  judgment: z.object({
    assessed: z.number().int().nonnegative().safe(), sound: z.number().int().nonnegative().safe(),
    partial: z.number().int().nonnegative().safe(), unsupported: z.number().int().nonnegative().safe(),
  }).strict().optional(),
}).strict().refine((value) => value.first_try_correct <= value.graded_count, 'Invalid accuracy')
  .refine((value) => !value.judgment || (value.judgment.sound + value.judgment.partial + value.judgment.unsupported === value.judgment.assessed
    && value.judgment.assessed <= value.graded_count), 'Invalid judgment')
  .refine((value) => !value.replay || (value.replay.notice === 'best_kept') === value.replay.best_score_kept, 'Invalid replay');
export type LessonCompletionReceipt = z.infer<typeof lessonCompletionReceiptSchema>;

const copy: Record<Locale, { done: string; preview: string; score: (correct: number, total: number) => string; xp: string; accuracy: string;
  time: string; comparison: string; today: string; best: string; newBest: string; savedBest: (best: number) => string;
  reasoned: string; continue: string; unavailable: string }> = {
  'en-US': { done: 'Lesson complete!', preview: 'Sample result', score: (a, n) => `${a}/${n} on first try.`,
    xp: 'XP earned', accuracy: 'First-try accuracy', time: 'Time', comparison: 'Today vs your best', today: 'Today', best: 'Best',
    newBest: 'New best', savedBest: (best) => `Your saved best is still ${best}%. This was practice.`,
    reasoned: 'Well-explained choices',
    continue: 'Continue', unavailable: 'Result unavailable' },
  'es-MX': { done: '¡Lección terminada!', preview: 'Resultado de ejemplo', score: (a, n) => `${a}/${n} al primer intento.`,
    xp: 'XP ganados', accuracy: 'Aciertos al primer intento', time: 'Tiempo', comparison: 'Hoy frente a tu mejor marca', today: 'Hoy', best: 'Mejor',
    newBest: 'Nueva mejor marca', savedBest: (best) => `Tu mejor marca sigue en ${best}%. Fue práctica.`,
    reasoned: 'Decisiones bien explicadas',
    continue: 'Continuar', unavailable: 'Resultado no disponible' },
  'pt-BR': { done: 'Lição concluída!', preview: 'Resultado de exemplo', score: (a, n) => `${a}/${n} na primeira tentativa.`,
    xp: 'XP ganhos', accuracy: 'Acertos na primeira tentativa', time: 'Tempo', comparison: 'Hoje e seu recorde', today: 'Hoje', best: 'Recorde',
    newBest: 'Novo recorde', savedBest: (best) => `Seu recorde salvo continua ${best}%. Foi prática.`,
    reasoned: 'Escolhas bem explicadas',
    continue: 'Continuar', unavailable: 'Resultado indisponível' },
};

/**
 * Shape validation is display-only; the caller must obtain a completion
 * receipt from authenticated Core. `onNoticeShown` fires once, when the
 * "saved best is still X" notice is actually on screen (the numerator of
 * Appendix C's replay-notice display rate); a fixture never reports it.
 */
export function LessonResultView({ rawReceipt, locale, onContinue, fixture = false, dark, onNoticeShown }: {
  rawReceipt: unknown; locale: Locale; onContinue: () => void; fixture?: boolean;
  /** Set when the view is mounted outside a themed `.lf-rebuild` host (the authenticated route). */
  dark?: boolean;
  onNoticeShown?: () => void;
}) {
  const parsed = lessonCompletionReceiptSchema.safeParse(rawReceipt);
  const valid = parsed.success && parsed.data.locale === locale;
  const receiptValue = valid ? parsed.data : null;
  const accuracyValue = receiptValue ? Math.round(100 * receiptValue.first_try_correct / receiptValue.graded_count) : 0;
  const keptBest = receiptValue ? receiptValue.replay ? receiptValue.replay.notice === 'best_kept'
    : accuracyValue < receiptValue.previous_best_percent : false;
  const reported = useRef(false);
  useEffect(() => {
    if (!keptBest || fixture || reported.current || !onNoticeShown) return;
    reported.current = true;
    onNoticeShown();
  }, [keptBest, fixture, onNoticeShown]);
  const t = copy[locale];
  const host = dark === undefined ? {} : { 'data-theme': dark ? 'dark' : 'light', lang: locale };
  const rootClass = dark === undefined ? 'lf-result' : 'lf-rebuild lf-result';
  if (!receiptValue) return <main className={rootClass} {...host} data-surface="app" data-screen="result-unavailable">
    <div className="lf-result-inner"><h1 data-copy-role="heading">{t.unavailable}</h1><Button variant="accent" onClick={onContinue}>{t.continue}</Button></div>
  </main>;
  const receipt = receiptValue;
  const accuracy = accuracyValue;
  const best = keptBest ? receipt.previous_best_percent : Math.max(accuracy, receipt.previous_best_percent);
  const newBest = receipt.replay ? receipt.replay.notice === 'new_best' : accuracy > receipt.previous_best_percent;
  const duration = `${Math.floor(receipt.duration_seconds / 60)}:${String(receipt.duration_seconds % 60).padStart(2, '0')}`;
  const xp = new Intl.NumberFormat(locale).format(receipt.awarded_xp);
  return <main className={rootClass} {...host} data-surface="app" data-screen={fixture ? 'result-preview' : 'result'}>
    <div className="lf-result-inner">
      {fixture ? <p className="lf-result-preview-label" data-copy-role="body">{t.preview}</p> : null}
      <div className="lf-result-hero">
        <img src="/rebuild/art/lesson-medal.svg" alt="" className="lf-result-medal" />
        <h1 data-copy-role="heading">{t.done}</h1>
        {keptBest ? null
          : <p data-copy-role="body">{t.score(receipt.first_try_correct, receipt.graded_count)}</p>}
      </div>
      <div className="lf-result-sheet">
        <div className="lf-result-stats" aria-label={t.done}>
          <div className="lf-result-stat"><strong data-copy-role="data">+{xp}</strong><span data-copy-role="body">{t.xp}</span></div>
          <div className="lf-result-stat"><strong data-copy-role="data">{accuracy}%</strong><span data-copy-role="body">{t.accuracy}</span></div>
          <div className="lf-result-stat"><strong data-copy-role="data">{duration}</strong><span data-copy-role="body">{t.time}</span></div>
        </div>
        {receipt.judgment && receipt.judgment.assessed > 0 ? <p className="lf-result-judgment">
          <strong data-copy-role="data">{receipt.judgment.sound}/{receipt.judgment.assessed}</strong>
          <span data-copy-role="body">{t.reasoned}</span></p> : null}
        <section className="lf-result-compare" aria-label={t.comparison}>
          {/* B.5: a lower run leads with the kept best; the notice itself names the comparison. */}
          {keptBest ? <p className="lf-result-saved-best" data-copy-role="body">{t.savedBest(receipt.previous_best_percent)}</p>
            : <div className="lf-result-compare-head"><h2 data-copy-role="heading">{t.comparison}</h2>
              {newBest ? <span className="lf-result-best-note" data-copy-role="body">{t.newBest}</span> : null}</div>}
          {([{ label: t.today, value: accuracy }, { label: t.best, value: best }] as const).map(({ label, value }) =>
            <div className="lf-result-row" key={label}><span data-copy-role="body">{label}</span>
              <div className="lf-result-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
                <span style={{ inlineSize: `${value}%` }} /></div><strong data-copy-role="data">{value}%</strong></div>)}
        </section>
        <Button variant="accent" onClick={onContinue}>{t.continue}</Button>
      </div>
    </div>
  </main>;
}
