import { build, preview } from 'vite';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../../', import.meta.url));
const configFile = fileURLToPath(new URL('./vite-audit.config.mjs', import.meta.url));
const at = process.argv.indexOf('--port');
const port = at < 0 ? 5181 : Number(process.argv[at + 1]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('--port must name an unprivileged TCP port');
const runDirectory = mkdtempSync(join(tmpdir(), 'lf-compiled-audit-'));
const outDir = join(runDirectory, 'dist');
const git = (args) => {
  try { return execFileSync('git', args, { cwd: join(frontend, '..'), encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }); }
  catch (error) { throw new Error(`Could not record source metadata (${error.code ?? 'Git failed'})`); }
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
const source = {
  gitHead: git(['rev-parse', 'HEAD']).trim(),
  trackedDiffSha256: digest(git(['diff', '--binary', 'HEAD', '--', 'frontend'])),
  productTreeSha256: digest(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'frontend/src', 'frontend/public', 'frontend/index.html', 'frontend/vite.config.ts', 'frontend/tsconfig.json', 'frontend/package.json', 'frontend/package-lock.json'])
    .split('\0').filter(Boolean).filter(path => !/\.(?:test|spec)\.[^.]+$|\/__tests__\//.test(path))
    .filter(path => { try { readFileSync(join(frontend, '..', path)); return true; } catch { return false; } })
    .sort().map(path => `${path}\0${digest(readFileSync(join(frontend, '..', path)))}`).join('\n')),
  untrackedFrontend: git(['ls-files', '--others', '--exclude-standard', '--', 'frontend']).trim().split('\n').filter(Boolean)
    .map(path => ({ path, sha256: digest(readFileSync(join(frontend, '..', path))) })),
};

// Compile the actual application, direct preview and same-source fixture entry together.
// Production mode measures the shipped product; authoring-only DEV routes are not audited states.
await build({ root: frontend, configFile, mode: 'production', build: { outDir, emptyOutDir: false } });
const server = await preview({ root: frontend, configFile, mode: 'production', build: { outDir },
  preview: { host: '127.0.0.1', port, strictPort: true } });
const origin = `http://127.0.0.1:${port}`;
writeFileSync(join(runDirectory, 'server.json'), JSON.stringify({ origin, outDir, mode: 'production', source,
  entries: ['index.html', 'rebuild.html', 'audit-fixtures.html'] }, null, 2));
console.log(`Compiled audit preview ready: ${origin}`);
console.log(`Audit-only output: ${outDir}`);
console.log(`Source metadata: ${join(runDirectory, 'server.json')}`);
console.log(`Run the unchanged full matrix with REBUILD_URL=${origin} AUDIT_COMPILED=1`);
const stop = () => server.httpServer.close(() => process.exit(0));
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
