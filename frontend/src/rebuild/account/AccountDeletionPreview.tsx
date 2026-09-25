import en from '../../i18n/en-US/rebuild.json';
import es from '../../i18n/es-MX/rebuild.json';
import pt from '../../i18n/pt-BR/rebuild.json';
import type { Locale } from '../design/copyBudget';
import { AccountDeletion, type AccountDeletionView } from './AccountDeletion';

/*
 * Fixture-only preview of the E.6 deletion surface for the real-Chrome matrix
 * (scripts/verify-rebuild-account-deletion.mjs): every state at a chosen
 * layout. No transport, no session, no spend.
 */

const SCHEDULED_FOR = '2026-10-08T21:00:00.000Z';

export const ACCOUNT_DELETION_PREVIEW_STATES: Record<string, AccountDeletionView> = {
  intro: { kind: 'ready', step: 'intro', immediate: false, graceDays: 14, reauth: 'password', pausedChildren: 0, submitting: false, error: null },
  parent: { kind: 'ready', step: 'confirm', immediate: false, graceDays: 14, reauth: 'password', pausedChildren: 2, submitting: false, error: null },
  confirm: { kind: 'ready', step: 'confirm', immediate: false, graceDays: 14, reauth: 'password', pausedChildren: 1, submitting: false, error: null },
  wrongPassword: { kind: 'ready', step: 'confirm', immediate: false, graceDays: 14, reauth: 'password', pausedChildren: 0, submitting: false, error: 'password' },
  reauth: { kind: 'ready', step: 'confirm', immediate: false, graceDays: 14, reauth: 'recent_sign_in', pausedChildren: 0, submitting: false, error: 'reauth' },
  guest: { kind: 'ready', step: 'confirm', immediate: true, graceDays: 0, reauth: 'none', pausedChildren: 0, submitting: false, error: null },
  submitting: { kind: 'ready', step: 'confirm', immediate: false, graceDays: 14, reauth: 'password', pausedChildren: 0, submitting: true, error: null },
  scheduled: { kind: 'scheduled', status: 'pending', scheduledFor: SCHEDULED_FOR, signedOut: false, keeping: false, keepFailed: false },
  held: { kind: 'scheduled', status: 'held', scheduledFor: SCHEDULED_FOR, signedOut: false, keeping: false, keepFailed: true },
  signedOut: { kind: 'scheduled', status: 'pending', scheduledFor: SCHEDULED_FOR, signedOut: true, keeping: false, keepFailed: false },
  processing: { kind: 'scheduled', status: 'processing', scheduledFor: SCHEDULED_FOR, signedOut: false, keeping: false, keepFailed: false },
  kept: { kind: 'kept' },
  deleted: { kind: 'deleted', finishing: true },
  kid: { kind: 'blocked', reason: 'kid' },
  staff: { kind: 'blocked', reason: 'staff' },
  loading: { kind: 'loading' },
  unavailable: { kind: 'unavailable' },
};

export function AccountDeletionPreview({ locale, theme, state, layout }: {
  locale: Locale;
  theme: 'light' | 'dark';
  state: string | null;
  layout: string | null;
}) {
  const t = locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
  const view = ACCOUNT_DELETION_PREVIEW_STATES[state ?? ''] ?? ACCOUNT_DELETION_PREVIEW_STATES.intro!;
  const noop = () => undefined;
  const screen = layout === 'screen';
  return <div className="lf-rebuild" data-screen="account-deletion-preview" data-theme={theme} lang={locale}>
    <AccountDeletion copy={t.accountDeletion} locale={locale} dark={theme === 'dark'} view={view} layout={screen ? 'screen' : 'card'}
      onStart={noop} onBack={noop} onConfirm={noop} onKeep={noop} onRetry={noop} onSignIn={noop}
      onSignOut={screen ? noop : undefined} onContinue={screen ? noop : undefined} />
  </div>;
}
