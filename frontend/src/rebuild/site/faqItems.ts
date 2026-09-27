/*
 * The public FAQ's questions, in the order the page lists them (M4, A.1).
 *
 * Every answer states a capability that ships, and several are held to the
 * code by gates that read THIS list (the literal `{ id: "…", category: "…" }`
 * lines) and the answers in `i18n/<locale>/rebuild-site.json` (`faq.items`):
 *
 *   - check-block-d-scope.mjs      notTaught      (D.20 scope statement: names every exclusion)
 *   - check-block-d-retention.mjs  familyRecords  (D.21: the periods the nightly job enforces)
 *   - check-social-governance.mjs  noMessaging, socialRetention (E.10, E.11 windows)
 *   - check-account-deletion.mjs   deleteAccount  (E.6: the grace period and "keep")
 *   - check-no-unbacked-guarantee.mjs chores       (D.7/D.17: approval or the granted level)
 *
 * Where each answer comes from (data sources, not copy): the guest start and
 * MIN_SIGNUP_AGE_YEARS (start); guardian_links, the single-use 7-day co-guardian
 * invite of migration 0110 and MAX_KIDS_PER_PARENT = 10 (family); the Tutor's
 * full transcript, memory-note review and the voice consent control (mentor);
 * the coins simulation, the independence levels and the scope statement
 * (money); the Privacy Notice, the Mentor transcript retention job, the
 * analytics consent toggle and the social and family retention policies
 * (privacy); Settings deletion, the in-app Report beside Block and the A.1
 * suspension cascade (support). Adding a question means adding a working
 * feature first (A.1, Law 5), then its answer in all three locales.
 */

export const FAQ_CATEGORIES = ['start', 'family', 'mentor', 'money', 'privacy', 'support'] as const;
export type FaqCategory = typeof FAQ_CATEGORIES[number];

export const FAQ_ITEMS: readonly { id: string; category: FaqCategory }[] = [
  { id: "whatIs", category: "start" },
  { id: "isFree", category: "start" },
  { id: "tryWithoutAccount", category: "start" },
  { id: "languages", category: "start" },
  { id: "ages", category: "start" },
  { id: "whatIsTutor", category: "family" },
  { id: "addChild", category: "family" },
  { id: "twoParents", category: "family" },
  { id: "howMany", category: "family" },
  { id: "ownDevice", category: "family" },
  { id: "talksToAI", category: "mentor" },
  { id: "privateFromYou", category: "mentor" },
  { id: "remember", category: "mentor" },
  { id: "mentors", category: "mentor" },
  { id: "canBeWrong", category: "mentor" },
  { id: "realBank", category: "money" },
  { id: "lfCoins", category: "money" },
  { id: "chores", category: "money" },
  { id: "realMoney", category: "money" },
  { id: "notTaught", category: "money" },
  { id: "dataCollected", category: "privacy" },
  { id: "moderation", category: "privacy" },
  { id: "retention", category: "privacy" },
  { id: "noMessaging", category: "privacy" },
  { id: "socialRetention", category: "privacy" },
  { id: "familyRecords", category: "privacy" },
  { id: "analyticsToggle", category: "privacy" },
  { id: "coppa", category: "privacy" },
  { id: "contact", category: "support" },
  { id: "deleteAccount", category: "support" },
  { id: "cancelTutor", category: "support" },
];
