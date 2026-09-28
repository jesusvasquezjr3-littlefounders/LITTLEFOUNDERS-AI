import type { BadgeKind } from './badge.js';

/*
 * The achievement image's central marks (OD-20; Frontend Bible 07 section 1:
 * no emoji as interface art, class B assets of our own). Each mark is the
 * class B asset registered in the rebuilt frontend's manifest under the same
 * id (frontend/src/rebuild/assets/manifest.json, review family
 * `achievement-share`, so the owner's style approval applies), drawn in token
 * colours only. Depot deploys on its own, so the drawings are inlined here;
 * the frontend asset gate (scripts/check-rebuild-assets.mjs) fails when a
 * `body` below differs from its registered SVG, whitespace aside.
 */
export interface BadgeMark {
  assetId: string;
  /** The registered SVG's viewBox size. */
  width: number;
  height: number;
  /** The registered SVG's inner markup, whitespace collapsed. */
  body: string;
}

export const BADGE_MARKS: Record<BadgeKind, BadgeMark> = {
  course_badge: {
    assetId: 'share.achievement.course_badge',
    width: 96,
    height: 104,
    body: '<path d="M48 2 93 27v50L48 102 3 77V27Z" fill="#4438cf"/> <path d="M48 8 88 30v44L48 96 8 74V30Z" fill="#5c55fd"/> <path d="M48 22 76 37v30L48 82 20 67V37Z" fill="#eceffe"/> <path d="M39 34h5v38h-5z" fill="#4438cf"/> <path d="m44 36 22 8-22 9Z" fill="#4438cf"/>',
  },
  streak: {
    assetId: 'share.achievement.streak',
    width: 96,
    height: 120,
    body: '<path d="M48 4c6 18 30 30 34 58 4 30-14 54-34 54S10 92 14 64c3-20 18-26 20-42 8 8 10 16 10 24 8-10 6-26 4-42Z" fill="#a88205"/> <path d="M48 12c5 16 26 28 29 52 3 26-12 46-29 46S16 90 19 66c2-17 15-22 17-36 7 7 9 14 9 21 7-9 5-23 3-39Z" fill="#ebb806"/> <path d="M48 58c3 9 15 15 16 28 1 13-7 22-16 22s-17-9-16-22c1-8 6-11 7-18 4 4 5 8 5 12 3-5 3-13 4-22Z" fill="#ffefc9"/>',
  },
  goal_reached: {
    assetId: 'share.achievement.goal_reached',
    width: 96,
    height: 96,
    body: '<rect x="30" y="10" width="36" height="14" rx="6" fill="#018675"/> <path d="M26 30c0-3.3 2.7-6 6-6h32c3.3 0 6 2.7 6 6v4c5.2 4.6 8 11.5 8 20v16c0 9.9-8.1 18-18 18H36c-9.9 0-18-8.1-18-18V54c0-8.5 2.8-15.4 8-20v-4Z" fill="#05a893"/> <rect x="31" y="44" width="34" height="30" rx="12" fill="#c7fef1"/> <path d="M48 68V55" stroke="#018675" stroke-width="4" stroke-linecap="round"/> <path d="M47 58c-1.4-5.2-5.6-8.2-11-7.4 1.3 5.3 5.6 8.3 11 7.4Z" fill="#018675"/> <path d="M49 56c1.4-5.2 5.6-8.2 11-7.4-1.3 5.3-5.6 8.3-11 7.4Z" fill="#018675"/>',
  },
};
