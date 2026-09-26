import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

/*
 * A MALFORMED SKILL FILE MUST FAIL THE BOOT, NOT THE FIRST LIVE TURN.
 *
 * `skills.ts`'s own comment already claimed this: "Read once at boot; loud on
 * ANY malformed file — a broken catalogue must fail deploy, not a turn." That
 * was false until `index.ts` was given an eager, synchronous `skillCatalogue()`
 * call before the listener opens (adversarial review round 67). Before the
 * fix, `skillCatalogue()` was memoized lazily on its FIRST call, and the only
 * call sites were `orchestrator.ts`'s `strategyInstruction()` (mid-turn) and
 * test/verify scripts — nothing at boot ever touched it, so a malformed file
 * booted "healthy" and only threw inside `selectSkill()` on a real child's
 * first graded turn, caught by `ws/server.ts`'s message-handler `.catch()` and
 * delivered as a live `{code:'INTERNAL', ...}` instead of a blocked deploy.
 *
 * This can only be proven by actually booting the real entrypoint — `index.ts`
 * has boot-time side effects (opens a real listener, connects Redis, installs
 * SIGTERM/SIGINT handlers) that make it unsafe to `import` in-process inside a
 * shared vitest worker. So each case here spawns `tsx src/index.ts` for real,
 * as a child process, against a FULLY ISOLATED copy of `src/` + `skills/`
 * (never the repo's own `oracle/skills/moves/`) — writing a malformed file
 * into a temp copy can never race `skills.test.ts`, which calls the real
 * `skillCatalogue()` in-process against the real directory.
 */

const ORACLE_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
/*
 * Spawn tsx's CLI through `node` rather than through `node_modules/.bin/tsx`.
 *
 * That shim is a POSIX shell script with no extension, so `spawn()` without a
 * shell asked Windows to execute it directly and both cases in this file died
 * with ENOENT on every Windows checkout — green in CI, red on the machine the
 * owner actually runs the mandatory gates from, which makes it a gate they
 * cannot use. Its `.cmd` sibling is no better: Node ≥20 refuses to spawn
 * .cmd/.bat without `shell: true` (CVE-2024-27980), and a shell would sit
 * between us and the child, breaking the process-group kill below.
 *
 * This is not a workaround — it is literally what the shim does:
 *   exec node "$basedir/../tsx/dist/cli.mjs" "$@"
 * so POSIX behaviour is unchanged, and `detached` still makes the runtime
 * itself the process-group leader.
 */
const TSX_CLI = path.join(ORACLE_ROOT, 'node_modules/tsx/dist/cli.mjs');
const ENV_EXAMPLE = path.join(ORACLE_ROOT, '.env.example');

/** Minimal dotenv, same approach as env-example.test.ts: enough for a file we control. */
function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

/**
 * A throwaway copy of the runtime, nested inside `oracle/` so `node_modules`
 * still resolves by directory walk-up, but with its OWN `skills/moves` — a
 * malformed file written into it can never be seen by any other test file or
 * by a developer's own `npm run dev`.
 */
function makeIsolatedCopy(): string {
  const dir = mkdtempSync(path.join(ORACLE_ROOT, '.boot-test-'));
  cpSync(path.join(ORACLE_ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
  cpSync(path.join(ORACLE_ROOT, 'skills'), path.join(dir, 'skills'), { recursive: true });
  return dir;
}

async function bootEnv(port: number): Promise<NodeJS.ProcessEnv> {
  const vars = parseDotenv(readFileSync(ENV_EXAMPLE, 'utf8'));
  return { ...process.env, ...vars, PORT: String(port) };
}

interface Booted {
  child: ChildProcess;
  stdout: () => string;
  stderr: () => string;
  /** Resolves once, when the child process itself exits. Never rejects. */
  exited: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  /** Kills the whole process group (tsx may leave a loader child behind a plain kill()) and stops listening. */
  kill: () => void;
}

function bootOracle(entry: string, env: NodeJS.ProcessEnv): Booted {
  // `detached: true` makes the child its own process-group leader on POSIX, so
  // `kill()` below can signal the WHOLE group — not just the immediate `tsx`
  // process — which matters because a plain `child.kill()` was observed, while
  // characterizing this fix, to leave the actual runtime process alive as an
  // orphan holding its stdio pipes open (the loader wrapper dies; the real
  // process it launched does not), hanging whatever awaited stream EOF next.
  const child = spawn(process.execPath, [TSX_CLI, entry], { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let stdout = '';
  let stderr = '';
  child.stdout?.on('data', (d: Buffer) => {
    stdout += d.toString();
  });
  child.stderr?.on('data', (d: Buffer) => {
    stderr += d.toString();
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
  return {
    child,
    stdout: () => stdout,
    stderr: () => stderr,
    exited,
    kill: () => {
      if (child.pid) {
        if (process.platform === 'win32') {
          // Windows has no process groups: `process.kill(-pid)` throws, the
          // catch below swallowed it, and every booted Oracle (the tsx wrapper
          // AND its loader child) was left running as an orphan server after
          // the suite (found in the S06.15 lane review: 15 of them on one
          // worktree). `taskkill /T` kills the whole tree.
          spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            // Already dead — fine, that's the success case.
          }
        }
      }
      child.stdout?.destroy();
      child.stderr?.destroy();
    },
  };
}

/** Races a promise against a timeout without ever rejecting, so callers can assert on the shape. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'TIMED_OUT'> {
  const timeout = new Promise<'TIMED_OUT'>((resolve) => setTimeout(() => resolve('TIMED_OUT'), ms));
  return Promise.race([promise, timeout]);
}

async function pollUntil(check: () => boolean, timeoutMs: number, stepMs = 50): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  return check();
}

describe('oracle boot — skill catalogue validation', () => {
  const dirs: string[] = [];
  const cleanupKills: Array<() => void> = [];

  afterEach(() => {
    for (const kill of cleanupKills.splice(0)) kill();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('refuses to boot — never reports healthy — when a skill file is malformed', async () => {
    const dir = makeIsolatedCopy();
    dirs.push(dir);
    // Not "unknown strategy" or "duplicate name" — the plainest possible
    // malformation, matching the round-67 repro: a file with no frontmatter
    // fence at all.
    writeFileSync(path.join(dir, 'skills/moves/__boot-test-malformed.md'), 'this is not a skill file\n');

    const port = await getFreePort();
    const booted = bootOracle(path.join(dir, 'src/index.ts'), await bootEnv(port));
    cleanupKills.push(booted.kill);

    const outcome = await withTimeout(booted.exited, 10_000);

    expect(outcome).not.toBe('TIMED_OUT');
    if (outcome === 'TIMED_OUT') return; // unreachable, narrows the type for TS
    expect(outcome.code).not.toBe(0);
    // Never touched the network — the crash happens before `httpServer.listen`.
    expect(booted.stdout()).not.toMatch(/listening on/);
    // The thrown error names the offending file, not a generic failure.
    expect(booted.stderr()).toMatch(/__boot-test-malformed\.md/);
    expect(booted.stderr()).toMatch(/frontmatter/);
  }, 15_000);

  it('still boots normally — reaches "listening" — with the real, valid skill set', async () => {
    const dir = makeIsolatedCopy();
    dirs.push(dir);

    const port = await getFreePort();
    const booted = bootOracle(path.join(dir, 'src/index.ts'), await bootEnv(port));
    cleanupKills.push(booted.kill);

    const reachedListening = await pollUntil(() => booted.stdout().includes('listening on'), 10_000);

    expect(reachedListening).toBe(true);
    expect(booted.stdout()).toContain(`listening on :${port}`);
  }, 15_000);
});
