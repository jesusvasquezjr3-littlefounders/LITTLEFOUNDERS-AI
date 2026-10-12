/*
 * Where the footer's outbound links go. They are data, not words, so they are not in the locale
 * files. A value of `null` means "not set up yet": the entry is shown and is not a link until its
 * address is filled in here.
 *
 * To add a social profile: put its address in `SOCIAL`. To open the legal pages: put their paths in
 * `LEGAL` once the pages exist (T-003 in docs/process/BUILD-TASKS.md).
 */

export const SOCIAL = [
  { key: 'facebook', href: null },
  { key: 'instagram', href: null },
  { key: 'x', href: null },
  { key: 'linkedin', href: null },
] as const satisfies readonly { key: string; href: string | null }[];

export const LEGAL = {
  terms: null,
  privacy: null,
} as const satisfies Record<string, string | null>;
