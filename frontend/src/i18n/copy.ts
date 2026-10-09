import enCore from './en-US/core.json';
import enSite from './en-US/site.json';
import esCore from './es-MX/core.json';
import esSite from './es-MX/site.json';
import ptCore from './pt-BR/core.json';
import ptSite from './pt-BR/site.json';

/*
 * The UI's copy, one namespace per area. Surfaces do not go through i18next:
 * each imports the JSON of the namespace that owns it
 * (`i18n/<locale>/<namespace>.json`) and receives typed strings, so a
 * missing key is a type error, not a raw key on screen.
 *
 *   core  the shell: navigation labels, theme and language controls
 *   site  the landing page and the cookie choice
 *
 * A key lives in exactly one namespace.
 */
export const copy = {
  'en-US': { core: enCore, site: enSite },
  'es-MX': { core: esCore, site: esSite },
  'pt-BR': { core: ptCore, site: ptSite },
} as const;
