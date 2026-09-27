// OD-28 (owner review O-01): Engineering prepares CODEOWNERS and the exact
// branch ruleset for the governed Mentor code; the owner applies the ruleset
// (docs/operations/BRANCH-PROTECTION.md). These checks keep the prepared files
// true to the governance registry and to the CI job the ruleset requires.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const read = (f) => readFileSync(`${repo}${f}`, 'utf8').replace(/\r\n/g, '\n');

/** CODEOWNERS entries as [pattern, owners[]], comments and blanks dropped. */
export function codeownerEntries(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [pattern, ...owners] = l.split(/\s+/);
      return [pattern, owners];
    });
}

/** Does an anchored CODEOWNERS pattern (a directory ending in `/`, or an exact file) cover a repo path? */
export function covers(pattern, repoPath) {
  const p = pattern.replace(/^\//, '');
  return p.endsWith('/') ? repoPath.startsWith(p) : repoPath === p;
}

/** Every path the governance registry says is governed: its roots and every component path or split file. */
export function governedPaths(registry) {
  const out = new Set(registry.governedRoots ?? []);
  for (const c of registry.components ?? []) {
    for (const p of c.paths ?? []) out.add(p);
    for (const s of c.symbols ?? []) out.add(s.file);
  }
  return [...out].sort();
}

export function uncovered(registry, entries) {
  return governedPaths(registry).filter((p) => !entries.some(([pattern, owners]) => owners.length > 0 && covers(pattern, p)));
}

const registry = JSON.parse(read('docs/rebuild/mentor/governance/registry.json'));
const entries = codeownerEntries(read('.github/CODEOWNERS'));

test('CODEOWNERS covers every governed root and every component file of the registry', () => {
  assert.deepEqual(uncovered(registry, entries), []);
});

test('every CODEOWNERS entry is anchored and names an owner', () => {
  for (const [pattern, owners] of entries) {
    assert.ok(pattern.startsWith('/'), `${pattern}: anchor the pattern at the repository root`);
    assert.ok(owners.length > 0 && owners.every((o) => /^@[\w-]+(\/[\w-]+)?$/.test(o)), `${pattern}: names a GitHub owner`);
  }
});

test('a registry path CODEOWNERS misses is reported (mutation)', () => {
  const grown = { ...registry, governedRoots: [...registry.governedRoots, 'oracle/src/newGovernedRoot/'] };
  assert.deepEqual(uncovered(grown, entries), ['oracle/src/newGovernedRoot/']);
  const dropped = entries.filter(([p]) => p !== '/oracle/src/env.ts');
  assert.deepEqual(uncovered(registry, dropped), ['oracle/src/env.ts']);
});

test('the ruleset requires exactly the mentor-governance job repo-gates.yml runs, and a code-owner review', () => {
  const ruleset = JSON.parse(read('docs/operations/mentor-governance-ruleset.json'));
  const workflow = read('.github/workflows/repo-gates.yml');
  const job = /\n {2}mentor-governance:\n {4}name: (.+)\n/.exec(workflow);
  assert.ok(job, 'repo-gates.yml has a mentor-governance job with a name');
  assert.ok(!/\n {4}paths:/.test(workflow.split('\njobs:')[0]), 'repo-gates.yml stays unfiltered, so the required check always reports');
  const checks = ruleset.rules.find((r) => r.type === 'required_status_checks').parameters.required_status_checks;
  assert.deepEqual(checks.map((c) => c.context), [job[1].trim()]);
  assert.equal(checks[0].integration_id, 15368, 'only the GitHub Actions app may satisfy the check');
  const pr = ruleset.rules.find((r) => r.type === 'pull_request').parameters;
  assert.equal(pr.require_code_owner_review, true);
  assert.deepEqual(ruleset.conditions.ref_name.include, ['~DEFAULT_BRANCH']);
  assert.equal(ruleset.enforcement, 'active');
  // The operations doc shows the same JSON the command applies.
  const doc = read('docs/operations/BRANCH-PROTECTION.md');
  assert.match(doc, /--input docs\/operations\/mentor-governance-ruleset\.json/);
  assert.ok(doc.includes(job[1].trim()));
});
