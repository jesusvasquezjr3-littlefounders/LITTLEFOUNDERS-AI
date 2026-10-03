import type { Json } from './shared.js';

const MICRO = 1_000_000n;

/** A plain decimal ("-12.5", "3") as whole millionths, or null when it is not plain decimal text. */
export function toMicro(text: unknown): bigint | null {
  if (typeof text !== 'string' || !/^-?(0|[1-9]\d{0,14})(\.\d{1,6})?$/.test(text)) return null;
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const value = BigInt(whole!) * MICRO + BigInt(fraction.padEnd(6, '0'));
  return negative ? -value : value;
}

export function fromMicro(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const fraction = String(absolute % MICRO).padStart(6, '0').replace(/0+$/, '');
  return `${negative && absolute !== 0n ? '-' : ''}${absolute / MICRO}${fraction ? `.${fraction}` : ''}`;
}

export const centsToMicro = (cents: number): bigint => BigInt(cents) * 10_000n;

const abs = (value: bigint): bigint => (value < 0n ? -value : value);

interface Allowance { absolute: bigint; bps: bigint }

function allowanceOf(tolerance: unknown): Allowance {
  const given = (tolerance ?? {}) as Json;
  return { absolute: toMicro(given.absolute) ?? 0n, bps: BigInt(typeof given.relative_bps === 'number' ? given.relative_bps : 0) };
}

/** Whether a value lies within a key tolerance of the target, by the plain definition: gap <= max(absolute, |target| * bps / 10000). */
export function withinTolerance(value: bigint, target: bigint, tolerance: unknown): boolean {
  const { absolute, bps } = allowanceOf(tolerance);
  const left = abs(value - target) * 10_000n;
  const right = absolute * 10_000n > abs(target) * bps ? absolute * 10_000n : abs(target) * bps;
  return left <= right;
}

const widest = (target: bigint, tolerance: unknown): bigint => {
  const { absolute, bps } = allowanceOf(tolerance);
  const relative = (abs(target) * bps + 9_999n) / 10_000n;
  return relative > absolute ? relative : absolute;
};

/** Offsets around a target that straddle the met and review bands of a key, and one far miss. */
export function offsetsAround(target: bigint, tolerance: unknown, review: unknown): bigint[] {
  const met = widest(target, tolerance);
  const near = widest(target, review);
  const cent = 10_000n;
  const spread = [0n, met / 2n, met, met + cent, near, near + cent, near * 3n + cent, 50n * MICRO];
  const out = new Set<bigint>();
  for (const step of spread) { out.add(step); out.add(-step); }
  return [...out];
}
