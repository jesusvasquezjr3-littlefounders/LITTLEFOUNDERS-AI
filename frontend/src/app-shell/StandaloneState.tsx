import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SingleStateScreen, type SingleStateHue } from '@/rebuild/design/controls';
import { ShellRoot, useShellCopy, useShellLocale } from './ShellRoot';

/*
 * A standalone state route (not found, a suspended account, a scheduled or
 * completed deletion) on the rebuilt single-state screen (02 §4.5, rule 15):
 * one hue fills the page, no navigation, a skip link, route focus, the
 * document title and language. The page supplies exactly one <h1>.
 */
export function StandaloneState({ pageTitle, hue = 'primary', actions, children }: {
  pageTitle: string; hue?: SingleStateHue; actions?: ReactNode; children: ReactNode;
}) {
  const copy = useShellCopy().appShell;
  const locale = useShellLocale();
  const { pathname } = useLocation();
  return <ShellRoot>
    <SingleStateScreen appName="LittleFounders" pageTitle={pageTitle} routeKey={pathname} locale={locale} hue={hue}
      labels={{ skip: copy.skip }} actions={actions}>{children}</SingleStateScreen>
  </ShellRoot>;
}
