import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Copy, InlineNotice, LoadingState, SingleStateScreen, TextField } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import { ageFromParts } from './ageFromParts';
import '../design/tokens.css';
import '../design/system.css';
import './ageScreen.css';

/*
 * The mandatory age question (A.3, A.4; S01.2): the route guard shows it before
 * any product content, for every account Core has not yet screened (a first
 * Google sign-in included), and never again once Core has a declaration.
 *
 * Two frames, found out from where it was mounted (W2S.2). As the whole screen
 * (the guard wraps the app shells, onboarding and the full-screen layers) it is
 * a single-state screen (02 §4.5, rule 15): one hue, its own <main>, skip link,
 * title and language. Inside a shell that already has a <main> (the guard sits
 * inside the sign-in shell on /verify-parent) it is that page's content only,
 * so the page keeps one <main>. The question itself is budgeted for the
 * youngest band: the person answering may be a child.
 */

export interface AgeScreenCopy {
  title: string; help: string; day: string; month: string; year: string;
  continue: string; exit: string; loading: string; saving: string;
  retry: string; unavailable: string; invalid: string;
  /** E.4: the answer is kept once; no one changes it from their own account. */
  locked: string;
  /** S-04 (OD-28): shown once the date reads 13 to 17, before the month is sent. */
  teenMonth: string;
}

type AgeScreenProps = {
  copy: AgeScreenCopy; locale: string; dark: boolean;
  state: 'loading' | 'error' | 'form' | 'saving'; error?: 'invalid' | 'unavailable';
  /** `birthMonth` (`YYYY-MM`) only for a date that reads 13 to 17, after the screen said what it is kept for. */
  onSubmit: (birthDate: string, birthMonth?: string) => void; onRetry: () => void; onExit: () => void;
};

function AgeQuestion({ copy, state, error, onSubmit, onRetry, onExit }: Omit<AgeScreenProps, 'locale' | 'dark'>) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const age = ageFromParts(day, month, year);
  // S-04: a 13-17 date keeps its month and year so the account moves to adult at 18 (never the day).
  const teen = age !== null && age >= 13 && age <= 17;
  function submit(event: FormEvent) {
    event.preventDefault();
    const birthMonth = `${year.padStart(4, '0')}-${month.padStart(2, '0')}`;
    const birthDate = `${birthMonth}-${day.padStart(2, '0')}`;
    if (teen) onSubmit(birthDate, birthMonth); else onSubmit(birthDate);
  }
  return <div className="lf-age-screen" data-surface="app" data-screen="age-screen" data-age-band="6-9">
    <Copy role="heading" as="h1">{copy.title}</Copy>
    {state === 'loading' ? <LoadingState label={copy.loading} lines={2} /> :
      state === 'error' ? <>
        <InlineNotice tone="error" live>{copy.unavailable}</InlineNotice>
        <Button variant="accent" onClick={onRetry}>{copy.retry}</Button>
      </> : <form onSubmit={submit} className="lf-age-form" aria-busy={state === 'saving'}>
        <Copy role="body">{copy.help}</Copy>
        <Copy role="body">{copy.locked}</Copy>
        <div className="lf-age-date">
          <TextField label={copy.day} inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} required autoComplete="off" value={day} onChange={e => setDay(e.target.value)} disabled={state === 'saving'} />
          <TextField label={copy.month} inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} required autoComplete="off" value={month} onChange={e => setMonth(e.target.value)} disabled={state === 'saving'} />
          <TextField label={copy.year} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="off" value={year} onChange={e => setYear(e.target.value)} disabled={state === 'saving'} />
        </div>
        {teen ? <Copy role="body">{copy.teenMonth}</Copy> : null}
        {error && <InlineNotice tone="error" live>{copy[error]}</InlineNotice>}
        <Button type="submit" variant="accent" pending={state === 'saving'} pendingLabel={copy.saving}>{copy.continue}</Button>
      </form>}
    <Button onClick={onExit}>{copy.exit}</Button>
  </div>;
}

export function AgeScreen({ locale, dark, ...question }: AgeScreenProps) {
  const probe = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<'embedded' | 'standalone' | null>(null);
  useLayoutEffect(() => { setFrame(probe.current?.parentElement?.closest('[data-shell] main') ? 'embedded' : 'standalone'); }, []);
  const shellLocale: Locale = locale === 'es-MX' || locale === 'pt-BR' ? locale : 'en-US';
  return <div ref={probe} className={`lf-rebuild${frame === 'embedded' ? ' lf-age-root--embedded' : ''}`} data-theme={dark ? 'dark' : 'light'} lang={locale}>
    {frame === 'embedded' ? <AgeQuestion {...question} /> : frame === 'standalone'
      ? <SingleStateScreen appName="LittleFounders" pageTitle={question.copy.title} routeKey="age-screen" locale={shellLocale} hue="primary"
        labels={{ skip: rebuildNamespaceCopy[shellLocale].core.appShell.skip }}>
        <div className="lf-age-panel"><AgeQuestion {...question} /></div>
      </SingleStateScreen> : null}
  </div>;
}
