import { describe, expect, it } from 'vitest';
import { execute, initDb } from './duckdb.js';
import { refreshAggregates } from './sync.js';

/*
 * refreshAggregates() previously interpolated dataintel_sync_state's
 * last_synced_at — a JS Date object once DuckDB's Node driver returns it —
 * directly into a template literal. That calls Date#toString()
 * ("Wed Jul 29 2026 19:27:41 GMT-0600 (...)"), which DuckDB's TIMESTAMP
 * parser rejects, so every refresh after the FIRST successful sync (the
 * only time last_synced_at is still null) threw and never wrote a single
 * aggregate row. Only reproducible with a real last_synced_at value in
 * place — the unit tests that shipped with this file never populated one.
 */
describe('refreshAggregates — survives a populated last_synced_at', () => {
  it('does not throw once dataintel_sync_state.learning_events has a real last_synced_at', async () => {
    await initDb();
    await execute(`
      CREATE TABLE IF NOT EXISTS dataintel_sync_state (
        table_name VARCHAR PRIMARY KEY,
        last_event_id BIGINT NOT NULL DEFAULT 0,
        last_synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        rows_synced BIGINT NOT NULL DEFAULT 0,
        last_error VARCHAR
      )
    `);
    await execute(
      `INSERT OR REPLACE INTO dataintel_sync_state (table_name, last_synced_at, last_event_id, rows_synced)
       VALUES ('learning_events', CURRENT_TIMESTAMP, 0, 0)`,
    );

    await expect(refreshAggregates()).resolves.toBeUndefined();
  });
});
