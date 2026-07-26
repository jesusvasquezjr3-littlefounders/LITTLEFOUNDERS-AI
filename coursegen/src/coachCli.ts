#!/usr/bin/env node
// forge:coach CLI — `npm run coach -- --run <run-id> | --track <track-id>`.
// Offline and FREE (zero LLM calls, zero Vault writes): reads
// runs/<id>/{checkpoint.json, ledger.jsonl, rubrics.jsonl} (and, for a track,
// runs/<track-id>/track-report.json + every shard run dir), writes
// coach-report.md next to the inputs and prints it. See pipeline/coach.ts for
// the propose-only philosophy.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { diagnose, renderMarkdown, type CoachInput, type LedgerLine } from './pipeline/coach.js';
import { RubricLog, type RubricLogEntry } from './pipeline/rubricLog.js';
import type { RunCheckpoint } from './pipeline/checkpoint.js';
import type { TrackReport } from './pipeline/track.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNS_ROOT = path.resolve(__dirname, '..', 'runs');

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function readLedger(runDir: string): Promise<LedgerLine[]> {
  let raw: string;
  try {
    raw = await readFile(path.join(runDir, 'ledger.jsonl'), 'utf8');
  } catch {
    return [];
  }
  const lines: LedgerLine[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      lines.push(JSON.parse(line) as LedgerLine);
    } catch {
      // truncated tail — tolerated, same as every other JSONL reader here
    }
  }
  return lines;
}

async function collectRun(runId: string): Promise<{ checkpoint: RunCheckpoint | null; ledger: LedgerLine[]; rubrics: RubricLogEntry[] }> {
  const runDir = path.join(RUNS_ROOT, runId);
  return {
    checkpoint: await readJson<RunCheckpoint>(path.join(runDir, 'checkpoint.json')),
    ledger: await readLedger(runDir),
    rubrics: await RubricLog.read(runDir),
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let runId: string | undefined;
  let trackId: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--run') runId = argv[++i];
    else if (argv[i] === '--track') trackId = argv[++i];
    else {
      console.error(`coach: unknown argument "${argv[i]}"`);
      process.exit(1);
    }
  }
  if ((!runId && !trackId) || (runId && trackId)) {
    console.error('Usage: npm run coach -- --run <run-id> | --track <track-id>');
    process.exit(1);
  }

  let input: CoachInput;
  let outDir: string;
  if (trackId) {
    const trackReport = await readJson<TrackReport>(path.join(RUNS_ROOT, trackId, 'track-report.json'));
    if (!trackReport) {
      console.error(`coach: no track-report.json under runs/${trackId}/ — has the track run?`);
      process.exit(1);
    }
    const checkpoints: RunCheckpoint[] = [];
    const ledger: LedgerLine[] = [];
    const rubrics: RubricLogEntry[] = [];
    for (const shard of trackReport.shards) {
      const collected = await collectRun(shard.runId);
      if (collected.checkpoint) checkpoints.push(collected.checkpoint);
      ledger.push(...collected.ledger);
      rubrics.push(...collected.rubrics);
    }
    input = { label: trackId, checkpoints, ledger, rubrics, trackReport };
    outDir = path.join(RUNS_ROOT, trackId);
  } else {
    const collected = await collectRun(runId!);
    if (!collected.checkpoint) {
      console.error(`coach: no checkpoint.json under runs/${runId}/ — has the run started?`);
      process.exit(1);
    }
    input = { label: runId!, checkpoints: [collected.checkpoint], ledger: collected.ledger, rubrics: collected.rubrics };
    outDir = path.join(RUNS_ROOT, runId!);
  }

  const report = renderMarkdown(input.label, diagnose(input), input.trackReport);
  await writeFile(path.join(outDir, 'coach-report.md'), report, 'utf8');
  console.log(report);
  console.log(`(written to runs/${input.label}/coach-report.md)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
