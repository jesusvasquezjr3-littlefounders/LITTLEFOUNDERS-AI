import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sampleReport } from './__fixtures__/fakes';
import {
  KR_SAVE_MAX_BYTES, KRV1_MANIFEST, parseGameMessage, parseHostMessage, parseStartSpec, reportBody, toGameLocale,
  type GameMessage, type HostMessage,
} from './protocol';

/*
 * The host's copy of the kr.v1 contract is pinned three ways: the manifest
 * constant equals the contract's JSON file byte for byte in content, every
 * validator accepts exactly the manifest's field set, and every mutation the
 * contract names (extra field, wrong type, out-of-range number, unknown type,
 * wrong version) is refused rather than coerced.
 */

const MANIFEST_FILE = resolve(__dirname, '../../../../docs/games/krv1.manifest.json');

describe('KRV1_MANIFEST', () => {
  it('is identical in content to docs/games/krv1.manifest.json', () => {
    expect(JSON.parse(JSON.stringify(KRV1_MANIFEST))).toEqual(JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')));
  });
});

const start = { mode: 'single', trackId: 'jungleNeck', character: 'rho', speedClass: '100cc' };
const init = { t: 'lf.init', v: 1, sessionRef: 'ref_abcdefgh', locale: 'es', mentor: 'dina', muted: false, reducedMotion: true, startLabel: 'Toca para empezar', save: { revision: 0, data: null }, start };

const hostSamples: Record<string, Record<string, unknown>> = {
  'lf.init': init,
  'lf.start': { t: 'lf.start', v: 1, start },
  'lf.pause': { t: 'lf.pause', v: 1 },
  'lf.resume': { t: 'lf.resume', v: 1 },
  'lf.mute': { t: 'lf.mute', v: 1, muted: true },
  'lf.end': { t: 'lf.end', v: 1 },
};
const gameSamples: Record<string, Record<string, unknown>> = {
  'kr.ready': { t: 'kr.ready', v: 1, build: 'abc123' },
  'kr.runStarted': { t: 'kr.runStarted', v: 1, runKey: 'run-key-0001', mode: 'timeTrial', trackId: 'glacier', character: 'liruf' },
  'kr.runFinished': { t: 'kr.runFinished', v: 1, ...sampleReport() },
  'kr.runEnded': { t: 'kr.runEnded', v: 1, runKey: 'run-key-0001' },
  'kr.save': { t: 'kr.save', v: 1, revision: 4, data: { hints: [1, 2], nested: { a: true } } },
  'kr.pauseRequested': { t: 'kr.pauseRequested', v: 1 },
  'kr.exitRequested': { t: 'kr.exitRequested', v: 1 },
  'kr.error': { t: 'kr.error', v: 1, code: 'webgl' },
};

describe('the validators follow the manifest', () => {
  it('has a sample for every message of the contract, and no more', () => {
    expect(Object.keys(hostSamples).sort()).toEqual(Object.keys(KRV1_MANIFEST.hostToGame).sort());
    expect(Object.keys(gameSamples).sort()).toEqual(Object.keys(KRV1_MANIFEST.gameToHost).sort());
  });

  it.each(Object.entries(hostSamples))('accepts %s with exactly the manifest fields', (type, sample) => {
    expect(Object.keys(sample).filter((key) => key !== 't' && key !== 'v').sort()).toEqual([...KRV1_MANIFEST.hostToGame[type as keyof typeof KRV1_MANIFEST.hostToGame]].sort());
    expect(parseHostMessage(sample)).toEqual({ ok: true, value: sample });
  });

  it.each(Object.entries(gameSamples))('accepts %s with exactly the manifest fields', (type, sample) => {
    expect(Object.keys(sample).filter((key) => key !== 't' && key !== 'v').sort()).toEqual([...KRV1_MANIFEST.gameToHost[type as keyof typeof KRV1_MANIFEST.gameToHost]].sort());
    expect(parseGameMessage(sample)).toEqual({ ok: true, value: sample });
  });

  it('keeps the nested field lists in step with the manifest', () => {
    expect(Object.keys(start).sort()).toEqual([...KRV1_MANIFEST.startSpec].sort());
    const report = sampleReport();
    expect(Object.keys(report.lens).sort()).toEqual([...KRV1_MANIFEST.lens].sort());
    expect(Object.keys(report.lens.driftReleases).sort()).toEqual([...KRV1_MANIFEST.driftReleases].sort());
  });

  it.each([...Object.entries(hostSamples)])('refuses %s with an extra field, a missing field, a wrong version or no type', (type, sample) => {
    expect(parseHostMessage({ ...sample, extra: 1 }).ok).toBe(false);
    expect(parseHostMessage({ ...sample, v: 2 }).ok).toBe(false);
    expect(parseHostMessage({ ...sample, v: '1' }).ok).toBe(false);
    const { t: _t, ...noType } = sample;
    expect(parseHostMessage(noType).ok).toBe(false);
    for (const field of Object.keys(sample).filter((key) => key !== 't' && key !== 'v')) {
      const { [field]: _gone, ...rest } = sample;
      expect(parseHostMessage(rest).ok, `${type} without ${field}`).toBe(false);
    }
  });

  it.each([...Object.entries(gameSamples)])('refuses %s with an extra field, a missing field, a wrong version or no type', (type, sample) => {
    expect(parseGameMessage({ ...sample, extra: 1 }).ok).toBe(false);
    expect(parseGameMessage({ ...sample, v: 2 }).ok).toBe(false);
    const { t: _t, ...noType } = sample;
    expect(parseGameMessage(noType).ok).toBe(false);
    for (const field of Object.keys(sample).filter((key) => key !== 't' && key !== 'v')) {
      const { [field]: _gone, ...rest } = sample;
      expect(parseGameMessage(rest).ok, `${type} without ${field}`).toBe(false);
    }
  });
});

describe('unknown and malformed envelopes', () => {
  it.each([null, undefined, 3, 'kr.ready', [], [{ t: 'kr.ready', v: 1 }]])('refuses %j', (raw) => {
    expect(parseGameMessage(raw).ok).toBe(false);
    expect(parseHostMessage(raw).ok).toBe(false);
  });

  it('refuses a type from the other direction and a type the contract does not have', () => {
    expect(parseGameMessage(hostSamples['lf.pause']).ok).toBe(false);
    expect(parseHostMessage(gameSamples['kr.ready']).ok).toBe(false);
    expect(parseGameMessage({ t: 'kr.cheat', v: 1 }).ok).toBe(false);
    expect(parseGameMessage({ t: 'lf.hello', v: 1 }).ok).toBe(false);
  });

  it('refuses a class instance posing as a plain object', () => {
    class Impostor { t = 'kr.pauseRequested'; v = 1; }
    expect(parseGameMessage(new Impostor()).ok).toBe(false);
  });
});

describe('values are never coerced', () => {
  const finished = gameSamples['kr.runFinished']!;
  const lens = (patch: Record<string, unknown>) => ({ ...sampleReport().lens, ...patch });
  const refused: [string, Record<string, unknown>][] = [
    ['a string finishMs', { ...finished, finishMs: '130000' }],
    ['finishMs 0', { ...finished, finishMs: 0 }],
    ['finishMs over 30 minutes', { ...finished, finishMs: 1_800_001 }],
    ['a fractional finishMs', { ...finished, finishMs: 1000.5 }],
    ['NaN', { ...finished, finishMs: NaN }],
    ['Infinity', { ...finished, finishMs: Infinity }],
    ['a rank of 9', { ...finished, rank: 9 }],
    ['a rank of 0', { ...finished, rank: 0 }],
    ['finished: false', { ...finished, finished: false }],
    ['finished: "true"', { ...finished, finished: 'true' }],
    ['six laps', { ...finished, lapMs: [1, 2, 3, 4, 5, 6] }],
    ['no laps', { ...finished, lapMs: [] }],
    ['a lap that is not an integer', { ...finished, lapMs: [44_000.5] }],
    ['a negative lap', { ...finished, lapMs: [-1] }],
    ['an unknown track', { ...finished, trackId: 'rainbowRoad' }],
    ['practice as a recorded mode', { ...finished, mode: 'practice' }],
    ['an unknown speed class', { ...finished, speedClass: '300cc' }],
    ['a 25 character kart body', { ...finished, kartBody: 'x'.repeat(25) }],
    ['an empty kart body', { ...finished, kartBody: '' }],
    ['a 7 character run key', { ...finished, runKey: 'short-1' }],
    ['a 65 character run key', { ...finished, runKey: 'k'.repeat(65) }],
    ['more than 200 boxes passed', { ...finished, lens: lens({ boxesPassedWhileHolding: 201 }) }],
    ['negative recoveries', { ...finished, lens: lens({ recoveries: -1 }) }],
    ['itemHoldMs over 30 minutes', { ...finished, lens: lens({ itemHoldMs: 1_800_001 }) }],
    ['a lens field the contract does not have', { ...finished, lens: lens({ stealth: 1 }) }],
    ['a missing drift tier', { ...finished, lens: lens({ driftReleases: { t0: 0, t1: 0, t2: 0 } }) }],
    ['an extra drift tier', { ...finished, lens: lens({ driftReleases: { t0: 0, t1: 0, t2: 0, t3: 0, t4: 0 } }) }],
    ['a string drift tier', { ...finished, lens: lens({ driftReleases: { t0: '1', t1: 0, t2: 0, t3: 0 } }) }],
  ];
  it.each(refused)('refuses %s', (_label, message) => {
    expect(parseGameMessage(message).ok).toBe(false);
  });

  it('refuses a run report in the wrong place of the lens', () => {
    expect(parseGameMessage({ ...finished, lens: null }).ok).toBe(false);
    expect(parseGameMessage({ ...finished, lens: 'steady' }).ok).toBe(false);
  });

  it('bounds the small strings of the handshake', () => {
    expect(parseGameMessage({ t: 'kr.ready', v: 1, build: '' }).ok).toBe(false);
    expect(parseGameMessage({ t: 'kr.ready', v: 1, build: 'b'.repeat(41) }).ok).toBe(false);
    expect(parseGameMessage({ t: 'kr.ready', v: 1, build: 'b'.repeat(40) }).ok).toBe(true);
    expect(parseGameMessage({ t: 'kr.error', v: 1, code: 'meltdown' }).ok).toBe(false);
  });

  it('bounds kr.save: an object only, at most 64 KB, and only data that serializes', () => {
    expect(parseGameMessage({ t: 'kr.save', v: 1, revision: 1, data: [] }).ok).toBe(false);
    expect(parseGameMessage({ t: 'kr.save', v: 1, revision: 1, data: null }).ok).toBe(false);
    expect(parseGameMessage({ t: 'kr.save', v: 1, revision: -1, data: {} }).ok).toBe(false);
    expect(parseGameMessage({ t: 'kr.save', v: 1, revision: 1.5, data: {} }).ok).toBe(false);
    expect(parseGameMessage({ t: 'kr.save', v: 1, revision: 1, data: { blob: 'x'.repeat(KR_SAVE_MAX_BYTES) } }).ok).toBe(false);
    expect(parseGameMessage({ t: 'kr.save', v: 1, revision: 1, data: { blob: 'x'.repeat(KR_SAVE_MAX_BYTES - 64) } }).ok).toBe(true);
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(parseGameMessage({ t: 'kr.save', v: 1, revision: 1, data: cycle }).ok).toBe(false);
  });

  const initRefused: [string, Record<string, unknown>][] = [
    ['a short session reference', { ...init, sessionRef: 'short' }],
    ['a session reference with a space', { ...init, sessionRef: 'ref abcdefgh' }],
    ['a locale in platform form', { ...init, locale: 'es-MX' }],
    ['an unknown mentor', { ...init, mentor: 'tutor' }],
    ['a string muted flag', { ...init, muted: 'false' }],
    ['an empty start label', { ...init, startLabel: '' }],
    ['a 25 character start label', { ...init, startLabel: 'x'.repeat(25) }],
    ['a negative save revision', { ...init, save: { revision: -1, data: null } }],
    ['an array save', { ...init, save: { revision: 0, data: [] } }],
    ['an extra save field', { ...init, save: { revision: 0, data: null, etag: 'x' } }],
    ['a start spec with an extra field', { ...init, start: { ...start, laps: 9 } }],
    ['an unknown speed class', { ...init, start: { ...start, speedClass: '999cc' } }],
  ];
  it.each(initRefused)('refuses lf.init with %s', (_label, message) => {
    expect(parseHostMessage(message).ok).toBe(false);
  });

  it('accepts a 24 character start label and counts code points, not UTF-16 units', () => {
    expect(parseHostMessage({ ...init, startLabel: 'x'.repeat(24) }).ok).toBe(true);
    expect(parseHostMessage({ ...init, startLabel: '\u{1F3CE}'.repeat(24) }).ok).toBe(true);
    expect(parseHostMessage({ ...init, startLabel: '\u{1F3CE}'.repeat(25) }).ok).toBe(false);
  });

  it('accepts the three speed classes and all four modes in a start spec, and nothing else', () => {
    for (const speedClass of ['100cc', '150cc', '200cc']) expect(parseStartSpec({ ...start, speedClass }).ok).toBe(true);
    for (const mode of ['single', 'timeTrial', 'practice']) expect(parseStartSpec({ ...start, mode }).ok).toBe(true);
    expect(parseStartSpec({ ...start, mode: 'grandPrix' }).ok).toBe(false);
    expect(parseStartSpec(null).ok).toBe(false);
  });
});

describe('helpers', () => {
  it('maps the platform locales to the game locales', () => {
    expect(toGameLocale('en-US')).toBe('en');
    expect(toGameLocale('es-MX')).toBe('es');
    expect(toGameLocale('pt-BR')).toBe('pt');
  });

  it('strips the envelope from a run report so Core receives the contract body only', () => {
    const parsed = parseGameMessage(gameSamples['kr.runFinished']);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const body = reportBody(parsed.value as Extract<GameMessage, { t: 'kr.runFinished' }>);
    expect(body).toEqual(sampleReport());
    expect(body).not.toHaveProperty('t');
    expect(body).not.toHaveProperty('v');
  });

  it('copies the laps so a later mutation cannot reach the validated report', () => {
    const raw = { ...gameSamples['kr.runFinished'], lapMs: [44_000, 42_000] } as Record<string, unknown>;
    const parsed = parseGameMessage(raw);
    expect(parsed.ok).toBe(true);
    (raw.lapMs as number[]).push(99);
    if (parsed.ok) expect((parsed.value as unknown as { lapMs: number[] }).lapMs).toEqual([44_000, 42_000]);
  });

  it('is typed so a host message cannot be sent as a game message', () => {
    const message: HostMessage = { t: 'lf.pause', v: 1 };
    expect(parseHostMessage(message).ok).toBe(true);
  });
});
