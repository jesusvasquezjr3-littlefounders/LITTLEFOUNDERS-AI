// Checks that the content security policy in vercel.json still allows what the built site needs.
// It runs at the end of `npm run build`, so a policy that would break production fails the build
// instead of being found by a visitor.
//
//   node scripts/security-headers.mjs          check
//   node scripts/security-headers.mjs --fix    rewrite the inline scripts' hashes in vercel.json
//
// What it checks:
//   - every inline script of the built pages (the theme boot script of index.html) has its
//     sha256 hash in script-src, because the policy allows no other inline script;
//   - the hosts the build was configured with are allowed: Core (VITE_BACKEND_URL) in connect-src,
//     and each analytics script (VITE_PLAUSIBLE_SRC, VITE_UMAMI_SRC) in script-src and connect-src.
//     A variable that is not set, or that points at this machine (a local build), is not checked.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const configPath = join(root, 'vercel.json');

const dist = join(root, 'dist');

const fix = process.argv.includes('--fix');

const raw = readFileSync(configPath, 'utf8');

const config = JSON.parse(raw);

const header = config.headers.flatMap((block) => block.headers).find((entry) => entry.key === 'Content-Security-Policy');

if (!header) fail('vercel.json has no Content-Security-Policy header');

/** The policy as a map from directive to its sources. */
function parse(policy) {
  return new Map(policy.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name, ...sources] = part.split(/\s+/);

    return [name, sources];
  }));
}

function fail(message) {
  console.error(`security-headers: ${message}`);
  process.exit(1);
}

// Scripts the browser runs: no `src`, and no `type` that makes the element a data block.
const INLINE = /<script(?![^>]*\ssrc=)(?![^>]*\stype="(?!module|text\/javascript)[^"]*")[^>]*>([\s\S]*?)<\/script>/g;

const hashes = new Set();

for (const file of readdirSync(dist).filter((name) => name.endsWith('.html'))) {
  for (const match of readFileSync(join(dist, file), 'utf8').matchAll(INLINE)) {
    hashes.add(`'sha256-${createHash('sha256').update(match[1], 'utf8').digest('base64')}'`);
  }
}

let policy = parse(header.value);

if (fix) {
  const kept = (policy.get('script-src') ?? []).filter((source) => !source.startsWith("'sha256-"));
  const scriptSrc = ['script-src', ...kept.slice(0, 1), ...hashes, ...kept.slice(1)].join(' ');
  const next = header.value.replace(/script-src [^;]*/, scriptSrc);

  if (next !== header.value) {
    writeFileSync(configPath, raw.replace(JSON.stringify(header.value), JSON.stringify(next)));
    console.log('security-headers: inline script hashes rewritten in vercel.json');
  }

  policy = parse(next);
}

const problems = [];

const allows = (directive, source) => (policy.get(directive) ?? []).includes(source);

for (const hash of hashes) {
  if (!allows('script-src', hash)) problems.push(`script-src lacks ${hash} (an inline script changed: run "node scripts/security-headers.mjs --fix")`);
}

for (const source of policy.get('script-src') ?? []) {
  if (source.startsWith("'sha256-") && !hashes.has(source)) problems.push(`script-src holds ${source}, which matches no inline script any more (run --fix)`);
}

for (const [name, directives] of [['VITE_BACKEND_URL', ['connect-src']], ['VITE_PLAUSIBLE_SRC', ['script-src', 'connect-src']], ['VITE_UMAMI_SRC', ['script-src', 'connect-src']]]) {
  const value = process.env[name];

  if (!value) continue;

  let origin;

  let hostname;

  try {
    ({ origin, hostname } = new URL(value));
  } catch {
    problems.push(`${name} is not an address`);
    continue;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') continue;

  for (const directive of directives) {
    if (!allows(directive, origin)) problems.push(`${directive} lacks ${origin} (the host of ${name}): add it to the policy in vercel.json`);
  }
}

for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'"]) {
  if (allows('script-src', forbidden)) problems.push(`script-src must not hold ${forbidden}`);
}

if (problems.length > 0) fail(`the policy in vercel.json does not match the build:\n  - ${problems.join('\n  - ')}`);

console.log(`security-headers: policy matches the build (${hashes.size} inline script, ${[...policy.keys()].length} directives)`);
