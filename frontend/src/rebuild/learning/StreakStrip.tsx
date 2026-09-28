import type { CopyRole, Locale } from '../design/copyBudget';
import { Glyph } from '../design/controls';
import type { StreakView } from './motivation';
import './streakStrip.css';

/*
 * GAP-FIX-R1 learning (Bible 02 §9.6 rules 4-6, §4.4 item 2; Bible 04 §4.3):
 * the weekly streak strip. Seven day dots, Monday first, from Core's `week`
 * (the learner's own calendar). Each state is carried by shape, glyph and a
 * word (rule 6): practised is a filled dot with a check, a rest day a
 * half-filled dot, a paused day a square with the pause glyph, an open day an
 * empty ring. Today wears a 3 px primary-strong ring. An ordinary practised
 * day updates the strip without a celebration (rule 5); the dots only wave in
 * once, on route entry, and not at all with reduced motion.
 */

export type StreakDay = NonNullable<StreakView['week']>[number];

export const streakStripCopy: Record<Locale, { label: string; practiced: string; rest: string; paused: string; open: string; today: string }> = {
  'en-US': { label: 'This week', practiced: 'Practiced', rest: 'Rest day', paused: 'Paused', open: 'Open', today: 'Today' },
  'es-MX': { label: 'Esta semana', practiced: 'Practicado', rest: 'Día de descanso', paused: 'En pausa', open: 'Libre', today: 'Hoy' },
  'pt-BR': { label: 'Esta semana', practiced: 'Praticado', rest: 'Dia de descanso', paused: 'Pausado', open: 'Livre', today: 'Hoje' },
};
export const streakStripRoles: Record<keyof (typeof streakStripCopy)['en-US'], CopyRole> = {
  label: 'heading', practiced: 'data', rest: 'data', paused: 'data', open: 'data', today: 'data',
};

/** The learner's local date, the same calendar Core used for the week. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function StreakStrip({ week, locale, today = localToday() }: { week: readonly StreakDay[]; locale: Locale; today?: string }) {
  if (week.length !== 7) return null;
  const t = streakStripCopy[locale];
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' });
  const longDay = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  return <section className="lf-streak-strip" aria-label={t.label} data-copy-role="data">
    <ol className="lf-streak-strip-days">
      {week.map((day, index) => {
        const date = new Date(`${day.date}T00:00:00Z`);
        const isToday = day.date === today || day.state === 'today';
        const word = day.state === 'practiced' ? t.practiced : day.state === 'rest' ? t.rest : day.state === 'paused' ? t.paused : day.state === 'today' ? t.today : t.open;
        return <li key={day.date} className={`lf-streak-day lf-streak-day--${day.state}${isToday ? ' lf-streak-day--current' : ''}`}
          style={{ animationDelay: `${index * 60}ms` }} aria-current={isToday ? 'date' : undefined}>
          <span className="lf-streak-dot" aria-hidden="true">
            {day.state === 'practiced' ? <Glyph name="check" /> : day.state === 'paused' ? <Glyph name="pause" /> : null}
          </span>
          <span className="lf-streak-weekday" aria-hidden="true" data-copy-role="data">{weekday.format(date)}</span>
          <span className="lf-visually-hidden">{`${longDay.format(date)}: ${word}${isToday && day.state !== 'today' ? `, ${t.today}` : ''}`}</span>
        </li>;
      })}
    </ol>
  </section>;
}
