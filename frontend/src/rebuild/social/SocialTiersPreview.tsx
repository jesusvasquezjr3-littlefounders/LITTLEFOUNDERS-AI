import en from '../../i18n/en-US/rebuild-profile.json';
import es from '../../i18n/es-MX/rebuild-profile.json';
import pt from '../../i18n/pt-BR/rebuild-profile.json';
import type { Locale } from '../design/copyBudget';
import { ManagedConnectionsNote, PrivateProfile, type PrivateRequestState } from './PrivateProfile';
import { TeenConnections } from './TeenConnections';
import { ProfileSafetyNotice } from './ProfileSafetyNotice';

/*
 * Fixture-only preview of the S08.6 surfaces (E.8 private card and teen
 * connections, E.13 safety notice) for the real-Chrome matrix
 * (scripts/verify-rebuild-social-tiers.mjs). No transport, no session, no spend.
 * Fixture names are long on purpose, to prove wrapping at 320 px.
 */

const REQUESTS = [
  { requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', requestedAt: '2026-09-24T10:00:00Z', username: 'omar_valdes_rios', displayName: 'Omar Alejandro Valdés' },
  { requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', requestedAt: '2026-09-23T18:30:00Z', username: 'luz', displayName: 'Luz' },
];
// GAP-FIX-R8 social: a follower without a @username is listed and actionable like any other.
const FOLLOWERS = [
  { userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', username: 'maria_fernanda_22', displayName: 'María Fernanda de la Cruz' },
  { userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', username: null, displayName: 'Patricia Guadalupe Hernández Solís' },
];

export const SOCIAL_TIERS_PREVIEW_STATES = [
  'card', 'cardPending', 'cardFailed', 'cardCooldown', 'cardManaged', 'managedNote',
  'teen', 'teenEmpty', 'teenFailed', 'teenBusy', 'safetySelf', 'safetyKid', 'safetyGuardian',
] as const;

export function SocialTiersPreview({ locale, theme, state }: { locale: Locale; theme: 'light' | 'dark'; state: string | null }) {
  const t = locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
  const dark = theme === 'dark';
  const noop = () => undefined;
  const sent = () => Promise.resolve(true);
  const done = () => Promise.resolve();
  const cardState: Record<string, PrivateRequestState> = { card: 'idle', cardPending: 'pending', cardFailed: 'failed', cardCooldown: 'cooldown', cardManaged: 'idle' };
  let body;
  if (state && state in cardState) {
    body = <PrivateProfile copy={t.privateProfile} locale={locale} dark={dark} username="rio_montes" mode={state === 'cardManaged' ? 'managed' : 'teenRequest'} state={cardState[state]!} onRequest={noop} />;
  } else if (state === 'managedNote') {
    body = <ManagedConnectionsNote copy={t.privateProfile} locale={locale} dark={dark} />;
  } else if (state === 'safetySelf' || state === 'safetyKid' || state === 'safetyGuardian') {
    body = <ProfileSafetyNotice copy={t.profileSafety} locale={locale} dark={dark}
      audience={state === 'safetySelf' ? 'self' : state === 'safetyKid' ? 'kidSelf' : 'guardian'}
      fields={['username', 'displayName']} name="Beto" />;
  } else {
    const empty = state === 'teenEmpty';
    body = <TeenConnections copy={t.teenConnections} reportCopy={t.report} locale={locale} dark={dark}
      requests={empty ? [] : REQUESTS} followers={empty ? [] : FOLLOWERS} loading={false} failed={state === 'teenFailed'}
      busy={state === 'teenBusy'} notice={state === 'teenBusy' ? null : state === 'teen' ? { tone: 'status', text: t.teenConnections.accepted } : null}
      hasMore={!empty} onDecide={noop} onReport={sent} onBlock={done} onRemove={noop} onReportFollower={sent} onBlockFollower={done} onRetry={noop} onMore={noop} />;
  }
  return <div className="lf-rebuild" data-screen="social-tiers-preview" data-theme={theme} lang={locale}>
    <main className="lf-preview" data-surface="app">
      <div className="lf-preview-content">{body}</div>
    </main>
  </div>;
}
