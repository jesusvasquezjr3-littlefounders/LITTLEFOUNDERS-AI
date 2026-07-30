import { randomUUID } from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { getConfig } from '../env.js';
import { exec, execute, initDb } from '../db/duckdb.js';
import {
  getGameBreakdown,
  getGameCompletion,
  getGameDimensionCapabilities,
  getGameFunnel,
  getGamesVsLessons,
} from '../services/games.js';

/*
 * The Arcade analytics SURFACE — service + routes — against a real seeded
 * DuckDB.
 *
 * This file is the regression test for the defect it was written for: the
 * five game query builders in `db/queries.ts` had no importer outside their
 * own test, so every assertion below fails against the pre-fix tree — the
 * service module does not resolve and each route falls through to the app's
 * catch-all 404.
 *
 * Every number is derived by hand from the seed. A route that merely responds
 * proves nothing: the two defects this warehouse's history records (a metric
 * interpolated as a column name, and a LIMIT applied before the ranking value
 * existed) both produced endpoints that answered 200 with wrong numbers.
 */

const KEY = getConfig().INTERNAL_API_KEY;
const auth = (req: request.Test): request.Test =>
  req.set('x-internal-api-key', KEY);

const U1 = randomUUID(); // opens, starts, completes, then starts a 2nd play
const U2 = randomUUID(); // opens, starts, never completes
const U3 = randomUUID(); // opens the hub only
const U4 = randomUUID(); // starts + completes with NO open (deep link)
const U5 = randomUUID(); // lessons only

const SESSIONS: Record<string, string> = {
  [U1]: randomUUID(),
  [U2]: randomUUID(),
  [U3]: randomUUID(),
  [U4]: randomUUID(),
  [U5]: randomUUID(),
};

let nextEventId = 1;

async function seed(
  userId: string,
  eventType: string,
  hoursAgo: number,
  value: number | null = null,
): Promise<void> {
  await execute(
    `INSERT INTO fact_events (event_id, user_id, session_id, event_type, value, created_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP - INTERVAL (?) HOUR)`,
    nextEventId++,
    userId,
    SESSIONS[userId] ?? null,
    eventType,
    value,
    hoursAgo,
  );
}

beforeAll(async () => {
  await initDb();

  await seed(U1, 'game_open', 72);
  await seed(U1, 'game_start', 71);
  await seed(U1, 'game_complete', 70, 90);
  await seed(U1, 'game_start', 60); // second play, abandoned

  await seed(U2, 'game_open', 50);
  await seed(U2, 'game_start', 49);

  await seed(U3, 'game_open', 30);

  await seed(U4, 'game_start', 20);
  await seed(U4, 'game_complete', 19, 30);

  await seed(U5, 'course_open', 5);
  await seed(U5, 'lesson_start', 4);
  await seed(U5, 'lesson_complete', 3, 70);
});

// ── Auth ─────────────────────────────────────────────────────────────

describe('auth guard covers the new game routes', () => {
  it('returns 401 without x-internal-api-key', async () => {
    const res = await request(createApp()).get('/api/v1/intel/games/funnel');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ── GET /games/funnel ────────────────────────────────────────────────

describe('GET /api/v1/intel/games/funnel', () => {
  it('returns the three ordered steps with exact user counts', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/games/funnel?windowDays=7'),
    );

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();

    // opened  = U1, U2, U3 -> 3   (U4 never opened the hub)
    // started = U1, U2     -> 2   (U4 has no open to progress from)
    // done    = U1         -> 1
    expect(res.body.data).toEqual([
      {
        step: 'game_open',
        stepOrder: 1,
        users: 3,
        pctOfTop: 100,
        pctOfPrevious: null,
      },
      {
        step: 'game_start',
        stepOrder: 2,
        users: 2,
        pctOfTop: 66.67,
        pctOfPrevious: 66.67,
      },
      {
        step: 'game_complete',
        stepOrder: 3,
        users: 1,
        pctOfTop: 33.33,
        pctOfPrevious: 50,
      },
    ]);
  });

  it('defaults windowDays when omitted rather than 400-ing', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/games/funnel'),
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  it('rejects a non-integer window at the edge (never reaches the INTERVAL literal)', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/games/funnel?windowDays=1.5'),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects windowDays=0 and windowDays=400', async () => {
    const zero = await auth(
      request(createApp()).get('/api/v1/intel/games/funnel?windowDays=0'),
    );
    const huge = await auth(
      request(createApp()).get('/api/v1/intel/games/funnel?windowDays=400'),
    );
    expect(zero.status).toBe(400);
    expect(huge.status).toBe(400);
  });

  it('orders steps from GAME_FUNNEL_STEPS, so the funnel never widens', async () => {
    const entries = await getGameFunnel(7);
    expect(entries).not.toBeNull();
    const users = entries!.map((e) => e.users);
    for (let i = 1; i < users.length; i++) {
      expect(users[i]!).toBeLessThanOrEqual(users[i - 1]!);
    }
  });
});

// ── GET /games/completion ────────────────────────────────────────────

describe('GET /api/v1/intel/games/completion', () => {
  it('returns exact play-level counts and rates that sum to 100%', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/games/completion?days=30'),
    );

    expect(res.status).toBe(200);
    // starts    = U1 x2, U2, U4 -> 4
    // completes = U1, U4        -> 2
    // players   = U1, U2, U4    -> 3 distinct starters
    // finishers = U1, U4        -> 2 distinct finishers
    expect(res.body.data).toEqual({
      starts: 4,
      completes: 2,
      players: 3,
      finishers: 2,
      abandons: 2,
      completionPct: 50,
      abandonmentPct: 50,
      avgCompletedValue: 60, // (90 + 30) / 2
    });
    expect(
      res.body.data.completionPct + res.body.data.abandonmentPct,
    ).toBe(100);
  });

  it('rejects days=0 rather than silently widening to "all time"', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/games/completion?days=0'),
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── GET /games/vs-lessons ────────────────────────────────────────────

describe('GET /api/v1/intel/games/vs-lessons', () => {
  it('reports both surfaces with identical arithmetic and no bleed', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/games/vs-lessons?days=30'),
    );

    expect(res.status).toBe(200);

    // `activeDays` counts distinct CALENDAR dates, so its exact value depends
    // on what time of day the suite runs (the seed is expressed in hours ago).
    // Asserting it exactly would make this test fail at midnight rather than
    // on a regression, so it is bounded instead and every other field —
    // all of which are clock-independent — is pinned exactly.
    const [gamesRow, lessonsRow] = res.body.data as {
      surface: string;
      activeDays: number;
    }[];

    expect({ ...gamesRow, activeDays: undefined }).toEqual({
      surface: 'games',
      starts: 4,
      completes: 2,
      players: 3,
      reach: 4, // U1, U2, U3, U4
      sessions: 4,
      activeDays: undefined,
      completionPct: 50,
      startsPerPlayer: 1.33, // 4 / 3
      avgCompletedValue: 60,
    });
    // The game seed spans 72h -> 19h ago: at least 3 dates, at most 4.
    expect(gamesRow!.activeDays).toBeGreaterThanOrEqual(3);
    expect(gamesRow!.activeDays).toBeLessThanOrEqual(4);

    expect({ ...lessonsRow, activeDays: undefined }).toEqual({
      surface: 'lessons',
      starts: 1,
      completes: 1,
      players: 1,
      reach: 1, // U5 only
      sessions: 1,
      activeDays: undefined,
      completionPct: 100,
      startsPerPlayer: 1,
      avgCompletedValue: 70,
    });
    // The lesson seed spans 5h -> 3h ago: one date, or two across midnight.
    expect(lessonsRow!.activeDays).toBeGreaterThanOrEqual(1);
    expect(lessonsRow!.activeDays).toBeLessThanOrEqual(2);
  });

  it('never sums the two surfaces into one total', async () => {
    const surfaces = await getGamesVsLessons(30);
    expect(surfaces).not.toBeNull();
    // U5 touches no game and U3 touches no lesson: if the CASE arms leaked,
    // both `reach` values would be the 5-user grand total.
    expect(surfaces!.map((s) => s.reach)).toEqual([4, 1]);
    expect(surfaces!.map((s) => s.surface)).toEqual(['games', 'lessons']);
  });
});

// ── Capability gate, BEFORE the dimension exists ─────────────────────

describe('the game dimension is gated while the sync does not carry it', () => {
  it('GET /games/dimensions reports both parts absent on the shipped schema', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/games/dimensions'),
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      hasGameId: false,
      hasDimGamesMechanic: false,
    });
  });

  it('GET /games/breakdown answers 501 naming the missing objects, not an empty 200', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/games/breakdown?dimension=game&limit=10',
      ),
    );
    expect(res.status).toBe(501);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('DIMENSION_UNAVAILABLE');
    expect(res.body.error.message).toContain('fact_events.game_id');
  });

  it('names BOTH missing objects for the mechanic dimension', async () => {
    const result = await getGameBreakdown('mechanic', 10);
    expect(result).not.toBeNull();
    expect(result!.available).toBe(false);
    if (result!.available) throw new Error('expected the gate to be closed');
    expect(result!.missing).toEqual([
      'fact_events.game_id',
      'dim_games.mechanic',
    ]);
  });

  it('rejects an unknown dimension at the edge, never building SQL from it', async () => {
    const injection = await auth(
      request(createApp()).get(
        '/api/v1/intel/games/breakdown?dimension=' +
          encodeURIComponent('game_id; DROP TABLE fact_events'),
      ),
    );
    const bogus = await auth(
      request(createApp()).get('/api/v1/intel/games/breakdown?dimension=slug'),
    );
    const missing = await auth(
      request(createApp()).get('/api/v1/intel/games/breakdown'),
    );

    expect(injection.status).toBe(400);
    expect(injection.body.error.code).toBe('VALIDATION_ERROR');
    expect(bogus.status).toBe(400);
    expect(missing.status).toBe(400);

    // The rejection is not merely cosmetic: the table still exists.
    const completion = await getGameCompletion(30);
    expect(completion).not.toBeNull();
    expect(completion!.starts).toBe(4);
  });

  it('rejects a limit outside the allowed range', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/games/breakdown?dimension=game&limit=0',
      ),
    );
    expect(res.status).toBe(400);
  });
});

// ── Breakdown, AFTER the dimension exists ────────────────────────────

describe('GET /api/v1/intel/games/breakdown once the warehouse carries game_id', () => {
  const g1 = randomUUID(); // sorter
  const g2 = randomUUID(); // launcher
  const g3 = randomUUID(); // sorter
  const orphan = randomUUID(); // played, then republished — no dim_games row

  beforeAll(async () => {
    // Simulates the warehouse AFTER the sync owner exposes the dimension:
    // learning_events.game_id (migration 0028) flowing through
    // dataintel_events_sync -> db/schema.sql -> db/sync.ts#mapEventRow, plus a
    // dim_games dimension carrying the mechanic. None of those files are this
    // task's to edit, so this is the contract the gate opens against.
    await exec('ALTER TABLE fact_events ADD COLUMN game_id UUID');
    await exec(`CREATE TABLE dim_games (
      game_id UUID PRIMARY KEY,
      slug VARCHAR,
      mechanic VARCHAR,
      tier INTEGER
    )`);
    await execute(
      `INSERT INTO dim_games (game_id, slug, mechanic, tier) VALUES
        (?, 'coin-sorter', 'sorter', 1),
        (?, 'price-launcher', 'launcher', 2),
        (?, 'stock-sorter', 'sorter', 2)`,
      g1,
      g2,
      g3,
    );

    const seedGame = async (
      userId: string,
      gameId: string,
      eventType: string,
      value: number | null,
    ): Promise<void> => {
      await execute(
        `INSERT INTO fact_events (event_id, user_id, event_type, value, game_id, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP - INTERVAL (?) HOUR)`,
        nextEventId++,
        userId,
        eventType,
        value,
        gameId,
        2,
      );
    };

    // g1 (sorter):   3 starts, 2 completes (100, 50), 3 players
    await seedGame(U1, g1, 'game_start', null);
    await seedGame(U2, g1, 'game_start', null);
    await seedGame(U3, g1, 'game_start', null);
    await seedGame(U1, g1, 'game_complete', 100);
    await seedGame(U2, g1, 'game_complete', 50);

    // g2 (launcher): 2 starts, 0 completes
    await seedGame(U1, g2, 'game_start', null);
    await seedGame(U4, g2, 'game_start', null);

    // g3 (sorter):   1 start, 1 complete (70)
    await seedGame(U5, g3, 'game_start', null);
    await seedGame(U5, g3, 'game_complete', 70);

    // orphan: played, but its dim_games row is gone.
    await seedGame(U4, orphan, 'game_start', null);
  });

  it('the capability probe flips to available', async () => {
    const res = await auth(
      request(createApp()).get('/api/v1/intel/games/dimensions'),
    );
    expect(res.body.data).toEqual({
      hasGameId: true,
      hasDimGamesMechanic: true,
    });
    const caps = await getGameDimensionCapabilities();
    expect(caps).toEqual({ hasGameId: true, hasDimGamesMechanic: true });
  });

  it('breaks down per game with exact arithmetic, ignoring game_id-less events', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/games/breakdown?dimension=game&limit=50',
      ),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(true);
    expect(res.body.data.dimension).toBe('game');

    const rows: { dimensionKey: string }[] = res.body.data.rows;
    // Exactly the four seeded games. The 9 game events seeded at the top of
    // this file carry no game_id and must not appear as a NULL bucket.
    expect(rows).toHaveLength(4);

    const byKey = new Map(rows.map((r) => [r.dimensionKey, r]));

    expect(byKey.get(g1)).toEqual({
      dimensionKey: g1,
      starts: 3,
      completes: 2,
      players: 3,
      abandons: 1,
      completionPct: 66.67,
      abandonmentPct: 33.33,
      avgCompletedValue: 75, // (100 + 50) / 2
    });

    // 0% completed and "nothing to average" are different facts: the rate is
    // a real 0, the average is null.
    expect(byKey.get(g2)).toEqual({
      dimensionKey: g2,
      starts: 2,
      completes: 0,
      players: 2,
      abandons: 2,
      completionPct: 0,
      abandonmentPct: 100,
      avgCompletedValue: null,
    });

    expect(byKey.get(orphan)).toEqual({
      dimensionKey: orphan,
      starts: 1,
      completes: 0,
      players: 1,
      abandons: 1,
      completionPct: 0,
      abandonmentPct: 100,
      avgCompletedValue: null,
    });
  });

  it('breaks down per mechanic through dim_games, keeping the orphan as "unknown"', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/games/breakdown?dimension=mechanic&limit=50',
      ),
    );

    expect(res.status).toBe(200);
    expect(
      res.body.data.rows.map((r: { dimensionKey: string }) => r.dimensionKey),
    ).toEqual(['sorter', 'launcher', 'unknown']);

    // sorter = g1 + g3: 4 starts, 3 completes, players U1,U2,U3,U5 = 4
    expect(res.body.data.rows[0]).toEqual({
      dimensionKey: 'sorter',
      starts: 4,
      completes: 3,
      players: 4,
      abandons: 1,
      completionPct: 75,
      abandonmentPct: 25,
      avgCompletedValue: 73.3333, // (100 + 50 + 70) / 3
    });
    expect(res.body.data.rows[2].starts).toBe(1); // the republished game
  });

  it('reconciles: mechanic totals equal per-game totals', async () => {
    const byGame = await getGameBreakdown('game', 100);
    const byMechanic = await getGameBreakdown('mechanic', 100);
    expect(byGame?.available).toBe(true);
    expect(byMechanic?.available).toBe(true);
    if (!byGame?.available || !byMechanic?.available) {
      throw new Error('expected both breakdowns to be available');
    }

    const sum = (rows: { starts: number; completes: number }[], key: 'starts' | 'completes'): number =>
      rows.reduce((acc, r) => acc + r[key], 0);

    // A LEFT JOIN that dropped its NULLs would make these diverge by exactly
    // the orphan game's single start.
    expect(sum(byMechanic.rows, 'starts')).toBe(sum(byGame.rows, 'starts'));
    expect(sum(byMechanic.rows, 'completes')).toBe(sum(byGame.rows, 'completes'));
    expect(sum(byGame.rows, 'starts')).toBe(7); // 3 + 2 + 1 + 1
  });

  it('keeps the busiest game under a LIMIT, and does not re-rank in JS', async () => {
    const res = await auth(
      request(createApp()).get(
        '/api/v1/intel/games/breakdown?dimension=game&limit=1',
      ),
    );

    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(1);
    // `starts` is a real column in the query's `rolled` CTE, computed before
    // the LIMIT, so the surviving row is genuinely the top row. The service
    // adds no post-hoc score — if it ever does, the LIMIT must leave SQL.
    expect(res.body.data.rows[0].dimensionKey).toBe(g1);
    expect(res.body.data.rows[0].starts).toBe(3);

    const full = await getGameBreakdown('game', 100);
    if (!full?.available) throw new Error('expected the breakdown to be available');
    const startsDescending = full.rows.map((r) => r.starts);
    for (let i = 1; i < startsDescending.length; i++) {
      expect(startsDescending[i]!).toBeLessThanOrEqual(startsDescending[i - 1]!);
    }
    expect(startsDescending[0]).toBe(3);
  });
});
