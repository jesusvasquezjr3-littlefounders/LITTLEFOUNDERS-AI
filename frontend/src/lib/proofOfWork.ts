/*
 * The piece of work Core asks for before it sends a code by email (backend/src/services/challenge.ts):
 * find a number that, hashed with Core's challenge, starts with enough zero bits. It takes a browser
 * about a tenth of a second and asks nothing of the person; it makes asking for codes by the
 * thousand cost a script real computing time.
 *
 * The hashing is done here, in plain code, because the browser's own SHA-256 answers through a
 * promise and tens of thousands of promises are far slower than the arithmetic itself. The search
 * pauses every few thousand tries so the page never freezes.
 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const W = new Uint32Array(64);

/** The first 32 bits of the SHA-256 of an ASCII text. Enough to count leading zero bits up to 32. */
function sha256Head(text: string): number {
  const length = text.length;
  const padded = new Uint8Array((((length + 8) >> 6) + 1) << 6);

  for (let i = 0; i < length; i++) padded[i] = text.charCodeAt(i) & 0x7f;

  padded[length] = 0x80;
  new DataView(padded.buffer).setUint32(padded.length - 4, length * 8);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const at = offset + i * 4;

      W[i] = ((padded[at] ?? 0) << 24) | ((padded[at + 1] ?? 0) << 16) | ((padded[at + 2] ?? 0) << 8) | (padded[at + 3] ?? 0);
    }

    for (let i = 16; i < 64; i++) {
      const a = W[i - 15] ?? 0;
      const b = W[i - 2] ?? 0;
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);

      W[i] = ((W[i - 16] ?? 0) + s0 + (W[i - 7] ?? 0) + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (h + s1 + ((e & f) ^ (~e & g)) + (K[i] ?? 0) + (W[i] ?? 0)) | 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;

      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return h0 >>> 0;
}

const TRIES_PER_SLICE = 4000;

/** Finds the solution of a challenge: a short text of digits and lower-case letters. */
export async function solveChallenge(challenge: string, difficultyBits: number): Promise<string> {
  const bits = Math.min(Math.max(difficultyBits, 0), 30);

  for (let attempt = 0; ; attempt++) {
    const solution = attempt.toString(36);

    // Counting the zero bits at the front of the first 32 bits.
    if (Math.clz32(sha256Head(`${challenge}.${solution}`)) >= bits) return solution;

    if (attempt % TRIES_PER_SLICE === TRIES_PER_SLICE - 1) await new Promise((resolve) => { setTimeout(resolve, 0); });
  }
}
