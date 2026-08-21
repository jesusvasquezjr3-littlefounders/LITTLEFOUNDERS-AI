import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// fileURLToPath, never URL.pathname: on Windows the latter yields
// '/C:/...', which path.resolve turns into 'C:\C:\...' and every read
// dies with ENOENT before a single assertion runs.
const root = fileURLToPath(new URL('../..', import.meta.url));
const script = path.join(root, 'agent/tools/railway-preflight.sh');
const temp = await mkdtemp(path.join(os.tmpdir(), 'littlefounders-railway-preflight-'));
const fakeBin = path.join(temp, 'bin');
const fakeRailway = path.join(fakeBin, 'railway');

// The status payload always carries TWO environments so every run pins the
// environment filter: staging holds a RUNNING retired gamegen and a sleeping
// backend, and neither may leak into a production inspection. In production,
// picturegen is present without a RUNNING instance — the documented
// scale-to-zero state (DEPLOYMENT.md §6), which must WARN, not FAIL. The
// "crashed" fixture puts a CRASHED instance on an allowlisted scale-to-zero
// service (coursegen): crashed is never "asleep" and must hard-fail. The
// variables handler is environment-sensitive — staging is missing
// coursegen/QWEN_API_KEY — so the -e threading in read_variables is pinned:
// dropping it either errors (no --environment) or reads the wrong payload.
//
// `oracle` is RUNNING in the production fixtures and deliberately NOT on the
// scale-to-zero allowlist: it terminates the browser's tutor websocket, so a
// cold start would happen in front of a learner who just pressed the button.
// A sleeping oracle is a real failure, not an expected state.
await mkdir(fakeBin, { recursive: true });
await writeFile(
  fakeRailway,
  `#!/usr/bin/env bash
set -euo pipefail
fixture="\${PREFLIGHT_FIXTURE:-good}"
if [[ "\${1:-}" == "status" ]]; then
  case "$fixture" in
    good|mismatched)
      cat <<'JSON'
{"environments":{"edges":[{"node":{"name":"production","serviceInstances":{"edges":[{"node":{"serviceName":"littlefounders-backend","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"coursegen","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"audiogen","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"picturegen","activeDeployments":[]}},{"node":{"serviceName":"parent-id-check","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"email-server","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"filebase","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"dataintel","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"oracle","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}}]}}},{"node":{"name":"staging","serviceInstances":{"edges":[{"node":{"serviceName":"gamegen","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"littlefounders-backend","activeDeployments":[]}}]}}}]}}
JSON
      ;;
    crashed)
      cat <<'JSON'
{"environments":{"edges":[{"node":{"name":"production","serviceInstances":{"edges":[{"node":{"serviceName":"littlefounders-backend","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"coursegen","activeDeployments":[{"instances":[{"status":"CRASHED"}]}]}},{"node":{"serviceName":"audiogen","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"picturegen","activeDeployments":[]}},{"node":{"serviceName":"parent-id-check","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"email-server","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"filebase","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"dataintel","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"oracle","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}}]}}},{"node":{"name":"staging","serviceInstances":{"edges":[]}}}]}}
JSON
      ;;
    *)
      cat <<'JSON'
{"environments":{"edges":[{"node":{"name":"production","serviceInstances":{"edges":[{"node":{"serviceName":"coursegen"}},{"node":{"serviceName":"gamegen"}},{"node":{"serviceName":"littlefounders-backend"}}]}}},{"node":{"name":"staging","serviceInstances":{"edges":[{"node":{"serviceName":"dataintel","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}}]}}}]}}
JSON
      ;;
  esac
  exit 0
fi
if [[ "\${1:-}" == "variable" && "\${2:-}" == "list" ]]; then
  service=""
  environment=""
  previous=""
  for arg in "$@"; do
    if [[ "$previous" == "--service" ]]; then service="$arg"; fi
    if [[ "$previous" == "--environment" ]]; then environment="$arg"; fi
    previous="$arg"
  done
  if [[ -z "$environment" ]]; then
    echo "fake railway: variable list called without --environment" >&2
    exit 2
  fi
  if [[ "$fixture" == "bad" ]]; then
    printf '%s' '{}'
    exit 0
  fi
  if [[ "$fixture" == "mismatched" ]]; then
    # Everything present and correct EXCEPT the shared session secret: the
    # failure mode that no presence check can see.
    case "$service" in
      coursegen) printf '%s' '{"DEEPSEEK_API_KEY":"configured-value","QWEN_API_KEY":"configured-value","PICTUREGEN_URL":"https://picturegen.internal","PICTUREGEN_INTERNAL_KEY":"configured-value"}' ;;
      audiogen) printf '%s' '{"TTS_API_KEY":"configured-value"}' ;;
      picturegen) printf '%s' '{"IMAGE_API_KEY":"configured-value"}' ;;
      oracle) printf '%s' '{"INTERNAL_API_KEY":"oracle-service-key","TUTOR_SESSION_SECRET":"a-different-secret","CORE_URL":"http://littlefounders-backend.internal:4000","CORE_INTERNAL_KEY":"configured-value","MODEL_API_KEY":"configured-value","JUDGE_API_KEY":"configured-value"}' ;;
      littlefounders-backend) printf '%s' '{"DATAINTEL_URL":"http://dataintel.internal:4008","DATAINTEL_INTERNAL_KEY":"configured-value","ORACLE_URL":"http://oracle.internal:4009","ORACLE_PUBLIC_URL":"https://tutor-b2c.littlefounders.ai","ORACLE_INTERNAL_KEY":"oracle-service-key","TUTOR_SESSION_SECRET":"shared-session-secret","FILEBASE_URL":"http://filebase.internal:4006","FILEBASE_INTERNAL_KEY":"configured-value"}' ;;
      *) printf '%s' '{}' ;;
    esac
    exit 0
  fi
  if [[ "$environment" == "staging" ]]; then
    case "$service" in
      coursegen) printf '%s' '{"DEEPSEEK_API_KEY":"configured-value","PICTUREGEN_URL":"https://picturegen.internal","PICTUREGEN_INTERNAL_KEY":"configured-value"}' ;;
      audiogen) printf '%s' '{"TTS_API_KEY":"configured-value"}' ;;
      picturegen) printf '%s' '{"IMAGE_API_KEY":"configured-value"}' ;;
      littlefounders-backend) printf '%s' '{"DATAINTEL_URL":"http://dataintel.internal:4008","DATAINTEL_INTERNAL_KEY":"configured-value"}' ;;
      *) printf '%s' '{}' ;;
    esac
    exit 0
  fi
  case "$service" in
    coursegen) printf '%s' '{"DEEPSEEK_API_KEY":"configured-value","QWEN_API_KEY":"configured-value","PICTUREGEN_URL":"https://picturegen.internal","PICTUREGEN_INTERNAL_KEY":"configured-value"}' ;;
    audiogen) printf '%s' '{"TTS_API_KEY":"configured-value"}' ;;
    picturegen) printf '%s' '{"IMAGE_API_KEY":"configured-value"}' ;;
    oracle) printf '%s' '{"INTERNAL_API_KEY":"oracle-service-key","TUTOR_SESSION_SECRET":"shared-session-secret","CORE_URL":"http://littlefounders-backend.internal:4000","CORE_INTERNAL_KEY":"configured-value","MODEL_API_KEY":"configured-value","JUDGE_API_KEY":"configured-value"}' ;;
    littlefounders-backend) printf '%s' '{"DATAINTEL_URL":"http://dataintel.internal:4008","DATAINTEL_INTERNAL_KEY":"configured-value","ORACLE_URL":"http://oracle.internal:4009","ORACLE_PUBLIC_URL":"https://tutor-b2c.littlefounders.ai","ORACLE_INTERNAL_KEY":"oracle-service-key","TUTOR_SESSION_SECRET":"shared-session-secret","FILEBASE_URL":"http://filebase.internal:4006","FILEBASE_INTERNAL_KEY":"configured-value"}' ;;
    *) printf '%s' '{}' ;;
  esac
  exit 0
fi
echo "unexpected fake Railway invocation" >&2
exit 2
`,
  'utf8',
);
await chmod(fakeRailway, 0o755);

function run(fixture, { trace = false, environment } = {}) {
  const args = trace ? ['-x', script] : [script];
  if (environment !== undefined) args.push(environment);
  return spawnSync('bash', args, {
    cwd: root,
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}`, PREFLIGHT_FIXTURE: fixture },
    encoding: 'utf8',
  });
}

try {
  const good = run('good');
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /railway-preflight OK/);
  // Staging's RUNNING gamegen and sleeping backend must not leak into the
  // production inspection.
  assert.match(good.stdout, /retired gamegen service absent/);
  assert.match(good.stdout, /service present and RUNNING: littlefounders-backend/);
  // Scale-to-zero service asleep in production: WARN, never FAIL.
  assert.match(good.stdout, /WARN: service present but not RUNNING \(scale-to-zero, likely asleep\): picturegen/);
  assert.doesNotMatch(good.stdout, /FAIL.*picturegen/);
  // Production variables are read from the production environment payload —
  // the staging payload deliberately lacks this key.
  assert.match(good.stdout, /OK: coursegen\/QWEN_API_KEY configured/);
  assert.doesNotMatch(good.stdout, /configured-value/);

  // `bash -x` is the operator's standard first debugging move; the "never
  // prints secret values" contract must hold in the trace stream too.
  const traced = run('good', { trace: true });
  assert.equal(traced.status, 0, traced.stderr);
  assert.doesNotMatch(traced.stdout, /configured-value/);
  assert.doesNotMatch(traced.stderr, /configured-value/);

  // Inspecting staging must not be satisfied by production's services — and
  // must see staging's own retired gamegen.
  const staging = run('good', { environment: 'staging' });
  assert.equal(staging.status, 1, staging.stderr);
  assert.match(staging.stdout, /service missing: coursegen/);
  assert.match(staging.stdout, /retired service still present: gamegen/);
  // Variables must be read with -e for the inspected environment: staging's
  // payload lacks QWEN_API_KEY, so a preflight that actually threads the
  // environment reports it — one that silently reads production goes green
  // here and fails this assertion.
  assert.match(staging.stdout, /FAIL: coursegen\/QWEN_API_KEY missing/);

  // A CRASHED instance on an allowlisted scale-to-zero service is a hard
  // failure — "asleep" means NO active instances, never a crash-looping one.
  const crashed = run('crashed');
  assert.equal(crashed.status, 1, crashed.stderr);
  assert.match(crashed.stdout, /railway-preflight FAILED/);
  assert.match(crashed.stdout, /FAIL: service has a crashed\/failed instance: coursegen/);
  assert.doesNotMatch(crashed.stdout, /WARN.*coursegen/);
  // The sibling scale-to-zero service with no instances still only warns.
  assert.match(crashed.stdout, /WARN: service present but not RUNNING \(scale-to-zero, likely asleep\): picturegen/);
  // Variables are fully configured in this fixture, so the crash is the ONLY
  // failure — the exit code is attributable to it alone.
  assert.match(crashed.stdout, /railway-preflight FAILED — 1 failure\(s\)/);
  assert.doesNotMatch(crashed.stdout, /configured-value/);

  // A shared secret that DIFFERS across the pair: everything is present, every
  // health check would be green, and every tutor socket would close "bad
  // signature". Presence checks cannot see this; equality can.
  const mismatched = run('mismatched');
  assert.equal(mismatched.status, 1, mismatched.stdout);
  assert.match(mismatched.stdout, /TUTOR_SESSION_SECRET DIFFERS/);
  assert.match(mismatched.stdout, /every tutor websocket will be refused/);
  // And it still never prints a value.
  assert.doesNotMatch(mismatched.stdout, /a-different-secret|shared-session-secret/);

  const bad = run('bad');
  assert.equal(bad.status, 1, bad.stderr);
  assert.match(bad.stdout, /railway-preflight FAILED/);
  // dataintel RUNNING in staging only — production must still report it missing.
  assert.match(bad.stdout, /service missing: dataintel/);
  assert.match(bad.stdout, /retired service still present: gamegen/);
  // Hot-path service without a RUNNING instance stays a hard failure; the
  // scale-to-zero one in the same state only warns.
  assert.match(bad.stdout, /FAIL: service is present but has no RUNNING instance: littlefounders-backend/);
  assert.match(bad.stdout, /WARN: service present but not RUNNING \(scale-to-zero, likely asleep\): coursegen/);
  assert.doesNotMatch(bad.stdout, /configured-value/);

  console.log('railway-preflight integration OK — env-scoped (status AND variables), crash-aware, read-only, secret-free (including under bash -x)');
} finally {
  await rm(temp, { recursive: true, force: true });
}
