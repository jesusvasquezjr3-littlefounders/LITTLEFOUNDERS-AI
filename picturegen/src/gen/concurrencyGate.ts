// Counting semaphore serializing concurrent access to a scarce external
// resource (DashScope's image-generation endpoint). Multiple Forge workers
// call Prism concurrently and each retries independently on 429 with its own
// backoff ladder (backoff.ts) — without a shared gate, N concurrent callers
// sustain pressure against the SAME per-minute quota, so the ladder never
// gets a clean window to recover in. Capping in-flight calls here lets it work.

export interface ConcurrencyGate {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export function createConcurrencyGate(limit: number): ConcurrencyGate {
  let active = 0;
  const queue: Array<() => void> = [];

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      const next = queue.shift();
      if (next) next();
    }
  }

  return { run };
}
