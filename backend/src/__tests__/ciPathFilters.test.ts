// Regression gate for `.github/workflows/backend-ci.yml` path filters.
//
// `npm test` here runs `contract:check` first (backend/package.json), and the
// parity script reads files that live OUTSIDE backend/:
//
//   scripts/contract-check.ts → frontend/src/lesson-engine
//
// If a workflow path filter does not cover that root, the drift the script
// exists to catch becomes unreachable in CI: editing a lesson type under
// frontend/ triggers frontend CI, but never backend CI, so the backend's copy
// silently keeps the old shape. Zod strips unknown keys by default, so the
// divergence is not rejected — the missing field is DELETED during replay and
// the child is scored on a document that is not the one they played.
//
// This test derives the required roots FROM the script itself (its
// `path.resolve(here, …)` literals) rather than from a hand-maintained list,
// so a newly added cross-package read fails here instead of quietly widening
// the gap.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '../../..');
const SCRIPTS_DIR = path.resolve(here, '../../scripts');
const WORKFLOW = path.join(REPO_ROOT, '.github/workflows/backend-ci.yml');

/** Every `path.resolve(here, '<literal>')` target in the parity scripts. */
function resolvedRoots(): string[] {
  const pattern = /path\.resolve\(\s*here,\s*'([^']+)'\s*\)/g;
  const roots = new Set<string>();
  for (const entry of readdirSync(SCRIPTS_DIR)) {
    if (!entry.endsWith('.ts')) continue;
    const source = readFileSync(path.join(SCRIPTS_DIR, entry), 'utf8');
    for (const match of source.matchAll(pattern)) {
      const literal = match[1];
      if (literal === undefined) continue;
      const absolute = path.resolve(SCRIPTS_DIR, literal);
      // Normalise to forward slashes: GitHub Actions path globs always use
      // them, while path.relative yields backslashes on Windows — so without
      // this the gate reports every root as uncovered on a Windows checkout
      // and cannot be run locally at all.
      roots.add(path.relative(REPO_ROOT, absolute).split(path.sep).join('/'));
    }
  }
  return [...roots].sort();
}

/**
 * The `paths:` list under each `on:` trigger. Hand-rolled because no service in
 * this repo carries a YAML parser dependency and CI must not need one.
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

/** Does a GitHub Actions path glob select `target` (a file or a directory)? */
function covers(filter: string, target: string): boolean {
  if (filter.endsWith('/**')) {
    const prefix = filter.slice(0, -3);
    return target === prefix || target.startsWith(`${prefix}/`);
  }
  return filter === target;
}

describe('backend CI path filters', () => {
  const yaml = readFileSync(WORKFLOW, 'utf8');
  const filters = pathFilters(yaml);

  it('declares the same filters for push and pull_request', () => {
    expect(filters['push']).toBeDefined();
    expect(filters['pull_request']).toEqual(filters['push']);
  });

  it('covers every path the contract:check scripts read', () => {
    const uncovered = resolvedRoots().filter(
      (root) => !(filters['push'] ?? []).some((filter) => covers(filter, root)),
    );
    expect(uncovered).toEqual([]);
  });

  it('watches the workflow file itself', () => {
    expect(filters['push']).toContain('.github/workflows/backend-ci.yml');
  });
});
