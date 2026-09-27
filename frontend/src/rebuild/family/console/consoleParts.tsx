import type { MouseEvent, ReactNode } from 'react';
import { ButtonLink, ErrorState, Glyph, LoadingState, type ButtonVariant } from '../../design/controls';
import type en from '../../../i18n/en-US/rebuild-family.json';

/*
 * Shared pieces of the rebuilt Family console (W2F.1): the copy types of its
 * namespace groups, the placeholder filler, a link that stays in the
 * single-page app, and the page states every console screen can show
 * (loading, a failure or no connection with a retry, and a refusal that
 * explains itself and offers the way back).
 */

export type ConsoleCopy = typeof en.familyConsole;
export type ChildAccountCopy = typeof en.familyChildAccount;
export type ChildConsentCopy = typeof en.familyChildConsent;
export type ChildProgressCopy = typeof en.familyChildProgress;
export type ChildMentorCopy = typeof en.familyChildMentor;
export type MemoryNotesCopy = typeof en.familyMemoryNotes;
export type ConsoleLocale = 'en-US' | 'es-MX' | 'pt-BR';

export const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => key in values ? String(values[key]) : match);

export const asLocale = (locale: string): ConsoleLocale => locale === 'es-MX' || locale === 'pt-BR' ? locale : 'en-US';

/** A real link (it goes somewhere) that navigates inside the app on a plain click and opens normally on a modified one. */
export function ConsoleLink({ href, onNavigate, variant = 'secondary', size, children }: {
  href: string; onNavigate: (href: string) => void; variant?: ButtonVariant; size?: 'sm' | 'md'; children: ReactNode;
}) {
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(href);
  };
  return <ButtonLink href={href} variant={variant} size={size} onClick={click}>{children}</ButtonLink>;
}

export type PageFailure = { code: string };

/** A screen that could not load: offline says so, anything else is ours to fix; both retry. */
export function FailureState({ failure, copy, retrying, onRetry }: {
  failure: PageFailure;
  copy: { failedTitle: string; failedBody: string; offlineBody: string; retry: string; retrying: string };
  retrying: boolean;
  onRetry: () => void;
}) {
  return <ErrorState heading={copy.failedTitle} body={failure.code === 'NETWORK' ? copy.offlineBody : copy.failedBody}
    retryLabel={copy.retry} retryingLabel={copy.retrying} retrying={retrying} onRetry={onRetry} />;
}

/** The way back to the Family console: the back glyph and the page's name (the glyph is decorative; the word carries it). */
export function BackLink({ href, label, onNavigate }: { href: string; label: string; onNavigate: (href: string) => void }) {
  return <div className="lf-console-back"><ConsoleLink href={href} onNavigate={onNavigate} size="sm"><Glyph name="back" />{label}</ConsoleLink></div>;
}

export function PageLoading({ label }: { label: string }) {
  return <LoadingState label={label} lines={4} />;
}

/** Core refused this child for this Tutor (no verified guardian link): say so and offer the way back. */
export const isRefusal = (code: string) => code === 'FORBIDDEN' || code === 'VALIDATION_ERROR';
