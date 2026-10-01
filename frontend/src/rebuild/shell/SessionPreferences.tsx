import { useId } from 'react';
import { Button, IconButton } from '../design/controls';
import '../design/tokens.css';
import '../design/system.css';
import './sessionPreferences.css';

/*
 * The signed-in app's own session controls (W2 Lane 0): the mode and signing
 * out. Settings uses the same icon-only mode control as the global header.
 * Presentation only: the route supplies the effective mode and the actions.
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

export function SessionPreferences({ copy, locale, dark, onChoice, onSignOut, signingOut }: {
  copy: SessionPreferencesCopy;
  locale: string;
  dark: boolean;
  onChoice: (choice: ThemeChoice) => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const headingId = useId();
  return <section className="lf-rebuild lf-session-preferences" data-theme={dark ? 'dark' : 'light'} lang={locale} aria-labelledby={headingId}>
    <h2 id={headingId} data-copy-role="heading">{copy.title}</h2>
    <IconButton glyph={dark ? 'sun' : 'moon'} label={dark ? copy.themeLight : copy.themeDark}
      onClick={() => onChoice(dark ? 'light' : 'dark')} />
    <div className="lf-session-preferences-actions">
      <Button onClick={onSignOut} pending={signingOut} pendingLabel={copy.signingOut}>{copy.signOut}</Button>
    </div>
  </section>;
}
