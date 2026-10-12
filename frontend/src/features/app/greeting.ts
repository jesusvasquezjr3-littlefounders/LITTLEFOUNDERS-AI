/*
 * The words above the stage of the home: a greeting and a line under it, each taken from a
 * collection in the locale files (`home.greetings`, `home.subtitles`), by the hour it is for the
 * person. A greeting for the morning, the afternoon, the evening or the small hours; a line that
 * fits that hour, or one of the lines that fit any.
 *
 * The choice is steady: the same person sees the same pair for the whole of a day's part, and
 * another pair the next time. It is picked from the day and the name, not at random on every
 * render, so the words do not change under the eyes.
 */
export type DayPart = 'night' | 'morning' | 'afternoon' | 'evening';

type Collection = Record<DayPart, readonly string[]>;

/** The part of the day an hour of the clock belongs to. The small hours are their own part. */
export function dayPartOf(hour: number): DayPart {
  if (hour < 5) return 'night';

  if (hour < 12) return 'morning';

  if (hour < 19) return 'afternoon';

  return 'evening';
}

/** A whole number from a text, the same every time for the same text. */
function numberFrom(text: string): number {
  let hash = 2166136261;

  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);

  return hash >>> 0;
}

/** One of a list, the same every time for the same seed. */
export const steadyPick = (list: readonly string[], seed: string): string => list[numberFrom(seed) % list.length] ?? '';

const pick = steadyPick;

/**
 * The greeting and its line for a person at a moment. `day` is the calendar day (it changes the
 * choice from one day to the next) and `name` what the person asked to be called, which may be
 * empty: a greeting then drops the name and the comma before it.
 */
export function greetingFor({ greetings, subtitles, any, name, day, hour }: { greetings: Collection; subtitles: Collection; any: readonly string[]; name: string; day: string; hour: number }) {
  const part = dayPartOf(hour);
  const seed = `${day}|${part}|${name}`;
  const greeting = pick(greetings[part], seed);

  return {
    greeting: name ? greeting.replace('{name}', () => name) : greeting.replace(/,?\s*\{name\}/, ''),
    subtitle: pick([...subtitles[part], ...any], `${seed}|line`),
  };
}
