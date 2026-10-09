/*
 * The landing's grid, rhythm and type roles, in one place so a repeated role looks identical in
 * every section and every section lands on the same lines.
 *
 * GRID. One grid for the whole page, inside the shell's container (1120 px with 16 px margins on
 * phones and 24 px from 640 px, so the content is 1072 px wide at most):
 *   - 4 columns below 768 px, gutter 16 px;
 *   - 8 columns from 768 px, gutter 24 px;
 *   - 12 columns from 1024 px, gutter 24 px (one column is 67 px at the widest).
 * A section places its blocks with `col-span-*` on this grid and never invents its own columns or
 * gutter. Every text block starts on the container's left edge: nothing is inset, so the heading,
 * the paragraph and the button of every section share one vertical line.
 *
 * RHYTHM. One vertical padding per section (48 px on phones, 64 px from 768 px), so the space
 * between any two sections is the same: 96 px, then 128 px. Spaces inside a section come from
 * multiples of 8.
 *
 * TYPE. One family (Plus Jakarta Sans); hierarchy comes from size, weight and space. Measures stay
 * between 45 and 75 characters for running text, headings balance, nothing is set below 16 px.
 */

/** The page grid. Children choose their span: `col-span-4 md:col-span-8 lg:col-span-6`. */
export const grid = 'grid grid-cols-4 gap-x-4 md:grid-cols-8 md:gap-x-6 lg:grid-cols-12';

/** Vertical padding of every landing section. */
export const section = 'py-12 md:py-16';

/** The page's one h1. */
export const display = 'text-[clamp(2.5rem,5vw,3.5rem)] leading-[1.06] font-extrabold tracking-[-0.025em] text-balance';

/** Section headings (h2). */
export const heading = 'text-[clamp(1.75rem,3.4vw,2.5rem)] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance';

/** Statements that carry a section's argument. */
export const statement = 'text-[clamp(1.25rem,2.2vw,1.5rem)] leading-snug font-semibold text-balance';

/** Titles inside a section (h3). */
export const title = 'text-xl leading-snug font-bold text-balance';

/** The sentence under a heading. */
export const lead = 'max-w-[40ch] text-lg leading-relaxed text-pretty text-[var(--muted-foreground)] md:text-xl';

/** Running text. */
export const body = 'max-w-[60ch] text-base leading-relaxed text-pretty';
