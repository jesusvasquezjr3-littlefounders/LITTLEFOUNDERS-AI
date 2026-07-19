import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { generate as generateCert } from 'selfsigned';
import type { Config } from '../config.js';

const require = createRequire(import.meta.url);

/**
 * Absolute path to the Haraka config directory (email-server/haraka), passed to
 * `haraka -c`. Resolved relative to this compiled module (dist/services) so it
 * works regardless of the process cwd.
 */
export function harakaDir(): string {
  return path.resolve(import.meta.dirname, '..', '..', 'haraka');
}

/**
 * Render the two config files that carry env/secrets into Haraka, so nothing
 * secret is ever committed. Called once at boot before the engine spawns.
 *   - config/me               → the HELO/hostname Haraka announces.
 *   - config/smtp_forward.ini  → the Amazon SES smarthost + SMTP AUTH creds.
 * Both are git-ignored (see email-server/.gitignore).
 */
export async function renderHarakaConfig(config: Config): Promise<void> {
  const configDir = path.join(harakaDir(), 'config');
  fs.mkdirSync(configDir, { recursive: true });

  fs.writeFileSync(path.join(configDir, 'me'), `${config.HARAKA_HOSTNAME}\n`, 'utf8');

  const smtpForward = [
    '; RENDERED AT BOOT from env by src/services/haraka.ts — do not edit or commit.',
    `host=${config.SES_RELAY_HOST}`,
    `port=${config.SES_RELAY_PORT}`,
    'enable_tls=true',
    'auth_type=plain',
    `auth_user=${config.SES_SMTP_USER}`,
    `auth_pass=${config.SES_SMTP_PASS}`,
    'enable_outbound=true',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(configDir, 'smtp_forward.ini'), smtpForward, { encoding: 'utf8', mode: 0o600 });

  await ensureTlsCert(configDir, config.HARAKA_HOSTNAME);
}

/**
 * Ensure a TLS keypair exists in the config dir. Haraka's tls_socket (pulled in
 * by queue/smtp_forward for the encrypted SES hop) tries to load these at boot
 * and logs ERRORs if absent — noise that could mask a real fault during the live
 * test. A boot-generated self-signed cert silences it and seeds the future
 * internal-TLS hardening. It does NOT enable inbound STARTTLS (the `tls` plugin,
 * which advertises it, is not loaded), so GoTrue's plaintext internal hop is
 * unaffected. Regenerated on each fresh container; git-ignored.
 */
async function ensureTlsCert(configDir: string, hostname: string): Promise<void> {
  const keyPath = path.join(configDir, 'tls_key.pem');
  const certPath = path.join(configDir, 'tls_cert.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) return;

  const pems = await generateCert([{ name: 'commonName', value: hostname }], {
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: hostname },
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '::1' },
        ],
      },
    ],
  });
  fs.writeFileSync(keyPath, pems.private, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(certPath, pems.cert, { encoding: 'utf8', mode: 0o644 });
}

/** Resolve the Haraka CLI shipped in node_modules. */
function harakaBin(): string {
  const pkgJson = require.resolve('Haraka/package.json');
  return path.join(path.dirname(pkgJson), 'bin', 'haraka');
}

/**
 * Spawn the Haraka engine as a child process, inheriting stdio so its logs land
 * in the container's stdout (Railway logs). The caller owns the lifecycle: if
 * this child exits, the supervisor exits non-zero so Railway restarts the service.
 */
export function startHaraka(config: Config): ChildProcess {
  const dir = harakaDir();
  const child = spawn(process.execPath, [harakaBin(), '-c', dir], {
    stdio: 'inherit',
    env: process.env,
  });
  console.log(
    `[email-server] haraka engine spawned (pid=${child.pid}) → relays to ${config.SES_RELAY_HOST}:${config.SES_RELAY_PORT}`,
  );
  return child;
}
