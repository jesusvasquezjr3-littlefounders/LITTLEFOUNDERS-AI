import enApp from './en-US/app.json';
import enCore from './en-US/core.json';
import enOnboarding from './en-US/onboarding.json';
import enSite from './en-US/site.json';
import esApp from './es-MX/app.json';
import esCore from './es-MX/core.json';
import esOnboarding from './es-MX/onboarding.json';
import esSite from './es-MX/site.json';
import ptApp from './pt-BR/app.json';
import ptCore from './pt-BR/core.json';
import ptOnboarding from './pt-BR/onboarding.json';
import ptSite from './pt-BR/site.json';

/*
 * The UI's copy, one namespace per area. Surfaces do not go through i18next:
 * each imports the JSON of the namespace that owns it
 * (`i18n/<locale>/<namespace>.json`) and receives typed strings, so a
 * missing key is a type error, not a raw key on screen.
 *
 *   core  the shell: navigation labels, theme and language controls
 *   site  the landing page and the cookie choice
 *   onboarding  the walk before an account, and the notice of what it saved
 *   app   the signed-in application: its menu, its home, its empty places
 *
 * A key lives in exactly one namespace.
 */
export const copy = {
  'en-US': { core: enCore, site: enSite, onboarding: enOnboarding, app: enApp },
  'es-MX': { core: esCore, site: esSite, onboarding: esOnboarding, app: esApp },
  'pt-BR': { core: ptCore, site: ptSite, onboarding: ptOnboarding, app: ptApp },
} as const;
