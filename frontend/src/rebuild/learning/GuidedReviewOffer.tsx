import { useEffect, useId, useRef } from 'react';
import { z } from 'zod';
import type { Locale } from '../design/copyBudget';
import { Button } from '../design/controls';
import { REGISTERS, type LearnerRegister } from '../design/learnerRegisterPolicy.generated';
import { MENTOR_NAMES } from './motivation';
import '../design/tokens.css';
import '../design/system.css';
import './register.css';

/*
 * B.26 and OD-1 (S05.3f) — the guided-review offer.
 *
 * A wrong answer costs nothing (no lives, no counter, no lock). After three
 * consecutive misses on the same skill, Core's grade response carries an
 * offer, and the learner's own Mentor makes it here: review that skill
 * together, or keep going. Declining is neutral (no guilt, no second ask) and
 * nothing about the lesson changes either way. The offer names the skill,
 * never the learner (Appendix B §2.8), and is worded in the learner's
 * register (B.23): warm and literal for the youngest, direct for teens.
 *
 * Not a dialog and not a lock: a sheet anchored to the viewport (rule 12)
 * that leaves the lesson usable behind it; Escape declines. It sits on the
 * neutral surface and never uses the error hue: it is an offer, not an error.
 * Presentation only: the host owns transport and navigation.
 */

export const guidedReviewOfferSchema = z.object({
  skill_key: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  skill: z.string().min(1).max(80).nullable(),
  misses: z.number().int().min(3).max(12),
  character: z.enum(['rho', 'zara', 'liruf', 'dina']),
}).strict();
export type GuidedReviewOfferValue = z.infer<typeof guidedReviewOfferSchema>;

type Voice = 'warm' | 'direct';
type Copy = { line: (skill: string | null) => string; review: (name: string) => string; keepGoing: string };

export const guidedReviewCopy: Record<Locale, Record<Voice, Copy>> = {
  'en-US': {
    warm: { line: (skill) => `Want to practice ${skill ?? 'this'} with me?`, review: (name) => `Practice with ${name}`, keepGoing: 'Keep going' },
    direct: { line: (skill) => `Want a quick review of ${skill ?? 'this skill'}?`, review: (name) => `Review with ${name}`, keepGoing: 'Keep going' },
  },
  'es-MX': {
    warm: { line: (skill) => `¿Practicamos ${skill ?? 'esto'} juntos?`, review: (name) => `Practicar con ${name}`, keepGoing: 'Seguir aquí' },
    direct: { line: (skill) => `¿Un repaso rápido de ${skill ?? 'esta habilidad'}?`, review: (name) => `Repasar con ${name}`, keepGoing: 'Seguir aquí' },
  },
  'pt-BR': {
    warm: { line: (skill) => `Vamos praticar ${skill ?? 'isso'} juntos?`, review: (name) => `Praticar com ${name}`, keepGoing: 'Continuar aqui' },
    direct: { line: (skill) => `Quer revisar ${skill ?? 'essa habilidade'} rapidinho?`, review: (name) => `Revisar com ${name}`, keepGoing: 'Continuar aqui' },
  },
};

/** The young register speaks warmly; from 10 the Mentor is brief and direct (B.23). */
export function guidedReviewVoice(register: LearnerRegister): Voice {
  return REGISTERS[register].mentor.presence === 'high' ? 'warm' : 'direct';
}

export function GuidedReviewOffer({ offer, locale, register, dark, onReview, onDecline, fixture = false }: {
  offer: GuidedReviewOfferValue;
  locale: Locale;
  register: LearnerRegister;
  dark: boolean;
  onReview: (skillKey: string) => void;
  onDecline: () => void;
  fixture?: boolean;
}) {
  const t = guidedReviewCopy[locale][guidedReviewVoice(register)];
  const name = MENTOR_NAMES[offer.character];
  // The topic title reads inside a sentence here ("practice saving toward a goal").
  const skill = offer.skill ? offer.skill.charAt(0).toLocaleLowerCase(locale) + offer.skill.slice(1) : null;
  const titleId = useId();
  const decline = useRef(onDecline);
  decline.current = onDecline;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') decline.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return <section className="lf-rebuild lf-guided-review" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-screen={fixture ? 'guided-review-preview' : 'guided-review'} data-age-band={REGISTERS[register].copyBand}
    data-register={register} aria-labelledby={titleId}>
    <div className="lf-guided-review-inner">
      <h2 id={titleId} data-copy-role="data">{name}</h2>
      <p data-copy-role="mentor" aria-live="polite">{t.line(skill)}</p>
      <div className="lf-guided-review-actions">
        <Button variant="accent" onClick={() => onReview(offer.skill_key)}>{t.review(name)}</Button>
        <Button onClick={onDecline}>{t.keepGoing}</Button>
      </div>
    </div>
  </section>;
}
