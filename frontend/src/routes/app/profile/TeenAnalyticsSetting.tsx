import { useTranslation } from 'react-i18next';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/theme/useTheme';
import { AnalyticsChoice } from '@/rebuild/privacy/AnalyticsChoice';
import en from '@/i18n/en-US/rebuild-profile.json';
import es from '@/i18n/es-MX/rebuild-profile.json';
import pt from '@/i18n/pt-BR/rebuild-profile.json';
import { useTeenAnalyticsPreference } from '@/app-shell/useTeenAnalyticsPreference';

/** The copy of the analytics choice in the shell's language. */
export function analyticsChoiceCopy(locale: string) {
  return (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).analyticsChoice;
}

export function TeenAnalyticsSetting() {
  const { session, isGuest } = useAuth();
  return !session || isGuest ? null : <AccountAnalyticsSetting key={session.user.id} />;
}
/*
 * The Settings card. Until a choice is on file (Core's `disclosed`) it offers
 * the same two explicit answers as the first-session step, never the switch:
 * a flip from nothing could only record "on" (F3-identity-site).
 */
function AccountAnalyticsSetting() {
  const { i18n } = useTranslation(); const { isDark } = useTheme();
  const { preference, loading, saving, error, choose, toggle, retry } = useTeenAnalyticsPreference();
  if (!loading && !error && preference?.canManage === false) return null;
  const locale = i18n.resolvedLanguage ?? 'en-US';
  return <AnalyticsChoice copy={analyticsChoiceCopy(locale)}
    locale={locale} dark={isDark} enabled={preference?.enabled ?? false} experiment={preference?.dialogueExperiment === true} loading={loading} saving={saving} error={error}
    decided={preference?.disclosed ?? true} onChoose={(enabled) => void choose(enabled)}
    onToggle={() => void toggle()} onRetry={retry} />;
}
