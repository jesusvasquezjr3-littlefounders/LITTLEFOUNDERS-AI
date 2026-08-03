import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const script = path.join(root, 'agent/tools/railway-preflight.sh');
const temp = await mkdtemp(path.join(os.tmpdir(), 'littlefounders-railway-preflight-'));
const fakeBin = path.join(temp, 'bin');
const fakeRailway = path.join(fakeBin, 'railway');

await mkdir(fakeBin, { recursive: true });
await writeFile(
  fakeRailway,
  `#!/usr/bin/env bash
set -euo pipefail
fixture="\${PREFLIGHT_FIXTURE:-good}"
if [[ "\${1:-}" == "status" ]]; then
  if [[ "$fixture" == "good" ]]; then
    cat <<'JSON'
{"environments":{"edges":[{"node":{"serviceInstances":{"edges":[{"node":{"serviceName":"littlefounders-backend","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"coursegen","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"audiogen","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"picturegen","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"parent-id-check","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"email-server","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"filebase","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}},{"node":{"serviceName":"dataintel","activeDeployments":[{"instances":[{"status":"RUNNING"}]}]}}]}}}]}}
JSON
  else
    cat <<'JSON'
{"environments":{"edges":[{"node":{"serviceInstances":{"edges":[{"node":{"serviceName":"coursegen"}},{"node":{"serviceName":"gamegen"}}]}}}]}}
JSON
  fi
  exit 0
fi
if [[ "\${1:-}" == "variable" && "\${2:-}" == "list" ]]; then
  service=""
  previous=""
  for arg in "$@"; do
    if [[ "$previous" == "--service" ]]; then service="$arg"; fi
    previous="$arg"
  done
  if [[ "$fixture" == "good" ]]; then
    case "$service" in
      coursegen) printf '%s' '{"DEEPSEEK_API_KEY":"configured-value","QWEN_API_KEY":"configured-value","PICTUREGEN_URL":"https://picturegen.internal","PICTUREGEN_INTERNAL_KEY":"configured-value"}' ;;
      audiogen) printf '%s' '{"TTS_API_KEY":"configured-value"}' ;;
      picturegen) printf '%s' '{"IMAGE_API_KEY":"configured-value"}' ;;
      littlefounders-backend) printf '%s' '{"DATAINTEL_URL":"http://dataintel.internal:4008","DATAINTEL_INTERNAL_KEY":"configured-value"}' ;;
      *) printf '%s' '{}' ;;
    esac
  else
    printf '%s' '{}'
  fi
  exit 0
fi
echo "unexpected fake Railway invocation" >&2
exit 2
`,
  'utf8',
);
await chmod(fakeRailway, 0o755);

function run(fixture) {
  return spawnSync('bash', [script], {
    cwd: root,
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}`, PREFLIGHT_FIXTURE: fixture },
    encoding: 'utf8',
  });
}

try {
  const good = run('good');
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /railway-preflight OK/);
  assert.doesNotMatch(good.stdout, /configured-value/);

  const bad = run('bad');
  assert.equal(bad.status, 1, bad.stderr);
  assert.match(bad.stdout, /railway-preflight FAILED/);
  assert.match(bad.stdout, /service missing: dataintel/);
  assert.match(bad.stdout, /retired service still present: gamegen/);
  assert.doesNotMatch(bad.stdout, /configured-value/);

  console.log('railway-preflight integration OK — good and failing fixtures are read-only and secret-free');
} finally {
  await rm(temp, { recursive: true, force: true });
}
