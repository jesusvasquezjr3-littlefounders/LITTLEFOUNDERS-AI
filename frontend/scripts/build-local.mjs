import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * `npm run build:local` (S10L.2): the full production build (`prebuild` gates,
 * tsc, vite build, SEO pages) for LOCAL use while the owner style review of
 * the draft asset families (OD-14, Frontend Bible 07 §7) is pending.
 *
 * It only sets LF_LOCAL_DRAFT_ASSETS=1, which lets the asset gate
 * (scripts/check-rebuild-assets.mjs --release) accept `draft` assets; every
 * other gate is unchanged, and the gate refuses the override on CI or a
 * hosting builder. `npm run build` stays the strict release build.
 * The output is stamped with dist/LOCAL-DRAFT-BUILD.txt so it is never
 * mistaken for a releasable bundle.
 */
const frontend = resolve(import.meta.dirname, '..');
const npmCli = process.env.npm_execpath;
const [command, args] = npmCli ? [process.execPath, [npmCli, 'run', 'build']] : ['npm', ['run', 'build']];
const result = spawnSync(command, args, {
  cwd: frontend,
  stdio: 'inherit',
  shell: !npmCli && process.platform === 'win32',
  env: { ...process.env, LF_LOCAL_DRAFT_ASSETS: '1' },
});
if (result.status !== 0) process.exit(result.status ?? 1);
const dist = resolve(frontend, 'dist');
if (existsSync(dist)) {
  writeFileSync(resolve(dist, 'LOCAL-DRAFT-BUILD.txt'), [
    'Local build with draft assets (LF_LOCAL_DRAFT_ASSETS=1, npm run build:local).',
    'Not releasable: the owner style review of the draft asset families is pending (Frontend Bible 07 §6, OD-14).',
    `Built ${new Date().toISOString()}.`,
    '',
  ].join('\n'));
}
