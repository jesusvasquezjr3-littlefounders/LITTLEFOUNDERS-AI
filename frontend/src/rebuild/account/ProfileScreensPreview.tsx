import { useState, type ReactNode } from 'react';
import profileEn from '../../i18n/en-US/rebuild-profile.json';
import profileEs from '../../i18n/es-MX/rebuild-profile.json';
import profilePt from '../../i18n/pt-BR/rebuild-profile.json';
import mentorEn from '../../i18n/en-US/rebuild-mentor.json';
import mentorEs from '../../i18n/es-MX/rebuild-mentor.json';
import mentorPt from '../../i18n/pt-BR/rebuild-mentor.json';
import coreEn from '../../i18n/en-US/rebuild-core.json';
import coreEs from '../../i18n/es-MX/rebuild-core.json';
import corePt from '../../i18n/pt-BR/rebuild-core.json';
import { RebuildProvider } from '../design/controls';
import type { Locale } from '../design/copyBudget';
import { AnalyticsChoice } from '../privacy/AnalyticsChoice';
import { MemorySelfReview } from '../memory/MemorySelfReview';
import { DispositionSummary } from '../mentor/DispositionSummary';
import { SessionPreferences } from '../shell/SessionPreferences';
import { TeenConnections } from '../social/TeenConnections';
import { ProfileSafetyNotice } from '../social/ProfileSafetyNotice';
import { AccountDeletion } from './AccountDeletion';
import { OwnProfile, type OwnProfileData, type OwnProfileView } from './OwnProfile';
import { LookEditor } from './LookEditor';
import { AgeRecordCard } from './AgeRecordCard';
import { BlockedCard, DetailsCard, GuestCard, SettingsPanels, SettingsScreen, SignInCard, type DetailsFormState } from './AccountSettings';
import { resolveLook, type AvatarLook, type CoverId } from './avatar/avatarKit';

/*
 * Fixture-only preview of the profile lane's rebuilt screens (P1-P3), for the
 * audits and design review, on the development-only preview entry
 * (`?screen=own-profile|look-editor|account-settings&state=…`). No transport, no session, no spend. Names are
 * long on purpose where a real name can be long, to prove wrapping at 320 px.
 */

const PROFILE = { 'en-US': profileEn, 'es-MX': profileEs, 'pt-BR': profilePt };
const MENTOR = { 'en-US': mentorEn, 'es-MX': mentorEs, 'pt-BR': mentorPt };
const CORE = { 'en-US': coreEn, 'es-MX': coreEs, 'pt-BR': corePt };
const noop = () => undefined;

const LOOK: AvatarLook = resolveLook({ skinColor: ['d08b5b'], top: ['curly'], hairColor: ['2c1b18'], eyes: ['happy'], eyebrows: ['default'], mouth: ['smile'],
  clothing: ['hoodie'], clothesColor: ['5199e4'], accessories: ['round'], accessoriesProbability: 100 }, 'preview');

const BADGES = [
  { slug: 'financial-education', title: 'Financial Education', completedAt: '2026-08-14T12:00:00Z' },
  { slug: 'first-lemonade-stand', title: 'Your First Lemonade Stand', completedAt: '2026-09-02T12:00:00Z' },
];

function profileData(state: string): OwnProfileData {
  const tier = state === 'kid' ? 'guardian' : state === 'teen' || state === 'teenFlagged' ? 'teen' : state === 'guest' ? 'closed' : 'adult';
  return {
    displayName: state === 'kid' ? 'Valentina' : 'María Fernanda de la Cruz Villanueva',
    username: state === 'noUsername' || state === 'guest' ? null : state === 'kid' ? 'vale_rocket' : 'maria_fernanda_22',
    memberSince: '2026-01-10T00:00:00Z', look: LOOK, cover: (state === 'kid' ? 'forest' : 'aurora') as CoverId,
    stats: { streakDays: 12, lessonsCompleted: 48, xpPoints: 12450, minutesLearned: 1320 },
    badges: state === 'noBadges' || state === 'guest' ? [] : BADGES, tier, tutor: state === 'tutor',
  };
}

export const OWN_PROFILE_PREVIEW_STATES = ['adult', 'tutor', 'teen', 'teenFlagged', 'kid', 'guest', 'noUsername', 'noBadges', 'copied', 'loading', 'failed', 'offline'] as const;
export const LOOK_EDITOR_PREVIEW_STATES = ['ready', 'saving', 'failed', 'loading', 'loadFailed', 'offline'] as const;
export const SETTINGS_PREVIEW_STATES = ['adult', 'teen', 'kid', 'guest', 'editing', 'errors', 'loading', 'failed'] as const;

function Page({ locale, theme, screen, children }: { locale: Locale; theme: 'light' | 'dark'; screen: string; children: ReactNode }) {
  return <div className="lf-rebuild" data-screen={`${screen}-preview`} data-theme={theme} lang={locale}>
    <RebuildProvider environment={{ theme, locale }} labels={{ dismiss: CORE[locale].appShell.dismiss }}>
      <main className="lf-account-preview-page">{children}</main>
    </RebuildProvider>
  </div>;
}

export function OwnProfilePreview({ locale, theme, state }: { locale: Locale; theme: 'light' | 'dark'; state: string | null }) {
  const t = PROFILE[locale];
  const dark = theme === 'dark';
  const name = state ?? 'adult';
  const view: OwnProfileView = name === 'loading' ? { kind: 'loading' } : name === 'failed' || name === 'offline'
    ? { kind: 'failed', offline: name === 'offline', retrying: false } : { kind: 'ready', data: profileData(name) };
  const connections = name === 'teen' || name === 'teenFlagged' ? <TeenConnections copy={t.teenConnections} locale={locale} dark={dark}
    requests={[{ requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', requestedAt: '2026-09-24T10:00:00Z', username: 'omar_valdes_rios', displayName: 'Omar Alejandro Valdés' }]}
    followers={[]} loading={false} failed={false} busy={false} notice={null} hasMore={false} onDecide={noop} onRemove={noop} onRetry={noop} onMore={noop} /> : null;
  const safety = name === 'teenFlagged' ? <ProfileSafetyNotice copy={t.profileSafety} locale={locale} dark={dark} audience="self" fields={['username']} /> : null;
  return <Page locale={locale} theme={theme} screen="own-profile">
    <OwnProfile copy={t.ownProfile} locale={locale} dark={dark} ageBand={name === 'kid' ? '6-9' : undefined} view={view} origin="https://littlefounders.ai"
      invite={name === 'copied' ? 'copied' : 'idle'} safetyNotice={safety} connections={connections} onNavigate={noop} onRetry={noop} onCopyInvite={noop} />
  </Page>;
}

export function LookEditorPreview({ locale, theme, state }: { locale: Locale; theme: 'light' | 'dark'; state: string | null }) {
  const t = PROFILE[locale];
  const name = state ?? 'ready';
  const [look, setLook] = useState(LOOK);
  const [cover, setCover] = useState<CoverId>('ocean');
  const view = name === 'loading' ? { kind: 'loading' as const } : name === 'loadFailed' || name === 'offline'
    ? { kind: 'failed' as const, offline: name === 'offline', retrying: false }
    : { kind: 'ready' as const, look, cover, saving: name === 'saving', error: name === 'failed' ? 'failed' as const : null };
  return <Page locale={locale} theme={theme} screen="look-editor">
    <LookEditor copy={t.lookEditor} locale={locale} dark={theme === 'dark'} view={view} onChange={setLook} onCover={setCover}
      onRandom={noop} onSave={noop} onRetry={noop} onNavigate={noop} />
  </Page>;
}

export function AccountSettingsPreview({ locale, theme, state }: { locale: Locale; theme: 'light' | 'dark'; state: string | null }) {
  const t = PROFILE[locale];
  const dark = theme === 'dark';
  const name = state ?? 'adult';
  const kid = name === 'kid';
  const guest = name === 'guest';
  const form: DetailsFormState = {
    displayName: kid ? 'Valentina' : 'María Fernanda de la Cruz Villanueva', username: guest ? '' : kid ? 'vale_rocket' : 'maria_fernanda_22',
    locale, birthDate: kid ? '2017-03-14' : name === 'teen' ? '2010-06-02' : null, saving: false, status: name === 'errors' ? null : null,
    errors: name === 'errors' ? { username: 'unsafe' } : {},
  };
  const view = name === 'loading' ? { kind: 'loading' as const } : name === 'failed' ? { kind: 'failed' as const, offline: false, retrying: false } : { kind: 'ready' as const };
  const core = CORE[locale].sessionPreferences;
  return <Page locale={locale} theme={theme} screen="account-settings">
    <SettingsScreen copy={t.settings} locale={locale} dark={dark} ageBand={kid ? '6-9' : undefined} view={view} onRetry={noop} onNavigate={noop}>
      {guest ? <GuestCard copy={t.settings} onNavigate={noop} /> : null}
      <DetailsCard copy={t.settings} locale={locale} kid={kid} form={form} onField={noop} onSave={noop} />
      {guest ? null : <SignInCard copy={t.settings} kid={kid} email="maria.fernanda.delacruz@example.com"
        emailChange={{ open: name === 'editing', newEmail: '', password: '', submitting: false, error: null, pending: null }}
        passwordChange={{ open: false, current: '', next: '', submitting: false, error: null, done: false }} onEmail={noop} onPassword={noop} />}
      <BlockedCard copy={t.settings} view={{ kind: 'ready', unblocking: null, failedId: null,
        users: name === 'adult' ? [{ userId: 'b1', displayName: 'Bartolomeo Alessandro Rodríguez', username: 'bartolomeo_2014' }] : [] }}
        onUnblock={noop} onRetry={noop} />
      <SettingsPanels>
        {name === 'teen' ? <AgeRecordCard copy={t.ageRecord} kind="teenMonth" /> : null}
        {name === 'teen' ? <AnalyticsChoice copy={t.analyticsChoice} locale={locale} dark={dark} enabled={false} experiment loading={false} saving={false} error={null} onToggle={noop} onRetry={noop} /> : null}
        {name === 'teen' ? <MemorySelfReview copy={t.memorySelfReview} locale={locale} dark={dark} phase="ready" current={{ learner: null, pedagogy: 'Short steps help.' }}
          notes={[{ id: 'n1', store: 'learner', proposed: 'Saving for a bike.', expectedBefore: null, sessionId: null, createdAt: '2026-09-20T10:00:00Z' },
            { id: 'n2', store: 'pedagogy', proposed: 'A picture first, then the rule.', expectedBefore: 'Short steps help.', sessionId: null, createdAt: '2026-09-20T10:00:00Z' }]}
          deciding={null} settled={{}} failedId={null} notice={null} noticeKind={null} onDecide={noop} onRetry={noop} /> : null}
        {guest ? null : <DispositionSummary copy={MENTOR[locale].mentorProfile} locale={locale} dark={dark} audience="own" phase="ready" canReset={!kid}
          data={{ exists: true, current: true, sessionsObserved: 5, helpStyle: 'independent', persistence: 'persists', explanation: 'unknown', persistentlyDeclined: ['less_text'],
            typicalReplySeconds: 12, personas: [], effects: [], updatedAt: '2026-09-20T10:00:00Z' }} />}
        <SessionPreferences copy={core} locale={locale} dark={dark} choice="auto" onChoice={noop} onSignOut={noop} signingOut={false} />
        <AccountDeletion copy={t.accountDeletion} locale={locale} dark={dark}
          view={kid ? { kind: 'blocked', reason: 'kid' } : { kind: 'ready', step: 'intro', immediate: guest, graceDays: guest ? 0 : 14, reauth: guest ? 'none' : 'password', pausedChildren: 0, submitting: false, error: null }}
          onStart={noop} onBack={noop} onConfirm={noop} onKeep={noop} onRetry={noop} onSignIn={noop} />
      </SettingsPanels>
    </SettingsScreen>
  </Page>;
}
