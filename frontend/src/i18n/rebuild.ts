import enCore from './en-US/rebuild-core.json';
import enSite from './en-US/rebuild-site.json';
import enLearn from './en-US/rebuild-learn.json';
import enMentor from './en-US/rebuild-mentor.json';
import enProfile from './en-US/rebuild-profile.json';
import enStaff from './en-US/rebuild-staff.json';
import esCore from './es-MX/rebuild-core.json';
import esSite from './es-MX/rebuild-site.json';
import esLearn from './es-MX/rebuild-learn.json';
import esMentor from './es-MX/rebuild-mentor.json';
import esProfile from './es-MX/rebuild-profile.json';
import esStaff from './es-MX/rebuild-staff.json';
import ptCore from './pt-BR/rebuild-core.json';
import ptSite from './pt-BR/rebuild-site.json';
import ptLearn from './pt-BR/rebuild-learn.json';
import ptMentor from './pt-BR/rebuild-mentor.json';
import ptProfile from './pt-BR/rebuild-profile.json';
import ptStaff from './pt-BR/rebuild-staff.json';

/*
 * The rebuilt UI's copy, one namespace per area. Rebuilt surfaces do not go through i18next: each imports the JSON
 * of the namespace that owns it (`i18n/<locale>/rebuild-<namespace>.json`) and
 * receives typed strings, so a missing key is a type error, not a raw key on
 * screen.
 *
 *   core     design system, gallery, preview index, shells and navigation,
 *            standalone states
 *   site     public site, sign-in, recovery, verification, onboarding
 *   learn    learner home, courses, placement, lessons, results
 *   mentor   the Mentor stage and its session surfaces
 *   profile  profile, social, settings, account
 *   staff    the staff console
 *
 * A key lives in exactly one namespace. An area
 * adds keys only to its own file; adding a namespace means adding it here and
 * to REBUILD_NAMESPACES.
 */
export const REBUILD_NAMESPACES = ['core', 'site', 'learn', 'mentor', 'profile', 'staff'] as const;
export type RebuildNamespace = typeof REBUILD_NAMESPACES[number];

const en = { ...enCore, ...enSite, ...enLearn, ...enMentor, ...enProfile, ...enStaff };

/** Every rebuilt namespace merged, for the few consumers that span areas (the preview entry). */
export type RebuildCopy = typeof en;

export const rebuildCopy: Record<'en-US' | 'es-MX' | 'pt-BR', RebuildCopy> = {
  'en-US': en,
  'es-MX': { ...esCore, ...esSite, ...esLearn, ...esMentor, ...esProfile, ...esStaff },
  'pt-BR': { ...ptCore, ...ptSite, ...ptLearn, ...ptMentor, ...ptProfile, ...ptStaff },
};

/** Each namespace's own strings, by locale. */
export const rebuildNamespaceCopy = {
  'en-US': { core: enCore, site: enSite, learn: enLearn, mentor: enMentor, profile: enProfile, staff: enStaff },
  'es-MX': { core: esCore, site: esSite, learn: esLearn, mentor: esMentor, profile: esProfile, staff: esStaff },
  'pt-BR': { core: ptCore, site: ptSite, learn: ptLearn, mentor: ptMentor, profile: ptProfile, staff: ptStaff },
} as const;
