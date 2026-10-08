import { useAuth } from '@/auth/AuthContext';
import { KidSuspendedScreen } from '@/rebuild/identity/KidSuspendedScreen';
import { StandaloneState } from '@/app-shell/StandaloneState';
import { useShellLocale } from '@/app-shell/ShellRoot';
import en from '@/i18n/en-US/rebuild-site.json';
import es from '@/i18n/es-MX/rebuild-site.json';
import pt from '@/i18n/pt-BR/rebuild-site.json';

/*
 * The suspended-account route — public by design: Core has already
 * revoked the kid's sessions, so this page must render with no session at
 * all. The AuthContext flags decide suspended vs deleted copy; a direct
 * visit without either flag shows the suspended wording (the safer of the
 * two statements). It renders on the standalone single-state screen.
 */

export function KidSuspendedPage() {
  const locale = useShellLocale();
  const { deleted } = useAuth();
  const copy = (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en).kidSuspended;
  return <StandaloneState pageTitle={copy.title}>
    <KidSuspendedScreen copy={copy} variant={deleted ? 'deleted' : 'suspended'} />
  </StandaloneState>;
}
