import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { ManagedConnectionsNote } from '@/rebuild/social/PrivateProfile';
import { ProfileSafetyNotice } from '@/rebuild/social/ProfileSafetyNotice';
import en from '@/i18n/en-US/rebuild-profile.json';
import es from '@/i18n/es-MX/rebuild-profile.json';
import pt from '@/i18n/pt-BR/rebuild-profile.json';

/*
 * Legacy-route mounts for the E.8 and E.13 rebuild notes. They resolve the
 * locale's copy and the theme here, so the legacy pages only decide whether
 * a note applies (Bible 02 rule 23: the pages import no rebuild internals
 * beyond these mounts).
 */

function useRebuildCopy() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  return { locale, strings: locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en };
}

/** A child on a public adult's profile: its Tutor manages its connections. */
export function ManagedConnectionsControl() {
  const { isDark } = useTheme();
  const { locale, strings } = useRebuildCopy();
  return <ManagedConnectionsNote copy={strings.privateProfile} locale={locale} dark={isDark} />;
}

/** E.13: which field keeps the profile hidden, told to the right person. */
export function ProfileSafetyControl({ audience, fields, name }: { audience: 'self' | 'kidSelf' | 'guardian'; fields: ('username' | 'displayName')[]; name?: string }) {
  const { isDark } = useTheme();
  const { locale, strings } = useRebuildCopy();
  return <ProfileSafetyNotice copy={strings.profileSafety} locale={locale} dark={isDark} audience={audience} fields={fields} name={name} />;
}
