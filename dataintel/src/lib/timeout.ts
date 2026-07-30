/**
 * Races a promise against a deadline, rejecting if it doesn't settle in
 * time. Needed because node-redis's `isOpen` stays true for the entire
 * reconnect-retry loop during a live outage (it only ever flips false
 * before the first connect, or once reconnection is permanently abandoned)
 * — so a hung command's promise otherwise never resolves OR rejects, and
 * callers relying on `.catch()` (rate-limit fail-open, cache best-effort)
 * never trigger.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Redis command timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
