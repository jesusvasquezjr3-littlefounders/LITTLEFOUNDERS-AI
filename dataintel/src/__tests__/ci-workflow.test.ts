// Regression gate for `.github/workflows/dataintel-ci.yml`.
//
// dataintel shipped with a full test suite and NO workflow at all, so none of
// it had ever run in CI: type errors, lint errors and failing tests could all
// reach main untouched. A missing workflow is invisible by construction —
// nothing goes red, because nothing runs. This test makes the absence loud.
//
// It also pins the workflow to what dataintel/package.json actually defines:
// every `npm run <script>` step must name a real script, so renaming or
// dropping a script cannot leave CI green while running nothing.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../..');
const SERVICE_ROOT = path.resolve(here, '../..');
const WORKFLOW = path.join(REPO_ROOT, '.github/workflows/dataintel-ci.yml');
const CD_WORKFLOW = path.join(REPO_ROOT, '.github/workflows/dataintel-cd.yml');
const RAILWAY_CONFIG = path.join(SERVICE_ROOT, 'railway.json');
const RAILWAY_IGNORE = path.join(SERVICE_ROOT, '.railwayignore');

/**
 * The `paths:` list under each `on:` trigger. Hand-rolled because dataintel
 * carries no YAML parser dependency and CI must not need one.
 */
function pathFilters(yaml: string): Record<string, string[]> {
  const filters: Record<string, string[]> = {};
  let trigger: string | null = null;
  let inPaths = false;
  for (const line of yaml.split('\n')) {
    const triggerMatch = /^ {2}(push|pull_request):/.exec(line);
    if (triggerMatch !== null && triggerMatch[1] !== undefined) {
      trigger = triggerMatch[1];
      filters[trigger] ??= [];
      inPaths = false;
      continue;
    }
    if (trigger === null) continue;
    if (/^ {4}paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    const item = /^ {6}- '(.+)'\s*$/.exec(line);
    if (inPaths && item !== null && item[1] !== undefined) {
      filters[trigger]?.push(item[1]);
      continue;
    }
    if (line.trim() !== '' && !line.startsWith('      ')) inPaths = false;
  }
  return filters;
}

/** Every `- run: …` command in the workflow, in file order. */
function runSteps(yaml: string): string[] {
  const steps: string[] = [];
  for (const line of yaml.split('\n')) {
    const match = /^\s*- run:\s*(.+?)\s*$/.exec(line);
    if (match !== null && match[1] !== undefined) steps.push(match[1]);
  }
  return steps;
}

describe('dataintel CI workflow', () => {
  const yaml = readFileSync(WORKFLOW, 'utf8');
  const manifest: unknown = JSON.parse(
    readFileSync(path.join(SERVICE_ROOT, 'package.json'), 'utf8'),
  );

  function scriptNames(): string[] {
    if (typeof manifest !== 'object' || manifest === null) return [];
    const scripts = (manifest as { scripts?: unknown }).scripts;
    if (typeof scripts !== 'object' || scripts === null) return [];
    return Object.keys(scripts);
  }

  it('runs in the dataintel directory on the repo-wide Node version', () => {
    expect(yaml).toContain('working-directory: dataintel');
    expect(yaml).toContain('node-version: 24');
    expect(yaml).toContain('cache-dependency-path: dataintel/package-lock.json');
  });

  it('declares the same filters for push and pull_request', () => {
    const filters = pathFilters(yaml);
    expect(filters['push']).toBeDefined();
    expect(filters['pull_request']).toEqual(filters['push']);
  });

  it('watches dataintel and its own workflow file', () => {
    const filters = pathFilters(yaml);
    expect(filters['push']).toContain('dataintel/**');
    expect(filters['push']).toContain('.github/workflows/dataintel-ci.yml');
  });

  it('installs, then runs every gate dataintel actually defines', () => {
    const steps = runSteps(yaml);
    expect(steps[0]).toBe('npm ci');
    expect(steps).toContain('npm run type-check');
    expect(steps).toContain('npm run lint');
    expect(steps).toContain('npm test');
  });

  it('only invokes scripts that exist in package.json', () => {
    const defined = scriptNames();
    const invoked = runSteps(yaml)
      .map((step) => /^npm run ([\w:-]+)$/.exec(step)?.[1])
      .filter((name): name is string => name !== undefined);
    expect(invoked.length).toBeGreaterThan(0);
    expect(invoked.filter((name) => !defined.includes(name))).toEqual([]);
  });
});

describe('dataintel CD workflow', () => {
  const yaml = readFileSync(CD_WORKFLOW, 'utf8');

  it('deploys only after the matching successful CI workflow on main', () => {
    expect(yaml).toContain('workflows: ["dataintel CI"]');
    expect(yaml).toContain('branches: [main]');
    expect(yaml).toContain("if: github.event.workflow_run.conclusion == 'success'");
  });

  it('pins a CI workflow name that dataintel-ci.yml actually declares', () => {
    // `workflow_run` matches by workflow NAME. Renaming CI without this pin
    // orphans deployment forever — nothing goes red, because nothing runs.
    expect(readFileSync(WORKFLOW, 'utf8')).toMatch(/^name: dataintel CI$/m);
  });

  it('deploys the service from the repository root with the shared Railway secret', () => {
    expect(yaml).toContain('railway up dataintel --path-as-root --service dataintel --ci');
    expect(yaml).toContain('RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}');
  });

  it('build ships the DuckDB schema beside the compiled loader', () => {
    // tsc compiles only .ts — the first production deploy served /health while
    // initDb() warned ENOENT on /app/dist/db/schema.sql, leaving the whole
    // warehouse silently dead. The build must copy the .sql asset into dist.
    const pkg = JSON.parse(readFileSync(path.join(SERVICE_ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.build).toContain('cp src/db/schema.sql dist/db/schema.sql');
    expect(readFileSync(path.join(SERVICE_ROOT, 'src/db/schema.sql'), 'utf8')).toContain('CREATE');
  });

  it('has isolated Railway runtime configuration and excludes the local DuckDB file', () => {
    const railway = JSON.parse(readFileSync(RAILWAY_CONFIG, 'utf8')) as {
      deploy?: { startCommand?: string; healthcheckPath?: string; restartPolicyType?: string };
    };
    expect(railway.deploy?.startCommand).toBe('npm run start');
    expect(railway.deploy?.healthcheckPath).toBe('/health');
    expect(railway.deploy?.restartPolicyType).toBe('ON_FAILURE');
    const ignore = readFileSync(RAILWAY_IGNORE, 'utf8');
    expect(ignore).toContain('duckdb/');
    expect(ignore).toContain('.env');
  });
});
