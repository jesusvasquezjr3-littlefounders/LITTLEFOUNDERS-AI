/** Runs `tasks` with at most `concurrency` in flight; each task's own errors are caught by the caller. */
export async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runNext(): Promise<void> {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;
    const item = items[index];
    if (item !== undefined) {
      results[index] = await worker(item, index);
    }
    return runNext();
  }

  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext());
  await Promise.all(lanes);
  return results;
}
