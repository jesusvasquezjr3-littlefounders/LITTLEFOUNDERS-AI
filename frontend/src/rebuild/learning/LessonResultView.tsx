import { useEffect, useRef } from 'react';
import { z } from 'zod';
import type { Locale } from '../design/copyBudget';
import { Button, Celebration, celebrationPart, CountUp, InlineNotice, MotionAsset } from '../design/controls';
import { mayCelebrate, streakMilestone } from '../design/milestones';
import { REGISTERS, type LearnerRegister } from '../design/learnerRegisterPolicy.generated';
import { CourseBadge } from './CourseBadge';
import { learnCopy } from './learnCopy';
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
  /*
   * S05.3e. B.20: the closed OD-7 list Core says this completion reached (the
   * screen celebrates nothing else; see design/milestones.ts) and the skill
   * behind the XP, so the tally reads as information, not payment. B.21: the
   * streak after this run. B.24: today's lessons against the learner's pace.
   */
  celebrations: z.array(z.string().max(40)).max(10).optional(),
  recognition: z.object({ skills: z.array(z.string().min(1).max(80)).min(1).max(2) }).strict().optional(),
  streak: z.object({
    days: z.number().int().nonnegative().safe(),
    milestone: z.union([z.literal(7), z.literal(30), z.literal(100)]).nullable(),
    rest_days_bridged: z.number().int().nonnegative().safe(),
  }).strict().optional(),
  pace: z.object({ goal: z.number().int().min(1).max(3), passed_today: z.number().int().nonnegative().safe(), goal_met: z.boolean() }).strict().optional(),
}).strict().refine((value) => value.first_try_correct <= value.graded_count, 'Invalid accuracy')
  .refine((value) => !value.judgment || (value.judgment.sound + value.judgment.partial + value.judgment.unsupported === value.judgment.assessed
    && value.judgment.assessed <= value.graded_count), 'Invalid judgment')
  .refine((value) => !value.replay || (value.replay.notice === 'best_kept') === value.replay.best_score_kept, 'Invalid replay');
export type LessonCompletionReceipt = z.infer<typeof lessonCompletionReceiptSchema>;

const copy: Record<Locale, { done: string; preview: string; score: (correct: number, total: number) => string; xp: string; accuracy: string;
  time: string; comparison: string; today: string; best: string; newBest: string; savedBest: (best: number) => string;
  reasoned: string; continue: string; unavailable: string; figured: (skill: string) => string; streak: (days: number) => string; paceDone: string;
  /** B.23 (S05.3f): the heading and recognition line per register (the young register keeps `done` and `figured`). */
  plainDone: string; showed: (skill: string) => string; built: (skill: string) => string; skillOnly: (skill: string) => string }> = {
  'en-US': { done: 'Lesson complete!', preview: 'Sample result', score: (a, n) => `${a}/${n} on first try.`,
    xp: 'XP earned', accuracy: 'First-try accuracy', time: 'Time', comparison: 'Today vs your best', today: 'Today', best: 'Best',
    newBest: 'New best', savedBest: (best) => `Your saved best is still ${best}%. This was practice.`,
    reasoned: 'Well-explained choices',
    continue: 'Continue', unavailable: 'Result unavailable',
    figured: (skill) => `You worked out: ${skill}.`, streak: (days) => `${days}-day streak`, paceDone: 'Today\'s plan is done.',
    plainDone: 'Lesson complete', showed: (skill) => `You showed: ${skill}.`, built: (skill) => `Skill built: ${skill}.`, skillOnly: (skill) => `Skill: ${skill}.` },
  'es-MX': { done: '¡Lección terminada!', preview: 'Resultado de ejemplo', score: (a, n) => `${a}/${n} al primer intento.`,
    xp: 'XP ganados', accuracy: 'Aciertos al primer intento', time: 'Tiempo', comparison: 'Hoy frente a tu mejor marca', today: 'Hoy', best: 'Mejor',
    newBest: 'Nueva mejor marca', savedBest: (best) => `Tu mejor marca sigue en ${best}%. Fue práctica.`,
    reasoned: 'Decisiones bien explicadas',
    continue: 'Continuar', unavailable: 'Resultado no disponible',
    figured: (skill) => `Resolviste: ${skill}.`, streak: (days) => `Racha de ${days} días`, paceDone: 'Tu plan de hoy está listo.',
    plainDone: 'Lección terminada', showed: (skill) => `Demostraste: ${skill}.`, built: (skill) => `Habilidad lograda: ${skill}.`, skillOnly: (skill) => `Habilidad: ${skill}.` },
  'pt-BR': { done: 'Lição concluída!', preview: 'Resultado de exemplo', score: (a, n) => `${a}/${n} na primeira tentativa.`,
    xp: 'XP ganhos', accuracy: 'Acertos na primeira tentativa', time: 'Tempo', comparison: 'Hoje e seu recorde', today: 'Hoje', best: 'Recorde',
    newBest: 'Novo recorde', savedBest: (best) => `Seu recorde salvo continua ${best}%. Foi prática.`,
    reasoned: 'Escolhas bem explicadas',
    continue: 'Continuar', unavailable: 'Resultado indisponível',
    figured: (skill) => `Você resolveu: ${skill}.`, streak: (days) => `Sequência de ${days} dias`, paceDone: 'Seu plano de hoje está feito.',
    plainDone: 'Lição concluída', showed: (skill) => `Você mostrou: ${skill}.`, built: (skill) => `Habilidade construída: ${skill}.`, skillOnly: (skill) => `Habilidade: ${skill}.` },
};

/*
 * OD-28 (owner review item V-12): lesson completion gets a confetti burst. It is
 * the registered in-house motion asset `celebration.lesson-complete.confetti`
 * (07 §5, scripts/generate-lesson-confetti.mjs), part of the lesson-complete
 * milestone moment (OD-7, B.20): mounted only inside the `Celebration` the
 * screen opens when Core names that milestone. `MotionAsset` plays it once
 * while that celebration plays and shows its designated static frame for
 * reduced motion, a revisit or a settled moment. Every piece lands above its
 * anchor (the medal's centre, or the hero's top edge when the register shows no
 * medal), so none sits on the heading. Decorative only.
 */
function LessonConfetti({ medal }: { medal: boolean }) {
  return <span className={`lf-result-confetti${medal ? ' lf-result-confetti--medal' : ''}`} aria-hidden="true" data-celebrate="lesson-complete">
    <MotionAsset assetId="celebration.lesson-complete.confetti" />
  </span>;
}

/** Exported for the Copy Budget test: every string the result screen can show. */
export const lessonResultCopy = copy;

/**
 * Shape validation is display-only; the caller must obtain a completion
 * receipt from authenticated Core. `onNoticeShown` fires once, when the
 * "saved best is still X" notice is actually on screen (the numerator of
 * Appendix C's replay-notice display rate); a fixture never reports it.
 */
export function LessonResultView({ rawReceipt, locale, onContinue, fixture = false, dark, onNoticeShown, register = 'young', courseSlug = null }: {
  rawReceipt: unknown; locale: Locale; onContinue: () => void; fixture?: boolean;
  /** W2L.3: the course the lesson was opened from, so an earned badge shows that course's own icon. */
  courseSlug?: string | null;
  /**
   * B.23 (S05.3f): the learner's register, from Core. It changes the reward
   * framing (the recognition line, whether the medal shows, whether XP leads
   * or reads as data), never the tokens or components (OD-4). Unknown reads
   * as the youngest register.
   */
  register?: LearnerRegister;
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
  const number = new Intl.NumberFormat(locale);
  // B.20 / OD-7: motion only for what Core put on the closed list. Lesson complete
  // is on that list, so when Core names it the screen celebrates once through the
  // shared motion system (S03.7): the medal pops, the tiles rise in sequence, the
  // numbers count up and the bars fill. The part classes are inert outside a
  // playing `Celebration`; reduced motion and a revisit show the settled frame.
  const celebrateLesson = mayCelebrate(receipt.celebrations, 'lesson-complete');
  const milestone = receipt.streak?.milestone ? streakMilestone(receipt.streak.milestone) : null;
  const celebrateStreak = milestone !== null && mayCelebrate(receipt.celebrations, milestone);
  // The parts are named only when Core named the milestone, so an ordinary
  // result carries no celebration class at all.
  const none = { className: '', style: undefined };
  const pop = celebrateLesson ? celebrationPart('pop') : none;
  const fill = celebrateLesson ? celebrationPart('fill') : none;
  const tile = (order: number) => celebrateLesson ? celebrationPart('rise', order) : none;
  const skill = receipt.recognition?.skills[0] ?? null;
  const reward = REGISTERS[register].reward;
  const heading = REGISTERS[register].tone.exclamations > 0 ? t.done : t.plainDone;
  const recognition = (value: string) => reward.recognition === 'worked-out' ? t.figured(value)
    : reward.recognition === 'showed' ? t.showed(value) : reward.recognition === 'built' ? t.built(value) : t.skillOnly(value);
  const xpTile = (order: number) => <div className={`lf-result-stat${tile(order).className ? ` ${tile(order).className}` : ''}`} style={tile(order).style} key="xp"><strong data-copy-role="data">
    <CountUp value={receipt.awarded_xp} format={(value) => `+${number.format(value)}`} /></strong><span data-copy-role="body">{t.xp}</span></div>;
  const accuracyTile = (order: number) => <div className={`lf-result-stat${tile(order).className ? ` ${tile(order).className}` : ''}`} style={tile(order).style} key="accuracy"><strong data-copy-role="data">
    <CountUp value={accuracy} format={(value) => `${value}%`} /></strong><span data-copy-role="body">{t.accuracy}</span></div>;
  const timeTile = (order: number) => <div className={`lf-result-stat${tile(order).className ? ` ${tile(order).className}` : ''}`} style={tile(order).style} key="time"><strong data-copy-role="data">{duration}</strong><span data-copy-role="body">{t.time}</span></div>;
  // A tally that leads for young learners; plain data after capability for teens and adults.
  const tiles = (reward.currency === 'data' ? [accuracyTile, timeTile, xpTile] : [xpTile, accuracyTile, timeTile]).map((render, index) => render(index + 1));
  // B.24: the learner's own plan for today, met by this lesson: a plain status, never a celebration.
  const paceDone = receipt.pace ? receipt.pace.goal_met && receipt.pace.passed_today === receipt.pace.goal : false;
  // A first completion has no earlier best to compare with.
  const showComparison = !receipt.replay || receipt.replay.kind !== 'first' || keptBest;
  const streakLine = celebrateStreak && milestone && receipt.streak ? <Celebration milestone={milestone} momentId={receipt.completion_id}>
    <p className={`lf-result-streak ${celebrationPart('pop').className}`} data-copy-role="body" data-celebrate={milestone}>
      <img src="/rebuild/art/streak-flame.svg" alt="" className="lf-result-streak-mark" />{t.streak(receipt.streak.days)}</p>
  </Celebration> : null;
  // W2L.3 (OD-7, B.20): the course and badge milestones Core named for this completion. One moment on the result:
  // the badge when one was earned (it is the course's), otherwise the finished course; nothing when Core named neither.
  const celebrateBadge = mayCelebrate(receipt.celebrations, 'badge-earned');
  const celebrateCourse = mayCelebrate(receipt.celebrations, 'course-complete');
  const lessonCopy = learnCopy[locale].lesson;
  const courseMoment = celebrateBadge || celebrateCourse
    ? <Celebration milestone={celebrateBadge ? 'badge-earned' : 'course-complete'} momentId={`${receipt.completion_id}:course`}>
      <p className={`lf-result-course ${celebrationPart('pop').className}`} data-copy-role="body" data-celebrate={celebrateBadge ? 'badge-earned' : 'course-complete'}>
        {celebrateBadge ? <CourseBadge slug={courseSlug} size="sm" /> : null}
        {celebrateBadge ? lessonCopy.badgeEarned : lessonCopy.courseComplete}</p>
    </Celebration> : null;
  const inner = <div className="lf-result-inner">
      {fixture ? <p className="lf-result-preview-label" data-copy-role="body">{t.preview}</p> : null}
      <div className="lf-result-hero">
        {celebrateLesson ? <LessonConfetti medal={reward.medal} /> : null}
        {reward.medal ? <img src="/rebuild/art/lesson-medal.svg" alt="" className={`lf-result-medal${pop.className ? ` ${pop.className}` : ''}`} {...(celebrateLesson ? { 'data-celebrate': 'lesson-complete' } : {})} /> : null}
        <h1 data-copy-role="heading">{heading}</h1>
        {/* B.20: the skill behind the XP leads; the first-try count lives in the accuracy tile. B.23: framed per register. */}
        {skill ? <p className="lf-result-figured" data-copy-role="body">{recognition(skill)}</p>
          : keptBest ? null
            : <p data-copy-role="body">{t.score(receipt.first_try_correct, receipt.graded_count)}</p>}
        {courseMoment}
        {streakLine}
      </div>
      <div className="lf-result-sheet">
        <div className="lf-result-stats" aria-label={heading}>{tiles}</div>
        {receipt.judgment && receipt.judgment.assessed > 0 ? <p className="lf-result-judgment">
          <strong data-copy-role="data">{receipt.judgment.sound}/{receipt.judgment.assessed}</strong>
          <span data-copy-role="body">{t.reasoned}</span></p> : null}
        {showComparison ? <section className={`lf-result-compare${tile(4).className ? ` ${tile(4).className}` : ''}`} style={tile(4).style} aria-label={t.comparison}>
          {/* B.5: a lower run leads with the kept best; the notice itself names the comparison. */}
          {keptBest ? <p className="lf-result-saved-best" data-copy-role="body">{t.savedBest(receipt.previous_best_percent)}</p>
            : <div className="lf-result-compare-head"><h2 data-copy-role="heading">{t.comparison}</h2>
              {newBest ? <span className="lf-result-best-note" data-copy-role="body">{t.newBest}</span> : null}</div>}
          {([{ label: t.today, value: accuracy }, { label: t.best, value: best }] as const).map(({ label, value }) =>
            <div className="lf-result-row" key={label}><span data-copy-role="body">{label}</span>
              <div className="lf-result-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
                <span className={fill.className || undefined} style={{ inlineSize: `${value}%` }} /></div><strong data-copy-role="data">{value}%</strong></div>)}
        </section> : null}
        {paceDone ? <div className="lf-result-pace"><InlineNotice tone="success" live>{t.paceDone}</InlineNotice></div> : null}
        <Button variant="accent" breathing onClick={onContinue}>{t.continue}</Button>
      </div>
    </div>;
  return <main className={rootClass} {...host} data-surface="app" data-screen={fixture ? 'result-preview' : 'result'}
    data-register={register} data-age-band={REGISTERS[register].copyBand}>
    {celebrateLesson ? <Celebration milestone="lesson-complete" momentId={receipt.completion_id}>{inner}</Celebration> : inner}
  </main>;
}
