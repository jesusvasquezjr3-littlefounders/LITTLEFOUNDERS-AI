/*
 * The landing's type roles, one place so a repeated role looks identical in every section.
 * One family (Plus Jakarta Sans); hierarchy comes from size, weight and space. Measures stay
 * between 45 and 75 characters, headings balance, and nothing is set below 16 px.
 */

/** The page's one h1. */
export const display = 'text-[clamp(2.5rem,5.2vw,3.75rem)] leading-[1.06] font-extrabold tracking-[-0.025em] text-balance';

/** Section headings (h2). */
export const heading = 'text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance';

/** Titles inside a section (h3). */
export const title = 'text-xl leading-snug font-bold text-balance';

/** The sentence under a heading. */
export const lead = 'max-w-[40ch] text-lg leading-relaxed text-pretty text-[var(--muted-foreground)] md:text-xl';

/** Running text. */
export const body = 'max-w-[60ch] text-base leading-relaxed text-pretty';

/** Vertical rhythm between landing sections. */
export const section = 'py-12 md:py-20';
