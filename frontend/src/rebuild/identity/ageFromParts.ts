/**
 * The whole years a typed date gives today, or null for a date that does not
 * exist or is in the future. A display decision only: Core derives the band
 * again from the date it receives and refuses a month that is not the date's.
 */
export function ageFromParts(day: string, month: string, year: string, now = new Date()): number | null {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  const [d, m, y] = [Number(day), Number(month), Number(year)];
  const born = new Date(Date.UTC(y, m - 1, d));
  if (born.getUTCFullYear() !== y || born.getUTCMonth() !== m - 1 || born.getUTCDate() !== d || born > now) return null;
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() < m - 1 || (now.getUTCMonth() === m - 1 && now.getUTCDate() < d)) age -= 1;
  return age;
}
