/** sfc32 on a 256 bit attempt seed: the one pure generator every seeded Horizonte piece uses, in Core and in the browser. */
const WORD = 4294967296;
const WARMUP = 12;

export type Prng = {
  /** The next unsigned 32 bit word of the stream. */
  next: () => number;
  /** An unbiased integer in 0..n-1 (n from 1 to 2^32); it consumes one word, plus one more for each rejected word. */
  below: (n: number) => number;
};

/** `seed` is 64 lowercase hex characters (see protocol.ts); any other string is a caller bug and throws. */
export function createPrng(seed: string): Prng {
  if (!/^[0-9a-f]{64}$/.test(seed)) throw new Error('The attempt seed is 64 lowercase hex characters');
  let a = 0x9e3779b9 | 0;
  let b = 0x243f6a88 | 0;
  let c = 0xb7e15162 | 0;
  let d = 1;
  const next = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let index = 0; index < 8; index += 1) {
    const word = Number.parseInt(seed.slice(index * 8, index * 8 + 8), 16) | 0;
    if (index % 4 === 0) a ^= word;
    else if (index % 4 === 1) b ^= word;
    else if (index % 4 === 2) c ^= word;
    else d ^= word;
    next();
  }
  for (let index = 0; index < WARMUP; index += 1) next();
  const below = (n: number): number => {
    if (!Number.isInteger(n) || n < 1 || n > WORD) throw new Error('The bound is a whole number from 1 to 2^32');
    const limit = WORD - (WORD % n);
    for (;;) {
      const word = next();
      if (word < limit) return word % n;
    }
  };
  return { next, below };
}
