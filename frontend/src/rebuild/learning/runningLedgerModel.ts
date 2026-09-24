export interface LedgerEntry { id: string; amount: number }
export interface LedgerRow extends LedgerEntry { balance: number }
export interface LedgerSnapshot { rows: LedgerRow[]; balance: number; minimum: number; maximum: number }

/** Integer-only running balance for a bounded interactive ledger. */
export function runningLedger(initial: number, entries: readonly LedgerEntry[], limit = 8): LedgerSnapshot | null {
  if (!Number.isSafeInteger(initial) || Math.abs(initial) > 1_000_000 || !Number.isSafeInteger(limit)
    || limit < 1 || limit > 80 || entries.length > limit) return null;
  const ids = new Set<string>();
  let balance = initial;
  let minimum = Math.min(0, initial);
  let maximum = Math.max(0, initial);
  const rows: LedgerRow[] = [];
  for (const entry of entries) {
    if (!/^[a-z0-9][a-z0-9._:-]{2,100}$/.test(entry.id) || ids.has(entry.id)
      || !Number.isSafeInteger(entry.amount) || entry.amount === 0 || Math.abs(entry.amount) > 1_000_000) return null;
    ids.add(entry.id);
    balance += entry.amount;
    if (!Number.isSafeInteger(balance) || Math.abs(balance) > 1_000_000) return null;
    minimum = Math.min(minimum, balance);
    maximum = Math.max(maximum, balance);
    rows.push({ ...entry, balance });
  }
  return { rows, balance, minimum, maximum };
}
