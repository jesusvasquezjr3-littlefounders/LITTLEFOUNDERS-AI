import { useState, type FormEvent } from 'react';
import { Button, Copy, InlineNotice, LoadingState, TextField } from '../design/controls';
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
      {state === 'loading' ? <LoadingState label={copy.loading} lines={2} /> :
        state === 'error' ? <>
          <InlineNotice tone="error" live>{copy.unavailable}</InlineNotice>
          <Button variant="accent" onClick={onRetry}>{copy.retry}</Button>
        </> : <form onSubmit={submit} className="lf-age-form" aria-busy={state === 'saving'}>
          <Copy role="body">{copy.help}</Copy>
          <div className="lf-age-date">
            <TextField label={copy.day} inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} required autoComplete="off" value={day} onChange={e => setDay(e.target.value)} disabled={state === 'saving'} />
            <TextField label={copy.month} inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} required autoComplete="off" value={month} onChange={e => setMonth(e.target.value)} disabled={state === 'saving'} />
            <TextField label={copy.year} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="off" value={year} onChange={e => setYear(e.target.value)} disabled={state === 'saving'} />
          </div>
          {error && <InlineNotice tone="error" live>{copy[error]}</InlineNotice>}
          <Button type="submit" variant="accent" pending={state === 'saving'} pendingLabel={copy.saving}>{copy.continue}</Button>
        </form>}
      <Button onClick={onExit}>{copy.exit}</Button>
    </main>
  </div>;
}
