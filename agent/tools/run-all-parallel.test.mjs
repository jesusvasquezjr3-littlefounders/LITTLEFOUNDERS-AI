import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, it } from 'node:test'

const roots = []
afterEach(() => {
  const temp = resolve(tmpdir()) + sep
  for (const root of roots.splice(0)) {
    const target = resolve(root)
    assert.ok(target.startsWith(temp) && basename(target).startsWith('lf-run-all-test-'))
    rmSync(target, { recursive: true, force: true })
  }
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'lf-run-all-test-'))
  roots.push(root)
  const tools = join(root, 'agent', 'tools')
  const bin = join(root, 'mock-bin')
  const state = join(root, 'state')
  mkdirSync(tools, { recursive: true })
  mkdirSync(bin)
  mkdirSync(state)
  writeFileSync(join(tools, 'run-all.sh'), readFileSync(new URL('run-all.sh', import.meta.url)))
  for (const name of ['alpha', 'bravo', 'charlie', 'skip']) {
    mkdirSync(join(root, name))
    writeFileSync(join(root, name, 'package.json'), JSON.stringify({ scripts: name === 'skip' ? {} : { test: 'fixture' } }))
  }
  const npm = join(bin, 'npm')
  writeFileSync(npm, `#!/usr/bin/env bash
set -u
name="$(basename "$PWD")"
lock="$LF_RUN_ALL_STATE/lock"
while ! mkdir "$lock" 2>/dev/null; do sleep 0.005; done
active=$(cat "$LF_RUN_ALL_STATE/active" 2>/dev/null || echo 0)
active=$((active+1))
echo "$active" > "$LF_RUN_ALL_STATE/active"
max=$(cat "$LF_RUN_ALL_STATE/max" 2>/dev/null || echo 0)
[ "$active" -le "$max" ] || echo "$active" > "$LF_RUN_ALL_STATE/max"
echo "$name" >> "$LF_RUN_ALL_STATE/started"
rmdir "$lock"
if [ "\${LF_RUN_ALL_REQUIRE_ROLLING:-}" = 1 ] && [ "$name" = alpha ]; then
  found=0
  for _ in $(seq 1 200); do
    if grep -q '^charlie$' "$LF_RUN_ALL_STATE/started"; then found=1; break; fi
    sleep 0.005
  done
  [ "$found" -eq 1 ] || exit 70
fi
sleep 0.05
while ! mkdir "$lock" 2>/dev/null; do sleep 0.005; done
active=$(cat "$LF_RUN_ALL_STATE/active")
echo $((active-1)) > "$LF_RUN_ALL_STATE/active"
echo "$name" >> "$LF_RUN_ALL_STATE/finished"
rmdir "$lock"
[ "\${LF_RUN_ALL_FAIL:-}" != "$name" ]
`)
  chmodSync(npm, 0o755)
  return { root, state, bin }
}

function run({ root, state, bin }, jobs, fail = '', requireRolling = false) {
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash'
  const env = {
    ...process.env,
    PATH: `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
    LF_RUN_ALL_STATE: state,
  }
  delete env.LF_RUN_ALL_JOBS
  delete env.LF_RUN_ALL_FAIL
  delete env.LF_RUN_ALL_REQUIRE_ROLLING
  if (jobs !== undefined) env.LF_RUN_ALL_JOBS = jobs
  if (fail) env.LF_RUN_ALL_FAIL = fail
  if (requireRolling) env.LF_RUN_ALL_REQUIRE_ROLLING = '1'
  return spawnSync(bash, ['agent/tools/run-all.sh', 'test'], {
    cwd: root,
    encoding: 'utf8',
    env,
  })
}

const lines = (path) => readFileSync(path, 'utf8').trim().split(/\r?\n/).sort()

describe('run-all bounded workers', () => {
  it('runs every eligible service once with no more than the requested workers', () => {
    const fx = fixture()
    const result = run(fx, '2', '', true)

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.deepEqual(lines(join(fx.state, 'started')), ['alpha', 'bravo', 'charlie'])
    assert.deepEqual(lines(join(fx.state, 'finished')), ['alpha', 'bravo', 'charlie'])
    assert.equal(readFileSync(join(fx.state, 'max'), 'utf8').trim(), '2')
    assert.match(result.stdout, /skip: no 'test' script, skipping/)
  })

  it('defaults to serial execution', () => {
    const fx = fixture()
    const result = run(fx, undefined)

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.equal(readFileSync(join(fx.state, 'max'), 'utf8').trim(), '1')
  })

  it('waits for every service and aggregates failures', () => {
    const fx = fixture()
    const result = run(fx, '2', 'bravo')

    assert.equal(result.status, 1)
    assert.deepEqual(lines(join(fx.state, 'finished')), ['alpha', 'bravo', 'charlie'])
    assert.match(result.stderr, /run-all test FAILED in: bravo/)
  })

  it('rejects an invalid worker count before launching a service', () => {
    const fx = fixture()
    const result = run(fx, '5')

    assert.equal(result.status, 2)
    assert.match(result.stderr, /LF_RUN_ALL_JOBS must be an integer from 1 to 4/)
    assert.throws(() => readFileSync(join(fx.state, 'started')))
  })
})
