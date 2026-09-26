import { useId, useState } from 'react';
import type { Locale } from '../design/copyBudget';
import { Button, InlineNotice } from '../design/controls';
import { REGISTERS } from '../design/learnerRegisterPolicy.generated';
import '../design/tokens.css';
import '../design/system.css';
import './register.css';

/*
 * B.23 (S05.3f) — the graduation moment. Around ages 10 to 12, children begin
 * discounting simplistic praise (Appendix B §2.9); at 13 the register turns
 * teen. When Core says a learner has just moved into an older register, this
 * card says, once, what changes for them: the Mentor steps back, feedback
 * names the exact skill, the choices get bigger. It is written in the NEW
 * register's words and budget.
 *
 * Information, never a celebration: the graduation is not on OD-7's closed
 * milestone list, so there is no motion, no medal and no reward here. One
 * action records that the learner saw it; the host then removes the card.
 * Presentation only: the host owns transport.
 */

type Into = 'transition' | 'teen';
type Copy = { heading: string; body: string; changes: [string, string]; action: string; failed: string };

export const registerGraduationCopy: Record<Locale, Record<Into, Copy>> = {
  'en-US': {
    transition: { heading: 'A new stage for you', body: 'Your Mentor now gives you more room.',
      changes: ['Feedback names the exact skill.', 'You choose how to practice.'], action: 'Got it', failed: 'Could not save. Try again.' },
    teen: { heading: 'A new stage for you', body: 'Everything here is now more direct.',
      changes: ['Your Mentor steps back.', 'You set your path and pace.'], action: 'Got it', failed: 'Could not save. Try again.' },
  },
  'es-MX': {
    transition: { heading: 'Una nueva etapa para ti', body: 'Tu Mentor ahora te da más espacio.',
      changes: ['Te decimos la habilidad exacta.', 'Tú eliges cómo practicar.'], action: 'Entendido', failed: 'No se pudo guardar. Inténtalo de nuevo.' },
    teen: { heading: 'Una nueva etapa para ti', body: 'Todo aquí ahora es más directo.',
      changes: ['Tu Mentor da un paso atrás.', 'Tú decides tu camino y tu ritmo.'], action: 'Entendido', failed: 'No se pudo guardar. Inténtalo de nuevo.' },
  },
  'pt-BR': {
    transition: { heading: 'Uma nova etapa para você', body: 'Seu Mentor agora te dá mais espaço.',
      changes: ['Dizemos a habilidade exata.', 'Você escolhe como praticar.'], action: 'Entendi', failed: 'Não foi possível salvar. Tente de novo.' },
    teen: { heading: 'Uma nova etapa para você', body: 'Tudo aqui agora é mais direto.',
      changes: ['Seu Mentor dá um passo atrás.', 'Você define seu caminho e seu ritmo.'], action: 'Entendi', failed: 'Não foi possível salvar. Tente de novo.' },
  },
};

export function RegisterGraduationView({ into, locale, dark, onAcknowledge, fixture = false }: {
  into: Into;
  locale: Locale;
  dark: boolean;
  /** Resolves true once Core recorded it. */
  onAcknowledge: () => Promise<boolean>;
  fixture?: boolean;
}) {
  const t = registerGraduationCopy[locale][into];
  const headingId = useId();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const acknowledge = () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    void onAcknowledge().then((saved) => { if (!saved) setFailed(true); }).catch(() => setFailed(true)).finally(() => setPending(false));
  };
  return <section className="lf-rebuild lf-graduation" data-theme={dark ? 'dark' : 'light'} lang={locale} data-surface="app"
    data-screen={fixture ? 'register-graduation-preview' : 'register-graduation'} data-age-band={REGISTERS[into].copyBand}
    data-register={into} aria-labelledby={headingId}>
    <h2 id={headingId} data-copy-role="heading">{t.heading}</h2>
    <p data-copy-role="body">{t.body}</p>
    <ul className="lf-graduation-changes">
      {t.changes.map((change) => <li key={change} data-copy-role="body">{change}</li>)}
    </ul>
    {/* A polite, neutral notice: a save that failed is never the learner's fault and never the error hue here (B.26). */}
    {failed ? <div className="lf-graduation-failed"><InlineNotice tone="info" live>{t.failed}</InlineNotice></div> : null}
    <Button variant="accent" onClick={acknowledge} aria-disabled={pending || undefined}>{t.action}</Button>
  </section>;
}
