import enCore from './en-US/rebuild-core.json';
import enSite from './en-US/rebuild-site.json';
import esCore from './es-MX/rebuild-core.json';
import esSite from './es-MX/rebuild-site.json';
import ptCore from './pt-BR/rebuild-core.json';
import ptSite from './pt-BR/rebuild-site.json';

/*
 * The UI's copy, one namespace per area. Surfaces do not go through i18next:
 * each imports the JSON of the namespace that owns it
 * (`i18n/<locale>/rebuild-<namespace>.json`) and receives typed strings, so a
 * missing key is a type error, not a raw key on screen.
 *
 *   core  the shell: navigation labels, theme and language controls
 *   site  the landing page and the cookie choice
 *
 * A key lives in exactly one namespace.
 */
export const rebuildNamespaceCopy = {
  'en-US': { core: enCore, site: enSite },
  'es-MX': { core: esCore, site: esSite },
  'pt-BR': { core: ptCore, site: ptSite },
} as const;
