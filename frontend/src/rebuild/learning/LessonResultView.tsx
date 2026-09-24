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
}).strict().refine((value) => value.first_try_correct <= value.graded_count, 'Invalid accuracy');
export type LessonCompletionReceipt = z.infer<typeof lessonCompletionReceiptSchema>;

const copy: Record<Locale, { done: string; preview: string; score: (correct: number, total: number) => string; xp: string; accuracy: string;
  time: string; comparison: string; today: string; best: string; newBest: string; savedBest: (best: number) => string;
  continue: string; unavailable: string }> = {
  'en-US': { done: 'Lesson complete!', preview: 'Sample result', score: (a, n) => `${a}/${n} on first try.`,
    xp: 'XP earned', accuracy: 'First-try accuracy', time: 'Time', comparison: 'Today vs your best', today: 'Today', best: 'Best',
    newBest: 'New best', savedBest: (best) => `Saved best: ${best}%. This replay was practice.`,
    continue: 'Continue', unavailable: 'Result unavailable' },
  'es-MX': { done: '¡Lección terminada!', preview: 'Resultado de ejemplo', score: (a, n) => `${a}/${n} al primer intento.`,
    xp: 'XP ganados', accuracy: 'Aciertos al primer intento', time: 'Tiempo', comparison: 'Hoy frente a tu mejor marca', today: 'Hoy', best: 'Mejor',
    newBest: 'Nueva mejor marca', savedBest: (best) => `Mejor marca guardada: ${best}%. Solo fue práctica.`,
    continue: 'Continuar', unavailable: 'Resultado no disponible' },
  'pt-BR': { done: 'Lição concluída!', preview: 'Resultado de exemplo', score: (a, n) => `${a}/${n} na primeira tentativa.`,
    xp: 'XP ganhos', accuracy: 'Acertos na primeira tentativa', time: 'Tempo', comparison: 'Hoje e seu recorde', today: 'Hoje', best: 'Recorde',
    newBest: 'Novo recorde', savedBest: (best) => `Recorde salvo: ${best}%. Esta repetição foi prática.`,
    continue: 'Continuar', unavailable: 'Resultado indisponível' },
};

/** Shape validation is display-only; the caller must obtain a completion receipt from authenticated Core. */
export function LessonResultView({ rawReceipt, locale, onContinue, fixture = false }: {
  rawReceipt: unknown; locale: Locale; onContinue: () => void; fixture?: boolean;
}) {
  const parsed = lessonCompletionReceiptSchema.safeParse(rawReceipt);
  const t = copy[locale];
  if (!parsed.success || parsed.data.locale !== locale) return <main className="lf-result" data-surface="app" data-screen="result-unavailable">
    <div className="lf-result-inner"><h1 data-copy-role="heading">{t.unavailable}</h1><Button variant="accent" onClick={onContinue}>{t.continue}</Button></div>
  </main>;
  const receipt = parsed.data;
  const accuracy = Math.round(100 * receipt.first_try_correct / receipt.graded_count);
  const best = Math.max(accuracy, receipt.previous_best_percent);
  const newBest = accuracy > receipt.previous_best_percent;
  const duration = `${Math.floor(receipt.duration_seconds / 60)}:${String(receipt.duration_seconds % 60).padStart(2, '0')}`;
  const xp = new Intl.NumberFormat(locale).format(receipt.awarded_xp);
  return <main className="lf-result" data-surface="app" data-screen={fixture ? 'result-preview' : 'result'}>
    <div className="lf-result-inner">
      {fixture ? <p className="lf-result-preview-label" data-copy-role="body">{t.preview}</p> : null}
      <div className="lf-result-hero">
        <img src="/rebuild/art/lesson-medal.svg" alt="" className="lf-result-medal" />
        <h1 data-copy-role="heading">{t.done}</h1>
        {accuracy < receipt.previous_best_percent ? null
          : <p data-copy-role="body">{t.score(receipt.first_try_correct, receipt.graded_count)}</p>}
      </div>
      <div className="lf-result-sheet">
        <div className="lf-result-stats" aria-label={t.done}>
          <div className="lf-result-stat"><strong data-copy-role="data">+{xp}</strong><span data-copy-role="body">{t.xp}</span></div>
          <div className="lf-result-stat"><strong data-copy-role="data">{accuracy}%</strong><span data-copy-role="body">{t.accuracy}</span></div>
          <div className="lf-result-stat"><strong data-copy-role="data">{duration}</strong><span data-copy-role="body">{t.time}</span></div>
        </div>
        <section className="lf-result-compare" aria-label={t.comparison}>
          <div className="lf-result-compare-head"><h2 data-copy-role="heading">{t.comparison}</h2>
            {newBest ? <span className="lf-result-best-note" data-copy-role="body">{t.newBest}</span> : null}</div>
          {([{ label: t.today, value: accuracy }, { label: t.best, value: best }] as const).map(({ label, value }) =>
            <div className="lf-result-row" key={label}><span data-copy-role="body">{label}</span>
              <div className="lf-result-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
                <span style={{ inlineSize: `${value}%` }} /></div><strong data-copy-role="data">{value}%</strong></div>)}
          {accuracy < receipt.previous_best_percent ? <p className="lf-result-saved-best" data-copy-role="body">
            {t.savedBest(receipt.previous_best_percent)}</p> : null}
        </section>
        <Button variant="accent" onClick={onContinue}>{t.continue}</Button>
      </div>
    </div>
  </main>;
}
