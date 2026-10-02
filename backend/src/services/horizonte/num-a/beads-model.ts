export const REKENREK_ROWS = 2;
export const REKENREK_BEADS = 10;
export const REKENREK_BLOCK = 5;
export const ABACUS_MAX_RODS = 4;
export const ABACUS_MAX_DIGIT = 9;

export type BeadCounts = readonly number[];

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/** A slid-bead count per row: exactly two whole numbers, each from 0 to 10. */
export function isRekenrekCounts(value: unknown): value is BeadCounts {
  return Array.isArray(value) && value.length === REKENREK_ROWS && value.every((count) => whole(count) && count >= 0 && count <= REKENREK_BEADS);
}

/** One digit per rod, most significant first: one to four whole numbers, each from 0 to 9 (a five bead and four one beads). */
export function isAbacusDigits(value: unknown, rods?: number): value is BeadCounts {
  return Array.isArray(value) && value.length >= 1 && value.length <= ABACUS_MAX_RODS && (rods === undefined || value.length === rods)
    && value.every((digit) => whole(digit) && digit >= 0 && digit <= ABACUS_MAX_DIGIT);
}

export const sameBeads = (a: BeadCounts, b: BeadCounts): boolean => a.length === b.length && a.every((count, index) => count === b[index]);
export const beadTotal = (counts: BeadCounts): number => counts.reduce((sum, count) => sum + count, 0);

/** A row of ten reads as blocks: whole fives first, the rest as ones. */
export const blocksOf = (count: number): { fives: number; ones: number } => ({ fives: Math.floor(count / REKENREK_BLOCK), ones: count % REKENREK_BLOCK });

/** Bead `index` (0-9) of a row is slid when it is below the count; beads slide from the left, so a count is a run. */
export const beadSlid = (count: number, index: number): boolean => index < count;

/** The count after tapping bead `index`: a bead off to the right slides itself and every bead before it; a slid bead pulls itself and every bead after it back. */
export const tapBead = (count: number, index: number): number => (index < count ? index : index + 1);

/** A rod digit as beads: the five bead is counted from 5 up; the four one beads count the rest. */
export const rodBeads = (digit: number): { five: boolean; ones: number } => ({ five: digit >= REKENREK_BLOCK, ones: digit % REKENREK_BLOCK });
export const rodDigit = (five: boolean, ones: number): number => (five ? REKENREK_BLOCK : 0) + ones;

/** The tapped five bead flips the five; the tapped one bead (0-3) sets the ones the same way `tapBead` does on a row of four. */
export const tapFive = (digit: number): number => (digit >= REKENREK_BLOCK ? digit - REKENREK_BLOCK : digit + REKENREK_BLOCK);
export const tapOne = (digit: number, index: number): number => rodDigit(digit >= REKENREK_BLOCK, index < digit % REKENREK_BLOCK ? index : index + 1);

export const abacusValue = (digits: BeadCounts): number => digits.reduce((sum, digit) => sum * 10 + digit, 0);
