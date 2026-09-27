import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSTRUMENTED_EVENTS, RETIRED_EVENTS, bandOf } from './usageShared';

/*
 * The instrumentation card's whole value is that it can name an event that has
 * NEVER fired — which requires a list of what we expected, held apart from the
 * data. A list held apart from the data is a list that can drift, and a short
 * list makes the card silently clean: `signup_complete` would simply not
 * appear, and the absence it exists to surface would be invisible again.
 *
 * So the copy is checked against the schema it copies, and against the
 * server's own banding, rather than trusted.
 */

const MIGRATIONS = join(process.cwd(), '..', 'database', 'migrations');

/** The LAST `learning_events_event_check` in migration order — the live one. */
function schemaEvents(): string[] {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  let latest: string | null = null;
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    // Both the CREATE TABLE form and the later ALTER ... ADD CONSTRAINT form.
    const match = /check \(event in \(([\s\S]*?)\)\)/i.exec(sql);
    if (match?.[1]) latest = match[1];
  }
  if (latest === null) throw new Error('No learning_events event CHECK found in database/migrations');
  return [...latest.matchAll(/'([a-z_]+)'/g)].flatMap((m) => (m[1] ? [m[1]] : []));
}

describe('INSTRUMENTED_EVENTS mirrors the database CHECK constraint', () => {
  it('lists exactly the events the schema allows', () => {
    const schema = [...schemaEvents()].sort();
    // RETIRED_EVENTS are permitted by the CHECK but no longer emitted (OD-20);
    // they are neither expected to fire nor allowed to drift silently.
    const mirrored = [...INSTRUMENTED_EVENTS, ...RETIRED_EVENTS].sort();

    // Named separately so a failure says WHICH direction drifted: a missing
    // member makes the health card under-report, an extra one makes it
    // permanently accuse a healthy platform of a silent event.
    expect(schema.filter((e) => !mirrored.includes(e as never))).toEqual([]);
    expect(mirrored.filter((e) => !schema.includes(e))).toEqual([]);
  });

  it('carries no game vocabulary, which migration 0033 removed', () => {
    expect(INSTRUMENTED_EVENTS.filter((e) => e.startsWith('game_'))).toEqual([]);
  });

  it('has no duplicates', () => {
    expect(new Set(INSTRUMENTED_EVENTS).size).toBe(INSTRUMENTED_EVENTS.length);
  });

  it('never expects a retired event to fire', () => {
    expect(INSTRUMENTED_EVENTS.filter((e) => (RETIRED_EVENTS as readonly string[]).includes(e))).toEqual([]);
  });
});

describe('bandOf agrees with the server', () => {
  /*
   * Mirrors `bandForRole` in backend/src/services/audience.ts. A disagreement
   * puts a session in one bucket on the server and another in the browser, and
   * surfaces as a total that does not add up — expensive to find, trivial to
   * prevent.
   */
  it('bands every role the schema allows', () => {
    expect(bandOf('anon')).toBe('anonymous');
    expect(bandOf('universal')).toBe('registered');
    expect(bandOf('parent')).toBe('registered');
    expect(bandOf('kid')).toBe('registered');
    expect(bandOf('bigfounder')).toBe('registered');
    expect(bandOf('admin')).toBe('staff');
    expect(bandOf('superadmin')).toBe('staff');
  });

  it('treats an unknown role as registered rather than dropping it', () => {
    expect(bandOf('something_new')).toBe('registered');
  });
});
