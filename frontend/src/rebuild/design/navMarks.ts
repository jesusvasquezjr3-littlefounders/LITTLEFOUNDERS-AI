/*
 * The class B navigation marks (Frontend Bible 07 section 1; manifest slot `nav.icon`, family `navigation`), one
 * per navigation destination of the learner app, the Tutor console and the staff console. The shells show them
 * in the tab bar, the rail and the menu sheet; below a 360 px container they let inactive tabs become 48 px
 * icon targets (02 section 7 rule 9). They are decorative: the word beside each mark is the destination's name.
 *
 * The ids live here, inside the rebuilt tree, so the asset gate (scripts/check-rebuild-assets.mjs) finds every
 * reference; app-shell/navigation.ts assigns them to its slots.
 */
export const NAV_MARKS = {
  learn: 'nav.icon.learn',
  tasks: 'nav.icon.tasks',
  wallet: 'nav.icon.wallet',
  familyCoins: 'nav.icon.family-coins',
  coins: 'nav.icon.coins',
  family: 'nav.icon.family',
  profile: 'nav.icon.profile',
  becomeTutor: 'nav.icon.become-tutor',
  staff: 'nav.icon.staff',
  backToApp: 'nav.icon.back-to-app',
  overview: 'nav.icon.overview',
  content: 'nav.icon.content',
  users: 'nav.icon.users',
  ageCorrections: 'nav.icon.age-corrections',
  emails: 'nav.icon.emails',
  analytics: 'nav.icon.analytics',
  intel: 'nav.icon.intel',
  mentorQuality: 'nav.icon.mentor-quality',
  generation: 'nav.icon.generation',
  audit: 'nav.icon.audit',
  reports: 'nav.icon.reports',
  roles: 'nav.icon.roles',
} as const;

export type NavMark = keyof typeof NAV_MARKS;
