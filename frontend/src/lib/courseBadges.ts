/**
 * Badge assets are declared by each course in Forge and persisted by Core.
 * These known paths keep older local fixtures and archived UI snapshots
 * renderable until they receive the new database column.
 */
export const COURSE_BADGE_FALLBACKS: Record<string, string> = {
  'first-lemonade-stand': '/course-badges/first-lemonade-stand.png',
  'financial-education': '/course-badges/financial-education.png',
  entrepreneurship: '/course-badges/entrepreneurship.png',
  investing: '/course-badges/investing.png',
};

export function courseBadgeAsset(asset: string | null | undefined, slug: string): string | null {
  const source = asset ?? COURSE_BADGE_FALLBACKS[slug] ?? null;
  if (!source) return null;
  return source.startsWith('/') ? source : `/${source}`;
}

export interface CourseBadge {
  slug: string;
  title: Record<string, string>;
  badgeAsset: string;
  completedAt: string | null;
}
