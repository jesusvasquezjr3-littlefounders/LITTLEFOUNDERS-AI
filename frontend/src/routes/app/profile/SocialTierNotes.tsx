import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { ProfileSafetyNotice } from '@/rebuild/social/ProfileSafetyNotice';
import en from '@/i18n/en-US/rebuild-profile.json';
import es from '@/i18n/es-MX/rebuild-profile.json';
import pt from '@/i18n/pt-BR/rebuild-profile.json';

/*
 * The E.13 safety notice's mount for the routes that compose it (the rebuilt
 * own profile, and the Family panel until its lane rebuilds it). It resolves
 * the locale's copy and the theme here, so a route only decides whether the
 * notice applies.
 */

function useRebuildCopy() {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  return { locale, strings: locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en };
}

/** E.13: which field keeps the profile hidden, told to the right person. */
export function ProfileSafetyControl({ audience, fields, name }: { audience: 'self' | 'kidSelf' | 'guardian'; fields: ('username' | 'displayName')[]; name?: string }) {
  const { isDark } = useTheme();
  const { locale, strings } = useRebuildCopy();
  return <ProfileSafetyNotice copy={strings.profileSafety} locale={locale} dark={isDark} audience={audience} fields={fields} name={name} />;
}
