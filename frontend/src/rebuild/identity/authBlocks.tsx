import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Button, InlineNotice, TextField } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import { follow, type Navigate } from '../site/blocks';
import './identity.css';

/*
 * Shared pieces of the rebuilt sign-in, recovery and verification screens (A1–A7,
 * W2 Lane 1, checkpoint W2S.2). They render inside the sign-in shell's one
 * column (app-shell AuthLayout, the design system's AuthShell): the shell owns
 * the root, the <main>, the skip link, the document title and language; a
 * screen owns exactly one <h1>. Everything comes from the shared controls (02
 * rule 23); nothing here reads the session, the router or the API: the route
 * bridges in routes/auth/ do, and pass state and callbacks in.
 */

export type IdentityCopy = (typeof rebuildNamespaceCopy)['en-US']['site'];

/** Lane 1's strings (rebuild-site.json) in a locale. */
export function identityCopy(locale: Locale): IdentityCopy {
  return rebuildNamespaceCopy[locale].site;
}

export type { Navigate };
export { follow };

/**
 * The words for an error code Core answered (the `{ data, error }` envelope's
 * `error.code`). Codes a screen can meet are listed; anything else, a network
 * failure included, is "something went wrong on our side", never a raw code.
 */
export function authErrorText(copy: IdentityCopy, code: string): string {
  const errors = copy.authCommon.errors as Record<string, string>;
  return errors[code] ?? errors.INTERNAL!;
}

/** The screen's heading and its one supporting line. */
export function AuthIntro({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return <header className="lf-auth-intro">
    <h1 data-copy-role="heading">{title}</h1>
    {lead ? <p className="lf-auth-lead" data-copy-role="body">{lead}</p> : null}
    {children}
  </header>;
}

/** "New here? Create account": a prompt and one link to the other sign-in screen. */
export function AuthSwitch({ prompt, label, href, onNavigate }: { prompt?: string; label: string; href: string; onNavigate?: Navigate }) {
  return <p className="lf-auth-switch">
    {prompt ? <span data-copy-role="body">{prompt}</span> : null}
    <a className="lf-auth-link" href={href} data-copy-role="action" onClick={follow(href, onNavigate)}>{label}</a>
  </p>;
}

/** A text link that navigates inside the app (the forgotten-password link, the way back). */
export function AuthLink({ label, href, onNavigate, ...data }: { label: string; href: string; onNavigate?: Navigate } & { [attribute: `data-${string}`]: string }) {
  return <a {...data} className="lf-auth-link" href={href} data-copy-role="action" onClick={follow(href, onNavigate)}>{label}</a>;
}

/**
 * Google sign-in (A1, A2), shown only while Core reports the provider enabled.
 * A plain secondary button with the words only: 07 forbids a third-party brand
 * likeness in our interface (the Google "G" is an owner question). A failed
 * start is said beside it, and the button can be pressed again.
 */
export interface GoogleState { available: boolean; pending: boolean; failed: boolean; onStart: () => void }

export function GoogleSignIn({ copy, google }: { copy: IdentityCopy; google: GoogleState }) {
  if (!google.available) return null;
  return <div className="lf-auth-social" data-auth-google>
    <Button size="lg" pending={google.pending} pendingLabel={copy.authLogin.submitting} onClick={google.onStart} data-auth="google">{copy.authCommon.google}</Button>
    {google.failed ? <InlineNotice tone="error" live>{copy.authCommon.googleFailed}</InlineNotice> : null}
    <p className="lf-auth-or" data-copy-role="body"><span>{copy.authCommon.or}</span></p>
  </div>;
}

/** A password field with its reveal control and the 8-character rule, said before and after (A2, A4, A6). */
export function PasswordField({ copy, label, value, onChange, autoComplete, showRule = false, ruleHelp = true, disabled }: {
  copy: IdentityCopy; label: string; value: string; onChange: (value: string) => void; autoComplete: 'current-password' | 'new-password';
  showRule?: boolean;
  /** Say the rule before typing too; off where the first view has no room (the rule is still said as soon as it is broken). */
  ruleHelp?: boolean; disabled?: boolean;
}) {
  const short = showRule && value.length > 0 && value.length < 8;
  return <TextField type="password" label={label} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete}
    required minLength={showRule ? 8 : undefined} disabled={disabled} help={showRule && ruleHelp ? copy.authCommon.passwordHelp : undefined}
    error={short ? copy.authCommon.passwordShort : undefined} revealLabels={{ show: copy.authCommon.showPassword, hide: copy.authCommon.hidePassword }} />;
}

/** A date typed as day, month and year (the SPEC's "day/month/year"), each its own labelled number. */
export interface DateParts { day: string; month: string; year: string }
export const EMPTY_DATE: DateParts = { day: '', month: '', year: '' };

/** `YYYY-MM-DD` for a real calendar date, or null (31 February is not a date). */
export function isoDate({ day, month, year }: DateParts): string | null {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  const d = Number(day), m = Number(month), y = Number(year);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function DateFields({ copy, legend, help, value, onChange, error, disabled }: {
  copy: IdentityCopy; legend: string; help?: string; value: DateParts; onChange: (value: DateParts) => void; error?: string; disabled?: boolean;
}) {
  const field = (key: keyof DateParts, label: string, digits: number) => <TextField label={label} inputMode="numeric" autoComplete="off"
    pattern={`[0-9]{${key === 'year' ? 4 : 1},${digits}}`} maxLength={digits} value={value[key]} disabled={disabled} data-date-part={key}
    onChange={(event) => onChange({ ...value, [key]: event.target.value.replace(/\D/g, '') })} />;
  return <fieldset className="lf-date-fields" aria-invalid={error ? true : undefined}>
    <legend className="lf-input-label" data-copy-role="body">{legend}</legend>
    {help ? <p className="lf-input-help" data-copy-role="body">{help}</p> : null}
    <div className="lf-date-fields-row">
      {field('day', copy.authCommon.day, 2)}
      {field('month', copy.authCommon.month, 2)}
      {field('year', copy.authCommon.year, 4)}
    </div>
    {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
  </fieldset>;
}

/** A form that never reloads the page and reports the whole attempt once. */
export function AuthForm({ onSubmit, children, busy, ...data }: { onSubmit: () => void; children: ReactNode; busy?: boolean } & { [attribute: `data-${string}`]: string }) {
  return <form {...data} className="lf-auth-form" noValidate aria-busy={busy || undefined}
    onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit(); }}>{children}</form>;
}

/**
 * The server's answer to a submit, announced once where it happened: a new
 * error moves no focus (the person keeps their place, 02 rule 13) and is read
 * out by the live notice.
 */
export function AuthError({ copy, code }: { copy: IdentityCopy; code: string | null }) {
  return code ? <InlineNotice tone="error" live>{authErrorText(copy, code)}</InlineNotice> : null;
}

/**
 * A screen that is one outcome (sent, done, expired, refused). When it replaces
 * a form in place after a submit (`focusOnMount`), its heading takes focus, so
 * a keyboard or screen-reader user starts on the news instead of on a control
 * that no longer exists. Reached on arrival (an expired link opened fresh), it
 * moves nothing: the shell's skip link stays the first stop.
 */
export function AuthOutcome({ title, lead, children, screen, focusOnMount = false }: {
  title: string; lead?: ReactNode; children?: ReactNode; screen: string; focusOnMount?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (focusOnMount) heading.current?.focus(); }, [focusOnMount]);
  return <div className="lf-auth-page" data-screen={screen} data-surface="app">
    <header className="lf-auth-intro">
      <h1 ref={heading} tabIndex={-1} data-copy-role="heading">{title}</h1>
      {lead}
    </header>
    {children}
  </div>;
}
