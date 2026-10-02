import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadLessonClientDocument } from '../../lessonDocument';
import { HORIZONTE_FIXTURES } from '../fixtures';
import { horizonteFixtureDocument } from '../previewDocument';
import { HZ_LOCALES } from './boardContract';

const horizonteDir = resolve(__dirname, '..');
// A pack ships a generated contract; shared primitives such as plano do not.
const packs = readdirSync(horizonteDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && existsSync(resolve(horizonteDir, entry.name, 'contract.generated.ts'))).map((entry) => entry.name);
const auditOf = (pack: string): Array<{ fixture: string; age: string }> => {
  const file = resolve(horizonteDir, pack, 'audit.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
};

describe('every pack keeps its fixtures, audit entries and preview documents in step', () => {
  it('registers a fixture list for every pack folder', () => {
    expect(packs.length).toBeGreaterThanOrEqual(18);
    for (const pack of packs) expect(Object.hasOwn(HORIZONTE_FIXTURES, pack), `${pack}: fixtures.ts registers ${pack}`).toBe(true);
  });

  it('lists every fixture of a pack in its audit.json, and no unknown one', () => {
    for (const pack of packs) {
      const ids = HORIZONTE_FIXTURES[pack]!.map((fixture) => fixture.id).sort();
      expect(auditOf(pack).map((entry) => entry.fixture).sort(), `${pack}: audit.json lists each fixture once`).toEqual(ids);
    }
  });

  it('loads each fixture as a valid lesson in all three locales, at its own age only', () => {
    for (const pack of packs) {
      for (const fixture of HORIZONTE_FIXTURES[pack]!) {
        for (const locale of HZ_LOCALES) {
          const raw = horizonteFixtureDocument(pack, fixture.id, locale);
          expect(raw, `${pack}/${fixture.id}`).not.toBeNull();
          expect(loadLessonClientDocument(raw).status, `${pack}/${fixture.id} (${locale})`).toBe('ready');
        }
      }
    }
  });

  it('keeps the audit lane module in step with the audit files', () => {
    const script = "const m = await import('./scripts/audits/lanes/horizonte.mjs'); console.log(JSON.stringify({ entries: m.horizonteAuditEntries(), states: m.states.length }));";
    const frontend = resolve(horizonteDir, '../../../..');
    const lane = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: frontend, encoding: 'utf8' })) as { entries: Array<{ pack: string; fixture: string; age: string }>; states: number };
    const expected = packs.flatMap((pack) => auditOf(pack).map((entry) => `${pack}:${entry.fixture}@${entry.age}`)).sort();
    expect(lane.entries.map((entry) => `${entry.pack}:${entry.fixture}@${entry.age}`).sort()).toEqual(expected);
    expect(lane.states).toBe(expected.length);
  });
});
