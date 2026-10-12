/*
 * The landing's grid, rhythm, alignment and type roles, in one place so a repeated role looks
 * identical in every section and every section lands on the same lines.
 *
 * GRID. One grid for the whole page, inside the shell's container (1120 px with 16 px margins on
 * phones and 24 px from 640 px, so the content is 1072 px wide at most):
 *   - 4 columns below 768 px, gutter 16 px;
 *   - 8 columns from 768 px, gutter 24 px;
 *   - 12 columns from 1024 px, gutter 24 px (one column is 67 px at the widest).
 * A section places its blocks with `col-span-*` on this grid and never invents its own columns or
 * gutter.
 *
 * ALIGNMENT. On phones (below 768 px) every block is centered on the page's axis, so the page is
 * symmetric; from 768 px text blocks start on the container's left edge and nothing is inset, so the
 * heading, the paragraph and the button of every section share one vertical line. The problem
 * section is the exception by design: it is centered at every width.
 *
 * RHYTHM. One vertical padding per section (48 px on phones, 64 px from 768 px), so the space
 * between any two sections is the same: 96 px, then 128 px.
 *
 * TYPE. One family (Plus Jakarta Sans); hierarchy comes from size, weight and space. Running text is
 * medium weight in the soft ink color (not the muted gray) so it reads at a glance, measures stay
 * between 45 and 75 characters, headings balance, nothing is set below 16 px.
 */

/** The page grid. Children choose their span: `col-span-4 md:col-span-8 lg:col-span-6`. */
export const grid = 'grid grid-cols-4 gap-x-4 md:grid-cols-8 md:gap-x-6 lg:grid-cols-12';

/** Vertical padding of every landing section. */
export const section = 'py-12 md:py-16';

/** Centered on phones, left aligned from 768 px. Put it on a text block. */
export const align = 'text-center md:text-start';

/** The same, for a grid or flex container that places its children: they follow the text. */
export const alignItems = 'justify-items-center md:justify-items-start';

/** The page's one h1. */
export const display = 'text-[clamp(2.5rem,5vw,3.5rem)] leading-[1.06] font-extrabold tracking-[-0.025em] text-balance';

/** Section headings (h2). */
export const heading = 'text-[clamp(1.875rem,3.4vw,2.5rem)] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance';

/** Statements that carry a section's argument. */
export const statement = 'text-[clamp(1.375rem,2.2vw,1.5rem)] leading-snug font-bold text-balance';

/** Titles inside a section (h3). */
export const title = 'text-xl leading-snug font-bold text-balance';

/** The sentence under a heading. */
export const lead = 'max-w-[40ch] text-[1.1875rem] leading-relaxed font-medium text-pretty text-[var(--v-ink-soft)] md:text-xl';

/** Running text. */
export const body = 'max-w-[60ch] text-[1.0625rem] leading-relaxed font-medium text-pretty text-[var(--v-ink-soft)] md:text-base';
