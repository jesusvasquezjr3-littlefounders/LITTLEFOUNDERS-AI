/*
 * E.13 — profile-content safety review for minors' profile fields.
 *
 * An approved connection is not automatically a safe one, and a profile seen
 * before a block cannot be unseen. So the fields every social surface shows
 * (username and display name) must not hand a viewer what they need to find
 * the child somewhere else: a contact detail, a link, a handle or platform
 * name reused from another service, a school, a street or postal code, or a
 * birth year.
 *
 * This is the exact mirror of the SQL function public.profile_field_flags
 * (migration social_age_tiers). The database is the enforcing boundary (its
 * write guard refuses a flagged change to a minor's field, and its review
 * record hides a flagged legacy value from every outside surface); Core runs
 * the same rules first so a person gets a clear answer before any write.
 * Both implementations run the shared corpus in
 * database/scripts/fixtures/profile-field-safety-cases.json.
 *
 * Deliberate limits, stated in docs/rebuild/policies/SOCIAL-TIERS.md: a city
 * name, a surname or a handle with no platform marker is not reasonably
 * detectable by rules and is not claimed.
 */

export const PROFILE_FIELD_FLAGS = ['contact', 'link', 'handle', 'platform', 'school', 'location', 'year'] as const;
export type ProfileFieldFlag = (typeof PROFILE_FIELD_FLAGS)[number];

const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/;
const LINK = /(https?:\/\/|www\.|\.(com|net|org|io|gg|tv|me|app|ly|link|mx|br|co)([^a-z]|$))/;
const PLATFORM_TOKENS = new Set(['ig', 'yt', 'fb', 'ttv', 'psn', 'rblx', 'snap', 'insta', 'xbl']);
const PLATFORM_NAMES = /(instagram|tiktok|snapchat|youtube|discord|roblox|fortnite|twitch|twitter|facebook|whatsapp|telegram|playstation|xbox|minecraft|pinterest|reddit|kwai|likee|zepeto)/;
const SCHOOL = /(school|escuela|escola|colegio|col.gio|primaria|prim.ria|secundaria|secund.ria|elementary|kinder|preescolar|liceo|instituto|academy|academia|class ?of|grade ?[0-9]|[0-9](st|nd|rd|th) ?grade|grado|s.rie ?[0-9])/;
const LOCATION = /(street|avenue|avenida|apartment|apartamento|c.digo postal|zip ?code|(^|[^a-z])(calle|rua|road|cep|apt|depto|colonia|bairro|barrio)([^a-z]|$)|(^|[^0-9])[0-9]{5}([^0-9]|$))/;
const YEAR = /(^|[^0-9])(19[5-9][0-9]|20[0-3][0-9])([^0-9]|$)/;

/** The flags a single field raises, in the fixed vocabulary order. Empty = passes. */
export function profileFieldFlags(value: string | null | undefined): ProfileFieldFlag[] {
  const v = (value ?? '').toLowerCase();
  const flags: ProfileFieldFlag[] = [];
  if (EMAIL.test(v) || v.replace(/[^0-9]/g, '').length >= 7) flags.push('contact');
  if (LINK.test(v)) flags.push('link');
  if (v.includes('@')) flags.push('handle');
  if (v.split(/[^a-z]+/).some((token) => PLATFORM_TOKENS.has(token)) || PLATFORM_NAMES.test(v)) flags.push('platform');
  if (SCHOOL.test(v)) flags.push('school');
  if (LOCATION.test(v)) flags.push('location');
  if (YEAR.test(v)) flags.push('year');
  return flags;
}

export type ReviewedField = 'username' | 'displayName';

export interface ProfileFieldReview {
  flagged: boolean;
  fields: ReviewedField[];
}

/** The review of both social-facing fields of one profile. */
export function reviewProfileFields(fields: { username: string | null; displayName: string | null }): ProfileFieldReview {
  const flaggedFields: ReviewedField[] = [];
  if (profileFieldFlags(fields.username).length > 0) flaggedFields.push('username');
  if (profileFieldFlags(fields.displayName).length > 0) flaggedFields.push('displayName');
  return { flagged: flaggedFields.length > 0, fields: flaggedFields };
}
