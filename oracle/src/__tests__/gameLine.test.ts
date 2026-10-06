import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { GameLineInputSchema, sealGameLine, TutorContextSchema, type GameLineInput } from '../context/schema.js';
import { lineViolation, LENS_FACTS, runGameLine, GAME_LINE_MAX_TOKENS } from '../game/line.js';
import { ModelUnavailableError } from '../model/provider.js';
import { spendGuard } from '../session/spend-guard.js';
import { createApp } from '../app.js';
import { resetConfigCache } from '../env.js';

/*
 * The sealed one-line game debrief (game/line.ts, routes/game.ts). Fake provider
 * only: nothing here reaches a model, a judge or the network.
 *
 * It proves the four things the design rests on: the input carries exactly four
 * closed values and nothing else (a third strict schema that leaves the 14-field
 * conversation context alone); the model is reached only behind the switch; the
 * reply passes a deterministic check and the moderation judge, failing closed
 * for a child; and every failure is a neutral 204, never an error a child sees.
 */

vi.mock('../model/provider.js', async () => {
  const actual = await vi.importActual<typeof import('../model/provider.js')>('../model/provider.js');
  return { ...actual, complete: vi.fn(), modelConfigured: vi.fn(() => true) };
});
vi.mock('../safety/moderation.js', async () => {
  const actual = await vi.importActual<typeof import('../safety/moderation.js')>('../safety/moderation.js');
  return { ...actual, moderateTutorOutput: vi.fn() };
});

const { complete, modelConfigured } = await import('../model/provider.js');
const { moderateTutorOutput } = await import('../safety/moderation.js');

const INPUT: GameLineInput = { mentor: 'zara', locale: 'en-US', band: '6-9', lens: 'drift_patient' };
const KEY = process.env.INTERNAL_API_KEY as string;

function modelReturns(text: string, usage = { promptTokens: 400, completionTokens: 30 }) {
  vi.mocked(complete).mockResolvedValue({ text, ...usage });
}
const reply = (text: string) => JSON.stringify({ text });

beforeEach(() => {
  vi.mocked(complete).mockReset();
  vi.mocked(modelConfigured).mockReturnValue(true);
  vi.mocked(moderateTutorOutput).mockReset();
  vi.mocked(moderateTutorOutput).mockResolvedValue({ allowed: true });
  process.env.GAME_AI_DEBRIEF = 'on';
  resetConfigCache();
});

afterEach(() => {
  delete process.env.GAME_AI_DEBRIEF;
  resetConfigCache();
});

describe('GameLineInputSchema — four closed values, nothing else can travel', () => {
  it('accepts exactly mentor, locale, band and lens', () => {
    expect(GameLineInputSchema.safeParse(INPUT).success).toBe(true);
    expect(Object.keys(GameLineInputSchema.shape).sort()).toEqual(['band', 'lens', 'locale', 'mentor']);
  });

  it.each([
    ['a nickname', { nickname: 'Sofi' }],
    ['a user id', { userId: '11111111-1111-4111-8111-111111111111' }],
    ['free text', { note: 'she was sad' }],
    ['a race time', { finishMs: 93_000 }],
    ['a track', { trackId: 'glacier' }],
    ['a birth date', { birthDate: '2016-04-02' }],
  ])('rejects %s rather than dropping it', (_label, extra) => {
    expect(GameLineInputSchema.safeParse({ ...INPUT, ...extra }).success).toBe(false);
    expect(() => sealGameLine({ ...INPUT, ...extra })).toThrow(/refusing to send an invalid game line input/);
  });

  it.each([
    ['an unknown mentor', { mentor: 'bella' }],
    ['an unknown locale', { locale: 'fr-FR' }],
    ['an exact age instead of a band', { band: '8' }],
    ['an unknown lens', { lens: 'speedy' }],
  ])('rejects %s', (_label, change) => {
    expect(GameLineInputSchema.safeParse({ ...INPUT, ...change }).success).toBe(false);
  });

  it('leaves the fourteen-field conversation context exactly as it was', () => {
    expect(Object.keys(TutorContextSchema.shape)).toHaveLength(14);
    expect(Object.keys(TutorContextSchema.shape)).not.toContain('lens');
    expect(Object.keys(TutorContextSchema.shape)).not.toContain('band');
  });
});

describe('lineViolation — the deterministic check on the reply', () => {
  it.each([
    ['Your drifts were patient today. That is a good way to race.', null],
    ['You waited a long time on that turn.', null],
    ['', 'length'],
    ['x'.repeat(241), 'length'],
    ['You were 3 seconds faster.', 'digit'],
    ['A fine race — well driven.', 'dash'],
    ['One line.\nTwo lines.', 'lines'],
    ['You earned a lot of coins.', 'glossary'],
    ['Your streak is safe.', 'glossary'],
    ['I am an AI helper.', 'glossary'],
    ['That was your best lap.', 'glossary'],
    ['You are a winner.', 'glossary'],
    ['Good race. You waited. You drifted.', 'sentences'],
    ['¡Buena carrera! Esperaste en la curva.', null],
  ])('%j -> %s', (text, expected) => {
    expect(lineViolation(text)).toBe(expected);
  });
});

describe('runGameLine', () => {
  it('returns the model\'s line with what it cost, after the judge allowed it', async () => {
    modelReturns(reply('You held that drift a long while. Nice and calm.'));
    const spendBefore = spendGuard.snapshot().spentUsd;
    const line = await runGameLine(INPUT);
    expect(line?.text).toBe('You held that drift a long while. Nice and calm.');
    expect(line?.costUsd).toBeGreaterThan(0);
    expect(spendGuard.snapshot().spentUsd).toBeGreaterThan(spendBefore);
    expect(moderateTutorOutput).toHaveBeenCalledWith(expect.objectContaining({ locale: 'en-US', tier: 1, requireModelPass: true }));
  });

  it('speaks in the Mentor\'s own voice and the age register, and gives the model only the lens and the rules', async () => {
    modelReturns(reply('A calm drift. Good.'));
    await runGameLine({ ...INPUT, mentor: 'dina', locale: 'pt-BR', band: '13-17', lens: 'item_hold' });
    const [messages, options] = vi.mocked(complete).mock.calls[0]!;
    const system = messages[0]!.content;
    expect(system).toContain('Dina');
    expect(system).toContain('Brazilian Portuguese');
    expect(system).toContain('teenager');
    expect(system).toContain(LENS_FACTS.item_hold);
    expect(messages).toHaveLength(2);
    expect(messages[1]!.content).toBe('Write the line now.');
    expect(options).toMatchObject({ maxTokens: GAME_LINE_MAX_TOKENS, label: 'game-line' });
    expect(GAME_LINE_MAX_TOKENS).toBeLessThanOrEqual(120);
    expect(JSON.stringify(messages)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it('every lens has a fact and the register differs by band', async () => {
    expect(Object.keys(LENS_FACTS).sort()).toEqual(['drift_early', 'drift_patient', 'item_hold', 'neutral', 'steady', 'swingy']);
    modelReturns(reply('Fine racing.'));
    await runGameLine({ ...INPUT, band: '6-9' });
    await runGameLine({ ...INPUT, band: 'adult' });
    const systems = vi.mocked(complete).mock.calls.map((c) => c[0][0]!.content);
    expect(systems[0]).toContain('young child');
    expect(systems[1]).toContain('adult');
    expect(systems[0]).not.toBe(systems[1]);
    // Adults may run without the judge; every minor band requires it, and the youngest band uses the strictest tier.
    expect(vi.mocked(moderateTutorOutput).mock.calls.map((c) => [c[0].requireModelPass, c[0].tier])).toEqual([[true, 1], [false, 3]]);
  });

  it.each([
    ['not JSON', 'You did well.'],
    ['an extra key', JSON.stringify({ text: 'Nice.', mood: 'happy' })],
    ['a non-string text', JSON.stringify({ text: 12 })],
    ['an array', '["Nice."]'],
    ['a number in the line', reply('That took 93 seconds.')],
    ['a banned word', reply('Your streak is safe.')],
    ['three sentences', reply('Good. Calm. Steady.')],
  ])('answers null for %s (the authored line stays)', async (_label, raw) => {
    modelReturns(raw);
    expect(await runGameLine(INPUT)).toBeNull();
    expect(moderateTutorOutput).not.toHaveBeenCalled();
  });

  it('answers null when the model is unavailable or returns nothing, and when the judge refuses or is down', async () => {
    vi.mocked(complete).mockRejectedValue(new ModelUnavailableError('down'));
    expect(await runGameLine(INPUT)).toBeNull();
    modelReturns(reply('A calm drift.'));
    vi.mocked(moderateTutorOutput).mockResolvedValue({ allowed: false, reason: 'unsafe_content', detail: 'x' });
    expect(await runGameLine(INPUT)).toBeNull();
    vi.mocked(moderateTutorOutput).mockResolvedValue({ allowed: false, reason: 'moderator_unavailable', detail: 'x' });
    expect(await runGameLine(INPUT)).toBeNull();
  });

  it('records the spend even when the reply is then refused', async () => {
    modelReturns(reply('That took 93 seconds.'), { promptTokens: 1000, completionTokens: 100 });
    const before = spendGuard.snapshot().spentUsd;
    expect(await runGameLine(INPUT)).toBeNull();
    expect(spendGuard.snapshot().spentUsd).toBeGreaterThan(before);
  });

  it('refuses an input that is not sealed before it can reach the model', async () => {
    await expect(runGameLine({ ...INPUT, nickname: 'Sofi' })).rejects.toThrow(/refusing to send/);
    expect(complete).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/game/line', () => {
  const post = (body: unknown, key: string | null = KEY) => {
    const req = request(createApp()).post('/api/v1/game/line');
    return (key === null ? req : req.set('x-internal-api-key', key)).send(body as object);
  };

  it('needs the internal key', async () => {
    expect((await post(INPUT, null)).status).toBe(401);
    expect((await post(INPUT, 'wrong-key-0123456789')).status).toBe(401);
    expect(complete).not.toHaveBeenCalled();
  });

  it('answers the line and its cost behind the switch', async () => {
    modelReturns(reply('You held that drift a long while.'));
    const res = await post(INPUT);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ text: 'You held that drift a long while.', costUsd: expect.any(Number) });
    expect(res.body.error).toBeNull();
  });

  it('is a 204 with nothing sent to any model while the switch is off, or no model is configured', async () => {
    process.env.GAME_AI_DEBRIEF = 'off';
    resetConfigCache();
    expect((await post(INPUT)).status).toBe(204);
    process.env.GAME_AI_DEBRIEF = 'on';
    resetConfigCache();
    vi.mocked(modelConfigured).mockReturnValue(false);
    expect((await post(INPUT)).status).toBe(204);
    expect(complete).not.toHaveBeenCalled();
  });

  it('is off by default: an unset switch is off', async () => {
    delete process.env.GAME_AI_DEBRIEF;
    resetConfigCache();
    expect((await post(INPUT)).status).toBe(204);
    expect(complete).not.toHaveBeenCalled();
  });

  it('refuses a body with anything beyond the four values (400), before any switch or model', async () => {
    const res = await post({ ...INPUT, nickname: 'Sofi' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect((await post({})).status).toBe(400);
    expect(complete).not.toHaveBeenCalled();
  });

  it('is a 204 on a refused or failed reply, never an error', async () => {
    modelReturns(reply('A calm drift.'));
    vi.mocked(moderateTutorOutput).mockResolvedValue({ allowed: false, reason: 'unsafe_content', detail: 'x' });
    expect((await post(INPUT)).status).toBe(204);
    vi.mocked(complete).mockRejectedValue(new Error('boom'));
    expect((await post(INPUT)).status).toBe(204);
  });
});

describe('the contract and the parity gate read this service', () => {
  it('spells the lens keys and bands the same way as Core (the parity gate pins it too)', () => {
    const source = readFileSync(new URL('../context/schema.ts', import.meta.url), 'utf8');
    expect(source).toContain("export const GAME_LENS_KEYS = ['item_hold', 'drift_patient', 'drift_early', 'steady', 'swingy', 'neutral'] as const;");
    expect(source).toContain("export const GAME_BANDS = ['6-9', '10-12', '13-17', 'adult'] as const;");
  });
});
