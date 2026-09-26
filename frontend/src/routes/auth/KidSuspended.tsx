import { useAuth } from '@/auth/AuthContext';
import { KidSuspendedScreen } from '@/rebuild/identity/KidSuspendedScreen';
import { StandaloneState } from '@/app-shell/StandaloneState';
import { useShellLocale } from '@/app-shell/ShellRoot';
import en from '@/i18n/en-US/rebuild-site.json';
import es from '@/i18n/es-MX/rebuild-site.json';
import pt from '@/i18n/pt-BR/rebuild-site.json';

/*
 * A.1's suspended-account route — public by design: Core has already
 * revoked the kid's sessions, so this page must render with no session at
 * all. The AuthContext flags decide suspended vs deleted copy; a direct
 * visit without either flag shows the suspended wording (the safer of the
 * two statements). It renders on the standalone single-state screen.
 *
 * Deliberately NOT named *Page.tsx: the AuthRecipe gate scans that suffix
 * for the login/signup trust-surface recipe. This is not an auth entry
 * surface — it is a post-session-revocation product state screen built on
 * the rebuild design system, so the recipe does not apply.
 */

export function KidSuspendedPage() {
  const locale = useShellLocale();
  const { deleted } = useAuth();
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).kidSuspended;
  return <StandaloneState pageTitle={copy.title}>
    <KidSuspendedScreen copy={copy} variant={deleted ? 'deleted' : 'suspended'} />
  </StandaloneState>;
}
