import type { PreviewRegistry } from './types';

/*
 * Lane 1 (site): the public site, sign-in, recovery, verification and
 * onboarding. No preview screen yet: the age screen is audited on its real
 * route (`/onboarding`), see scripts/audits/states/site.mjs.
 */
export const sitePreviewScreens: PreviewRegistry = {};
