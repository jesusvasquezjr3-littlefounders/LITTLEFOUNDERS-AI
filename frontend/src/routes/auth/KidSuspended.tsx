import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { useAuth } from '@/auth/AuthContext';
import { KidSuspendedScreen } from '@/rebuild/identity/KidSuspendedScreen';
import en from '@/i18n/en-US/rebuild-site.json';
import es from '@/i18n/es-MX/rebuild-site.json';
import pt from '@/i18n/pt-BR/rebuild-site.json';

/*
 * A.1's suspended-account route — public by design: Core has already
 * revoked the kid's sessions, so this page must render with no session at
 * all. The AuthContext flags decide suspended vs deleted copy; a direct
 * visit without either flag shows the suspended wording (the safer of the
 * two statements).
 *
 * Deliberately NOT named *Page.tsx: the AuthRecipe gate scans that suffix
 * for the login/signup trust-surface recipe. This is not an auth entry
 * surface — it is a post-session-revocation product state screen built on
 * the rebuild design system, so the recipe does not apply.
 */

export function KidSuspendedPage() {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const { deleted } = useAuth();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).kidSuspended;
  return <KidSuspendedScreen copy={copy} locale={locale} dark={isDark} variant={deleted ? 'deleted' : 'suspended'} />;
}
