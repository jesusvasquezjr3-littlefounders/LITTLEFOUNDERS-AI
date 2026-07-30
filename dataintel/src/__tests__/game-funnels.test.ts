import { randomUUID } from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { exec, execute, initDb, query } from '../db/duckdb.js';
import {
  gameBreakdownQuery,
  gameCompletionQuery,
  gameDimensionProbeQuery,
  gameFunnelQuery,
  gamesVsLessonsQuery,
  resolveGameDimension,
  UnsupportedGameDimensionError,
} from '../db/queries.js';

/*
 * Game funnels, verified against a real seeded DuckDB.
 *
 * Every expectation below is an EXACT number derived by hand from the seed,
 * not a "it returned some rows" smoke check — the two defects this file's own
 * history records (a metric param interpolated as a column name, and an
 * unaliased inner expression that never resolved) both produced queries that
 * ran or failed uniformly, so only arithmetic on known data catches them.
 */

const A = randomUUID(); // opens, starts, completes, then starts a 2nd play
const B = randomUUID(); // opens, starts, never completes
const C = randomUUID(); // opens the hub only
const D = randomUUID(); // starts + completes with NO open (deep link / lost beacon)
const E = randomUUID(); // opened 45 days ago, started only yesterday (out of window)
const F = randomUUID(); // opens, then a complete with no start in between
const G = randomUUID(); // lessons only

const SESSIONS: Record<string, string> = {
  [A]: randomUUID(),
  [B]: randomUUID(),
  [C]: randomUUID(),
  [D]: randomUUID(),
  [E]: randomUUID(),
  [F]: randomUUID(),
  [G]: randomUUID(),
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

const num = (v: unknown): number => Number(v);

beforeAll(async () => {
  await initDb();

  // ── games ──
  await seed(A, 'game_open', 72);
  await seed(A, 'game_start', 71);
  await seed(A, 'game_complete', 70, 80);
  await seed(A, 'game_start', 68); // second play, never completed

  await seed(B, 'game_open', 50);
  await seed(B, 'game_start', 49);

  await seed(C, 'game_open', 30);

  await seed(D, 'game_start', 20);
  await seed(D, 'game_complete', 19, 60);

  await seed(E, 'game_open', 45 * 24);
  await seed(E, 'game_start', 24);

  await seed(F, 'game_open', 10);
  await seed(F, 'game_complete', 9, 40);

  // ── lessons ──
  await seed(A, 'lesson_start', 100);
  await seed(A, 'lesson_complete', 99, 90);
  await seed(B, 'lesson_start', 80);
  await seed(G, 'course_open', 5);
  await seed(G, 'lesson_start', 4);
  await seed(G, 'lesson_complete', 3, 70);
});

describe('gameFunnelQuery — ordered game_open → game_start → game_complete', () => {
  it('counts each step in distinct users, requiring the previous step first', async () => {
    const { sql, params } = gameFunnelQuery(7);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.step)).toEqual([
      'game_open',
      'game_start',
      'game_complete',
    ]);

    // opened  = A, B, C, E, F                       -> 5   (D never opened)
    // started = A, B                                -> 2   (D has no open;
    //           E's start is 44 days after its open, outside the 7-day window)
    // done    = A                                   -> 1   (F completed with
    //           no start; D is excluded at the top of the funnel)
    expect(rows.map((r) => num(r.users))).toEqual([5, 2, 1]);

    expect(num(rows[0]!.pct_of_top)).toBe(100);
    expect(num(rows[1]!.pct_of_top)).toBe(40); // 2/5
    expect(num(rows[2]!.pct_of_top)).toBe(20); // 1/5

    expect(rows[0]!.pct_of_previous).toBeNull();
    expect(num(rows[1]!.pct_of_previous)).toBe(40); // 2/5
    expect(num(rows[2]!.pct_of_previous)).toBe(50); // 1/2
  });

  it('never widens as it descends (the flat MAX(CASE) funnel would)', async () => {
    const { sql, params } = gameFunnelQuery(7);
    const rows = await query<Record<string, unknown>>(sql, ...params);
    const users = rows.map((r) => num(r.users));

    // A flat per-event count would report started = 4 (A, B, D, E) against
    // opened = 5 and completed = 3 (A, D, F) — a funnel whose last step is
    // wider than its middle.
    for (let i = 1; i < users.length; i++) {
      expect(users[i]!).toBeLessThanOrEqual(users[i - 1]!);
    }
  });

  it('widens the window: E converts once the window covers its 44-day gap', async () => {
    const { sql, params } = gameFunnelQuery(60);
    const rows = await query<Record<string, unknown>>(sql, ...params);
    expect(rows.map((r) => num(r.users))).toEqual([5, 3, 1]);
  });

  it('rejects a non-integer window rather than interpolating it into SQL', () => {
    expect(() => gameFunnelQuery(1.5)).toThrow(/windowDays/);
    expect(() => gameFunnelQuery(-1)).toThrow(/windowDays/);
  });
});

describe('gameCompletionQuery — completion and abandonment', () => {
  it('computes play-level rates that sum to 100%', async () => {
    const { sql, params } = gameCompletionQuery(30);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    expect(rows).toHaveLength(1);
    const r = rows[0]!;

    // starts    = A x2, B, D, E                     -> 5
    // completes = A, D, F                           -> 3
    // players   = A, B, D, E                        -> 4 distinct starters
    // finishers = A, D, F                           -> 3 distinct finishers
    expect(num(r.starts)).toBe(5);
    expect(num(r.completes)).toBe(3);
    expect(num(r.players)).toBe(4);
    expect(num(r.finishers)).toBe(3);
    expect(num(r.abandons)).toBe(2);

    expect(num(r.completion_pct)).toBe(60); // 3/5
    expect(num(r.abandonment_pct)).toBe(40); // 2/5
    expect(num(r.completion_pct) + num(r.abandonment_pct)).toBe(100);

    // (80 + 60 + 40) / 3
    expect(num(r.avg_completed_value)).toBe(60);
  });

  it('returns a real zero-row shape, not a crash, on an empty window', async () => {
    const { sql, params } = gameCompletionQuery(0);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    expect(rows).toHaveLength(1);
    // Everything in the seed is >= 3 hours old but < 1 day for some rows, so
    // assert only the invariant that matters: no division blows up and the
    // percentages are either a number or NULL, never NaN/Infinity.
    const pct = rows[0]!.completion_pct;
    if (pct !== null) expect(Number.isFinite(num(pct))).toBe(true);
  });
});

describe('gamesVsLessonsQuery — comparable engagement on both surfaces', () => {
  it('reports each surface with identical arithmetic', async () => {
    const { sql, params } = gamesVsLessonsQuery(30);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    expect(rows.map((r) => r.surface)).toEqual(['games', 'lessons']);

    const games = rows[0]!;
    // starts 5 (A x2, B, D, E), completes 3 (A, D, F), players 4,
    // reach = A,B,C,D,E,F = 6 (E's 45-day-old open is outside the window,
    // but its start is inside), sessions = one per user = 6.
    expect(num(games.starts)).toBe(5);
    expect(num(games.completes)).toBe(3);
    expect(num(games.players)).toBe(4);
    expect(num(games.reach)).toBe(6);
    expect(num(games.sessions)).toBe(6);
    expect(num(games.completion_pct)).toBe(60); // 3/5
    expect(num(games.starts_per_player)).toBe(1.25); // 5/4
    expect(num(games.avg_completed_value)).toBe(60);
    expect(num(games.active_days)).toBeGreaterThanOrEqual(1);

    const lessons = rows[1]!;
    // starts 3 (A, B, G), completes 2 (A, G), players 3, reach 3, sessions 3.
    expect(num(lessons.starts)).toBe(3);
    expect(num(lessons.completes)).toBe(2);
    expect(num(lessons.players)).toBe(3);
    expect(num(lessons.reach)).toBe(3);
    expect(num(lessons.sessions)).toBe(3);
    expect(num(lessons.completion_pct)).toBe(66.67); // 2/3
    expect(num(lessons.starts_per_player)).toBe(1); // 3/3
    expect(num(lessons.avg_completed_value)).toBe(80); // (90 + 70) / 2
  });

  it('does not let one surface bleed into the other', async () => {
    const { sql, params } = gamesVsLessonsQuery(30);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    // G plays no games and C opens no lessons; if the CASE arms leaked, the
    // two surfaces' `reach` would both be the 7-user total.
    const total = num(rows[0]!.reach) + num(rows[1]!.reach);
    expect(total).toBe(9); // 6 game users + 3 lesson users, A and B in both
  });
});

describe('resolveGameDimension — allowlist, never interpolation', () => {
  it('maps the two supported dimensions to real column expressions', () => {
    expect(resolveGameDimension('game').column).toBe('fe.game_id');
    expect(resolveGameDimension('mechanic').column).toBe(
      "COALESCE(dg.mechanic, 'unknown')",
    );
  });

  it('throws a typed error instead of building SQL from caller text', () => {
    expect(() => resolveGameDimension('game_id; DROP TABLE fact_events')).toThrow(
      UnsupportedGameDimensionError,
    );
    expect(() => resolveGameDimension('slug')).toThrow(UnsupportedGameDimensionError);
  });
});

describe('gameDimensionProbeQuery — the shipped warehouse has no game dimension yet', () => {
  it('reports both parts of the dimension as absent on the real schema.sql', async () => {
    const { sql, params } = gameDimensionProbeQuery();
    const rows = await query<Record<string, unknown>>(sql, ...params);

    expect(rows).toHaveLength(1);
    // This is the executable statement of the blocker: db/schema.sql declares
    // no fact_events.game_id and no dim_games, and db/sync.ts maps neither,
    // so gameBreakdownQuery MUST stay gated until the sync exposes them.
    expect(rows[0]!.has_game_id).toBe(false);
    expect(rows[0]!.has_dim_games_mechanic).toBe(false);
  });
});

describe('gameBreakdownQuery — per-game and per-mechanic (gated on the dimension)', () => {
  const game1 = randomUUID(); // sorter
  const game2 = randomUUID(); // launcher
  const game3 = randomUUID(); // sorter
  const orphan = randomUUID(); // played, but absent from dim_games

  beforeAll(async () => {
    // Simulate the warehouse AFTER the sync owner exposes the dimension:
    // learning_events.game_id (migration 0028) flowing through
    // dataintel_events_sync -> schema.sql -> mapEventRow, plus a dim_games
    // dimension carrying the mechanic. None of those three files are this
    // task's to edit, so this is the contract the breakdown codes against.
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
      game1,
      game2,
      game3,
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

    // game1 (sorter): 3 starts, 2 completes (100, 50), 3 distinct players
    await seedGame(A, game1, 'game_start', null);
    await seedGame(B, game1, 'game_start', null);
    await seedGame(C, game1, 'game_start', null);
    await seedGame(A, game1, 'game_complete', 100);
    await seedGame(B, game1, 'game_complete', 50);

    // game2 (launcher): 2 starts, 0 completes
    await seedGame(A, game2, 'game_start', null);
    await seedGame(D, game2, 'game_start', null);

    // game3 (sorter): 1 start, 1 complete (70)
    await seedGame(E, game3, 'game_start', null);
    await seedGame(E, game3, 'game_complete', 70);

    // A game that was played and then republished under a new id, so its
    // dim_games row is gone (migration 0028's identity-migration case).
    await seedGame(F, orphan, 'game_start', null);
  });

  it('probe flips to true once the dimension exists', async () => {
    const { sql, params } = gameDimensionProbeQuery();
    const rows = await query<Record<string, unknown>>(sql, ...params);
    expect(rows[0]!.has_game_id).toBe(true);
    expect(rows[0]!.has_dim_games_mechanic).toBe(true);
  });

  it('breaks down per game, ignoring every event with no game_id', async () => {
    const { sql, params } = gameBreakdownQuery('game', 50);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    // Exactly the four seeded games — the 12 game events seeded without a
    // game_id at the top of the file must not appear as a NULL bucket.
    expect(rows).toHaveLength(4);

    const byKey = new Map(rows.map((r) => [String(r.dimension_key), r]));

    const g1 = byKey.get(game1)!;
    expect(num(g1.starts)).toBe(3);
    expect(num(g1.completes)).toBe(2);
    expect(num(g1.players)).toBe(3);
    expect(num(g1.abandons)).toBe(1);
    expect(num(g1.completion_pct)).toBe(66.67);
    expect(num(g1.abandonment_pct)).toBe(33.33);
    expect(num(g1.avg_completed_value)).toBe(75); // (100 + 50) / 2

    const g2 = byKey.get(game2)!;
    expect(num(g2.starts)).toBe(2);
    expect(num(g2.completes)).toBe(0);
    expect(num(g2.players)).toBe(2);
    expect(num(g2.abandons)).toBe(2);
    expect(num(g2.completion_pct)).toBe(0);
    expect(num(g2.abandonment_pct)).toBe(100);
    expect(g2.avg_completed_value).toBeNull();

    const g3 = byKey.get(game3)!;
    expect(num(g3.starts)).toBe(1);
    expect(num(g3.completes)).toBe(1);
    expect(num(g3.completion_pct)).toBe(100);
    expect(num(g3.abandonment_pct)).toBe(0);
  });

  it('breaks down per mechanic through dim_games', async () => {
    const { sql, params } = gameBreakdownQuery('mechanic', 50);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    expect(rows.map((r) => r.dimension_key)).toEqual([
      'sorter',
      'launcher',
      'unknown',
    ]);

    const sorter = rows[0]!;
    // game1 + game3: 4 starts, 3 completes, players A,B,C,E = 4
    expect(num(sorter.starts)).toBe(4);
    expect(num(sorter.completes)).toBe(3);
    expect(num(sorter.players)).toBe(4);
    expect(num(sorter.abandons)).toBe(1);
    expect(num(sorter.completion_pct)).toBe(75);
    expect(num(sorter.avg_completed_value)).toBe(73.3333); // (100+50+70)/3

    const launcher = rows[1]!;
    expect(num(launcher.starts)).toBe(2);
    expect(num(launcher.completes)).toBe(0);
    expect(num(launcher.completion_pct)).toBe(0);

    // The republished game is reported as 'unknown', not dropped.
    expect(num(rows[2]!.starts)).toBe(1);
  });

  it('reconciles: mechanic totals equal per-game totals', async () => {
    const gameQ = gameBreakdownQuery('game', 100);
    const mechanicQ = gameBreakdownQuery('mechanic', 100);
    const byGame = await query<Record<string, unknown>>(gameQ.sql, ...gameQ.params);
    const byMechanic = await query<Record<string, unknown>>(
      mechanicQ.sql,
      ...mechanicQ.params,
    );

    const sum = (rows: Record<string, unknown>[], key: string): number =>
      rows.reduce((acc, r) => acc + num(r[key]), 0);

    // A LEFT JOIN that filtered its NULLs away would make these diverge by
    // exactly the orphan game's 1 start.
    expect(sum(byMechanic, 'starts')).toBe(sum(byGame, 'starts'));
    expect(sum(byMechanic, 'completes')).toBe(sum(byGame, 'completes'));
    expect(sum(byMechanic, 'starts')).toBe(7); // 3 + 2 + 1 + 1
  });

  it('applies the LIMIT after starts is computed, keeping the busiest game', async () => {
    const { sql, params } = gameBreakdownQuery('game', 1);
    const rows = await query<Record<string, unknown>>(sql, ...params);

    expect(rows).toHaveLength(1);
    // game1 has the most starts (3). The churn-query defect was a LIMIT
    // applied before the ranking value existed; here `starts` is a real
    // column in the rolled CTE, so the top row is genuinely the top row.
    expect(String(rows[0]!.dimension_key)).toBe(game1);
    expect(num(rows[0]!.starts)).toBe(3);
  });
});
