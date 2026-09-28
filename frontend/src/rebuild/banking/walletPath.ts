/**
 * The family's Wallet (OD-28): a parent-created child's coin card, a linked
 * teen's family card and the Tutor's view of every card. The controlled
 * glossary avoids "bank", so the path is not `/banking` any more; the old path
 * redirects here (app-routes/family.tsx) and keeps its query (`?child=`).
 */
export const FAMILY_WALLET_PATH = '/family-wallet';
/** The retired path of the family Wallet, kept only as a redirect. */
export const LEGACY_FAMILY_WALLET_PATH = '/banking';
