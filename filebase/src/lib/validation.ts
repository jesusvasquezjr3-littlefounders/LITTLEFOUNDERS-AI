/*
 * Every filesystem path filebase ever touches is built from these three
 * validated segments. A traversal payload (`..`, `/`, encoded variants)
 * cannot satisfy any of these patterns, so it is rejected before it ever
 * reaches `path.join()` — this IS the traversal defense, not a courtesy
 * check on top of one.
 */
export const BUCKET_RE = /^[a-z0-9-]{3,40}$/;
export const HASH_RE = /^[a-f0-9]{64}$/;
export const EXT_RE = /^[a-z0-9]{2,5}$/;

export function isValidBucket(value: string): boolean {
  return BUCKET_RE.test(value);
}

export function isValidHash(value: string): boolean {
  return HASH_RE.test(value);
}

export function isValidExt(value: string): boolean {
  return EXT_RE.test(value);
}

/**
 * Splits a `:file` route param (`"<hash>.<ext>"`) into its parts and
 * validates both halves. Returns null if the shape or characters are wrong
 * — callers must treat null as "reject the request", never as "not found".
 */
/** Express route params can type as `string | string[]` for repeated segments. */
export function asParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function parseHashExt(file: string): { hash: string; ext: string } | null {
  const dot = file.lastIndexOf('.');
  if (dot <= 0 || dot === file.length - 1) return null;
  const hash = file.slice(0, dot);
  const ext = file.slice(dot + 1);
  if (!isValidHash(hash) || !isValidExt(ext)) return null;
  return { hash, ext };
}
