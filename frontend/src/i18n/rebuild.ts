import enCore from './en-US/rebuild-core.json';
import enSite from './en-US/rebuild-site.json';
import enLearn from './en-US/rebuild-learn.json';
import enMentor from './en-US/rebuild-mentor.json';
import enFamily from './en-US/rebuild-family.json';
import enProfile from './en-US/rebuild-profile.json';
import enStaff from './en-US/rebuild-staff.json';
import esCore from './es-MX/rebuild-core.json';
import esSite from './es-MX/rebuild-site.json';
import esLearn from './es-MX/rebuild-learn.json';
import esMentor from './es-MX/rebuild-mentor.json';
import esFamily from './es-MX/rebuild-family.json';
import esProfile from './es-MX/rebuild-profile.json';
import esStaff from './es-MX/rebuild-staff.json';
import ptCore from './pt-BR/rebuild-core.json';
import ptSite from './pt-BR/rebuild-site.json';
import ptLearn from './pt-BR/rebuild-learn.json';
import ptMentor from './pt-BR/rebuild-mentor.json';
import ptFamily from './pt-BR/rebuild-family.json';
import ptProfile from './pt-BR/rebuild-profile.json';
import ptStaff from './pt-BR/rebuild-staff.json';

/*
 * The rebuilt UI's copy, one namespace per wave-2 lane (W2 "Shells and
 * routing"). Rebuilt surfaces do not go through i18next: each imports the JSON
 * of the namespace that owns it (`i18n/<locale>/rebuild-<namespace>.json`) and
 * receives typed strings, so a missing key is a type error, not a raw key on
 * screen.
 *
 *   core     design system, gallery, preview index, shells and navigation,
 *            standalone states (Lane 0)
 *   site     public site, sign-in, recovery, verification, onboarding (Lane 1)
 *   learn    learner home, courses, placement, lessons, results (Lane 2)
 *   mentor   the Mentor stage and its session surfaces (Lane 3)
 *   family   Family Hub, Tutor console, tasks, banking, teen wallet (Lane 4)
 *   profile  profile, social, settings, account (Lane 5)
 *   staff    the staff console (Lane 6)
 *
 * A key lives in exactly one namespace (`rebuildNamespaces.test.ts`). A lane
 * adds keys only to its own file; adding a namespace means adding it here and
 * to REBUILD_NAMESPACES, which the parity gate (agent/tools/check-i18n.sh)
 * and the glossary contract then cover automatically.
 */
export const REBUILD_NAMESPACES = ['core', 'site', 'learn', 'mentor', 'family', 'profile', 'staff'] as const;
export type RebuildNamespace = typeof REBUILD_NAMESPACES[number];

const en = { ...enCore, ...enSite, ...enLearn, ...enMentor, ...enFamily, ...enProfile, ...enStaff };

/** Every rebuilt namespace merged, for the few consumers that span lanes (the preview entry). */
export type RebuildCopy = typeof en;

export const rebuildCopy: Record<'en-US' | 'es-MX' | 'pt-BR', RebuildCopy> = {
  'en-US': en,
  'es-MX': { ...esCore, ...esSite, ...esLearn, ...esMentor, ...esFamily, ...esProfile, ...esStaff },
  'pt-BR': { ...ptCore, ...ptSite, ...ptLearn, ...ptMentor, ...ptFamily, ...ptProfile, ...ptStaff },
};

/** Each namespace's own strings, by locale (for per-namespace contract tests). */
export const rebuildNamespaceCopy = {
  'en-US': { core: enCore, site: enSite, learn: enLearn, mentor: enMentor, family: enFamily, profile: enProfile, staff: enStaff },
  'es-MX': { core: esCore, site: esSite, learn: esLearn, mentor: esMentor, family: esFamily, profile: esProfile, staff: esStaff },
  'pt-BR': { core: ptCore, site: ptSite, learn: ptLearn, mentor: ptMentor, family: ptFamily, profile: ptProfile, staff: ptStaff },
} as const;
