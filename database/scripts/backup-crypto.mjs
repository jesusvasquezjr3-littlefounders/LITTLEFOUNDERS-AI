#!/usr/bin/env node
// Encrypted database backups for the cutover (H.5: backups hold family and
// Mentor data and must be encrypted at rest). A `pg_dump -Fc` file is
// encrypted with AES-256-GCM before it is stored anywhere, and the plaintext
// is deleted; a restore decrypts it and checks both the authentication tag
// and the plaintext SHA-256 recorded at backup time.
//
//   node backup-crypto.mjs keygen  --key-file <path>
//   node backup-crypto.mjs encrypt --in <dump> --out <dump.lfbk> --key-file <path> [--keep-plain]
//   node backup-crypto.mjs decrypt --in <dump.lfbk> --out <dump> --key-file <path>
//   node backup-crypto.mjs verify  --in <dump.lfbk> --key-file <path>
//
// File format LFBK1: the 6-byte magic "LFBK1\n", a 12-byte IV, the
// ciphertext, and the 16-byte GCM tag. A manifest (<file>.manifest.json)
// records sizes, both SHA-256 digests and the key fingerprint (the first 16
// hex of SHA-256 over the key; never the key). The key file holds 32 random
// bytes, base64; it lives in the operator's secret store, never next to the
// backup and never in the repository.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { closeSync, createReadStream, createWriteStream, existsSync, openSync, readFileSync, readSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';

export const MAGIC = Buffer.from('LFBK1\n');
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class BackupError extends Error {}

export function generateKey() {
  return randomBytes(32).toString('base64');
}

export function readKey(keyFile) {
  if (!keyFile || !existsSync(keyFile)) throw new BackupError('key file not found');
  const key = Buffer.from(readFileSync(keyFile, 'utf8').trim(), 'base64');
  if (key.length !== 32) throw new BackupError('the key file must hold 32 bytes, base64');
  return key;
}

export const fingerprint = (key) => createHash('sha256').update(key).digest('hex').slice(0, 16);

/** A pass-through stream that hashes what flows through it. */
function hashing(hash) {
  return new Transform({ transform(chunk, _enc, done) { hash.update(chunk); done(null, chunk); } });
}

export async function encryptFile(input, output, key, { keepPlain = false } = {}) {
  if (!existsSync(input) || statSync(input).size === 0) throw new BackupError('refusing an empty or missing dump');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plainHash = createHash('sha256');
  const out = createWriteStream(output);
  out.write(Buffer.concat([MAGIC, iv]));
  await pipeline(createReadStream(input), hashing(plainHash), cipher, out, { end: false });
  await new Promise((resolve, reject) => out.end(cipher.getAuthTag(), (error) => (error ? reject(error) : resolve())));
  const manifest = {
    format: 'LFBK1', cipher: 'aes-256-gcm', keyFingerprint: fingerprint(key),
    plaintextBytes: statSync(input).size, plaintextSha256: plainHash.digest('hex'),
    ciphertextBytes: statSync(output).size, ciphertextSha256: await sha256File(output),
    createdAt: new Date().toISOString(),
  };
  writeFileSync(`${output}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  if (!keepPlain) rmSync(input);
  return manifest;
}

export async function sha256File(file) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(file), new Writable({ write(chunk, _enc, done) { hash.update(chunk); done(); } }));
  return hash.digest('hex');
}

/**
 * Decrypts an LFBK1 file to `output` (or only authenticates it when output is
 * null). Refuses a wrong magic, a wrong key, a tampered byte and, when a
 * manifest is present, a plaintext whose SHA-256 differs from the one
 * recorded at backup time. A failed decryption leaves no output behind.
 */
export async function decryptFile(input, output, key) {
  const size = statSync(input).size;
  if (size < MAGIC.length + IV_BYTES + TAG_BYTES) throw new BackupError('not an LFBK1 backup (too short)');
  const fd = openSync(input, 'r');
  const head = Buffer.alloc(MAGIC.length + IV_BYTES);
  const tag = Buffer.alloc(TAG_BYTES);
  try {
    readSync(fd, head, 0, head.length, 0);
    readSync(fd, tag, 0, TAG_BYTES, size - TAG_BYTES);
  } finally { closeSync(fd); }
  if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new BackupError('not an LFBK1 backup (bad magic)');
  const manifestFile = `${input}.manifest.json`;
  const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : null;
  if (manifest && manifest.keyFingerprint !== fingerprint(key)) throw new BackupError('this key is not the key the backup was made with');
  const decipher = createDecipheriv('aes-256-gcm', key, head.subarray(MAGIC.length));
  decipher.setAuthTag(tag);
  const plainHash = createHash('sha256');
  const sink = output ? createWriteStream(output) : new Writable({ write(_c, _e, done) { done(); } });
  try {
    await pipeline(createReadStream(input, { start: head.length, end: size - TAG_BYTES - 1 }), decipher, hashing(plainHash), sink);
  } catch (error) {
    if (output) rmSync(output, { force: true });
    throw new BackupError(`decryption failed: the backup is damaged or the key is wrong (${error.message})`);
  }
  const plaintextSha256 = plainHash.digest('hex');
  if (manifest && manifest.plaintextSha256 !== plaintextSha256) {
    if (output) rmSync(output, { force: true });
    throw new BackupError('the decrypted dump does not match the digest recorded at backup time');
  }
  return { plaintextSha256, manifestChecked: Boolean(manifest) };
}

export function parseBackupArgs(argv) {
  const [command, ...rest] = argv;
  if (!['keygen', 'encrypt', 'decrypt', 'verify'].includes(command)) throw new BackupError(`unknown command ${command ?? '(none)'}`);
  const opts = { command, keepPlain: false };
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (flag === '--keep-plain') { opts.keepPlain = true; continue; }
    const v = rest[++i];
    if (v === undefined || v.startsWith('--')) throw new BackupError(`${flag} needs a value`);
    if (flag === '--in') opts.in = v;
    else if (flag === '--out') opts.out = v;
    else if (flag === '--key-file') opts.keyFile = v;
    else throw new BackupError(`unknown option ${flag}`);
  }
  if (!opts.keyFile) throw new BackupError('--key-file is required');
  if (command !== 'keygen' && !opts.in) throw new BackupError('--in is required');
  if ((command === 'encrypt' || command === 'decrypt') && !opts.out) throw new BackupError('--out is required');
  return opts;
}

export async function runBackup(opts) {
  if (opts.command === 'keygen') {
    if (existsSync(opts.keyFile)) throw new BackupError('refusing to overwrite an existing key file');
    writeFileSync(opts.keyFile, `${generateKey()}\n`, { mode: 0o600 });
    return { ok: true, keyFingerprint: fingerprint(readKey(opts.keyFile)) };
  }
  const key = readKey(opts.keyFile);
  if (opts.command === 'encrypt') return { ok: true, ...(await encryptFile(opts.in, opts.out, key, { keepPlain: opts.keepPlain })) };
  return { ok: true, ...(await decryptFile(opts.in, opts.command === 'decrypt' ? opts.out : null, key)) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(JSON.stringify(await runBackup(parseBackupArgs(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = error instanceof BackupError ? 2 : 1;
  }
}
