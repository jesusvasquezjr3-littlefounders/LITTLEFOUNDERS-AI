import { z } from 'zod';

const PREFIX = 'lf.lesson.checkpoint.v2:';
const RETIRED_PREFIX = 'lf.lesson.checkpoint.v1:';
const schema = z.object({ runId: z.uuid().nullable(), document: z.string().nullable() }).strict();
export type LessonRunCheckpoint = z.infer<typeof schema>;

export function newCheckpoint(): LessonRunCheckpoint {
  return { runId: null, document: null };
}

export function checkpointKey(userId: string, lessonId: string): string {
  return PREFIX + encodeURIComponent(userId) + ':' + encodeURIComponent(lessonId);
}

/** Tab-local run recovery stores only opaque run/document ids, never answers or attempt tokens. */
export function readCheckpoint(key: string): LessonRunCheckpoint {
  try {
    const parsed = schema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? 'null'));
    if (parsed.success && parsed.data.document?.startsWith('v2:')) return parsed.data;
  } catch { /* The in-memory run works when storage is unavailable. */ }
  return newCheckpoint();
}

export function writeCheckpoint(key: string, value: LessonRunCheckpoint): void {
  try { sessionStorage.setItem(key, JSON.stringify(schema.parse(value))); } catch { /* Best-effort recovery. */ }
}

/** Identity changes also clear retired checkpoints on shared devices. */
export function clearLessonCheckpoints(): void {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PREFIX) || key.startsWith(RETIRED_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage may be disabled. */ }
}
