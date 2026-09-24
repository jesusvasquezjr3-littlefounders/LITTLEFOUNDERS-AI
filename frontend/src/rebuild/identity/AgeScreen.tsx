import { useState, type FormEvent } from 'react';
import { Button, Copy, Field } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './ageScreen.css';

export interface AgeScreenCopy {
  title: string; help: string; day: string; month: string; year: string;
  continue: string; exit: string; loading: string; saving: string;
  retry: string; unavailable: string; invalid: string;
}

export function AgeScreen({ copy, locale, dark, state, error, onSubmit, onRetry, onExit }: {
  copy: AgeScreenCopy; locale: string; dark: boolean;
  state: 'loading' | 'error' | 'form' | 'saving'; error?: 'invalid' | 'unavailable';
  onSubmit: (birthDate: string) => void; onRetry: () => void; onExit: () => void;
}) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(`${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }
  return <div className="lf-rebuild" data-theme={dark ? 'dark' : 'light'} lang={locale}>
    <main className="lf-age-screen" data-surface="app" data-screen="age-screen" data-age-band="6-9">
      <Copy role="heading" as="h1">{copy.title}</Copy>
      {state === 'loading' ? <div role="status"><Copy role="body">{copy.loading}</Copy></div> :
        state === 'error' ? <>
          <div role="alert"><Copy role="body">{copy.unavailable}</Copy></div>
          <Button variant="accent" onClick={onRetry}>{copy.retry}</Button>
        </> : <form onSubmit={submit} className="lf-age-form" aria-busy={state === 'saving'}>
          <Copy role="body">{copy.help}</Copy>
          <div className="lf-age-date">
            <Field label={copy.day} aria-label={copy.day} inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} required value={day} onChange={e => setDay(e.target.value)} disabled={state === 'saving'} />
            <Field label={copy.month} aria-label={copy.month} inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} required value={month} onChange={e => setMonth(e.target.value)} disabled={state === 'saving'} />
            <Field label={copy.year} aria-label={copy.year} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required value={year} onChange={e => setYear(e.target.value)} disabled={state === 'saving'} />
          </div>
          {error && <div role="alert"><Copy role="body">{copy[error]}</Copy></div>}
          <Button type="submit" variant="accent" disabled={state === 'saving'}>{state === 'saving' ? copy.saving : copy.continue}</Button>
        </form>}
      <Button onClick={onExit}>{copy.exit}</Button>
    </main>
  </div>;
}
