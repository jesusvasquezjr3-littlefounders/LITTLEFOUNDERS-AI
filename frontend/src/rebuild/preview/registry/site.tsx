import { RouteErrorScreen } from '../../site/RouteErrorScreen';
import { standalone, type PreviewRegistry } from './types';

/*
 * Lane 1 (site): the public site, sign-in, recovery, verification and
 * onboarding. The public pages, the cookie choice and the age screen are
 * audited on their real routes (scripts/audits/lanes/site.mjs). The one screen
 * a real route cannot be made to show on demand is X2, a lazily loaded screen
 * that failed to download: it is previewed here, standalone as the lesson
 * player would show it (`?stale=1` for the new-version case).
 */
export const sitePreviewScreens: PreviewRegistry = {
  'route-error': standalone(({ locale, theme, params }) => <div className="lf-rebuild" data-theme={theme} lang={locale}>
    <RouteErrorScreen locale={locale} stale={params.get('stale') === '1'} home="learn" frame="standalone" onReload={() => {}} onHome={() => {}} />
  </div>),
};
