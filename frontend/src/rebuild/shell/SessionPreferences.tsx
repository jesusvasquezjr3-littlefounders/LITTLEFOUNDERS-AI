import { useId } from 'react';
import { Button, SegmentedControl } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './sessionPreferences.css';

/*
 * The signed-in app's own session controls (W2 Lane 0): the mode and signing
 * out. The legacy app shell carried both in its sidebar and top bar; the
 * rebuilt learner and console shells have no slot for them, so they live in
 * Settings, where the language already is. Presentation only: the route
 * supplies the current choice and the actions.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';

export interface SessionPreferencesCopy {
  title: string;
  theme: string;
  themeAuto: string;
  themeLight: string;
  themeDark: string;
  signOut: string;
  signingOut: string;
}

export function SessionPreferences({ copy, locale, dark, choice, onChoice, onSignOut, signingOut }: {
  copy: SessionPreferencesCopy;
  locale: string;
  dark: boolean;
  choice: ThemeChoice;
  onChoice: (choice: ThemeChoice) => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const headingId = useId();
  return <section className="lf-rebuild lf-session-preferences" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={headingId}>
    <h2 id={headingId} data-copy-role="heading">{copy.title}</h2>
    <SegmentedControl<ThemeChoice> legend={copy.theme} name={`${headingId}-theme`} value={choice} onValueChange={onChoice}
      options={[{ value: 'auto', label: copy.themeAuto }, { value: 'light', label: copy.themeLight }, { value: 'dark', label: copy.themeDark }]} />
    <div className="lf-session-preferences-actions">
      <Button onClick={onSignOut} pending={signingOut} pendingLabel={copy.signingOut}>{copy.signOut}</Button>
    </div>
  </section>;
}
