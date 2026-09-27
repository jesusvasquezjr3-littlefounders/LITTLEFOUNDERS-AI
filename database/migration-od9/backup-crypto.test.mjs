// Unit tests for the encrypted cutover backups (H.5). The end-to-end use with
// pg_dump and pg_restore is rehearsed by rehearse-cutover.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackupError, decryptFile, encryptFile, fingerprint, MAGIC, parseBackupArgs, readKey, runBackup } from './backup-crypto.mjs';

const scratch = () => mkdtempSync(join(tmpdir(), 'lfbk-'));

test('encrypt then decrypt round-trips a dump, records a manifest and deletes the plaintext', async () => {
  const dir = scratch();
  try {
    const key = randomBytes(32);
    const plain = randomBytes(300_000); // several stream chunks
    writeFileSync(join(dir, 'db.dump'), plain);
    const manifest = await encryptFile(join(dir, 'db.dump'), join(dir, 'db.lfbk'), key);
    assert.equal(existsSync(join(dir, 'db.dump')), false, 'plaintext removed');
    const cipher = readFileSync(join(dir, 'db.lfbk'));
    assert.ok(cipher.subarray(0, MAGIC.length).equals(MAGIC));
    assert.equal(cipher.includes(plain.subarray(1000, 1064)), false, 'no plaintext run in the ciphertext');
    assert.equal(manifest.plaintextBytes, plain.length);
    assert.equal(manifest.ciphertextBytes, plain.length + MAGIC.length + 12 + 16);
    assert.equal(manifest.keyFingerprint, fingerprint(key));
    assert.doesNotMatch(readFileSync(join(dir, 'db.lfbk.manifest.json'), 'utf8'), new RegExp(key.toString('base64').replace(/[+/=]/g, '.')));
    const out = await decryptFile(join(dir, 'db.lfbk'), join(dir, 'back.dump'), key);
    assert.equal(out.manifestChecked, true);
    assert.ok(readFileSync(join(dir, 'back.dump')).equals(plain));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a wrong key, a flipped byte, a wrong digest or a foreign file are refused and leave no output', async () => {
  const dir = scratch();
  try {
    const key = randomBytes(32);
    writeFileSync(join(dir, 'db.dump'), randomBytes(50_000));
    await encryptFile(join(dir, 'db.dump'), join(dir, 'db.lfbk'), key);
    const target = join(dir, 'out.dump');
    await assert.rejects(decryptFile(join(dir, 'db.lfbk'), target, randomBytes(32)), /not the key the backup was made with/);

    // Without the manifest the wrong key still fails authentication.
    const manifest = readFileSync(join(dir, 'db.lfbk.manifest.json'), 'utf8');
    rmSync(join(dir, 'db.lfbk.manifest.json'));
    await assert.rejects(decryptFile(join(dir, 'db.lfbk'), target, randomBytes(32)), /decryption failed/);
    assert.equal(existsSync(target), false);
    writeFileSync(join(dir, 'db.lfbk.manifest.json'), manifest);

    const bytes = readFileSync(join(dir, 'db.lfbk'));
    bytes[bytes.length - 100] ^= 0x01;
    writeFileSync(join(dir, 'tampered.lfbk'), bytes);
    writeFileSync(join(dir, 'tampered.lfbk.manifest.json'), manifest);
    await assert.rejects(decryptFile(join(dir, 'tampered.lfbk'), target, key), /decryption failed/);
    assert.equal(existsSync(target), false, 'a failed decryption leaves nothing behind');

    writeFileSync(join(dir, 'db.lfbk.manifest.json'), JSON.stringify({ ...JSON.parse(manifest), plaintextSha256: '0'.repeat(64) }));
    await assert.rejects(decryptFile(join(dir, 'db.lfbk'), target, key), /does not match the digest/);
    assert.equal(existsSync(target), false);

    writeFileSync(join(dir, 'plain.dump'), Buffer.concat([Buffer.from('PGDMP'), randomBytes(100)]));
    await assert.rejects(decryptFile(join(dir, 'plain.dump'), target, key), /bad magic/);
    writeFileSync(join(dir, 'empty.dump'), '');
    await assert.rejects(encryptFile(join(dir, 'empty.dump'), join(dir, 'e.lfbk'), key), /empty or missing/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('keygen writes a 32-byte key once; the CLI parser refuses incomplete commands', async () => {
  const dir = scratch();
  try {
    const keyFile = join(dir, 'k');
    const made = await runBackup(parseBackupArgs(['keygen', '--key-file', keyFile]));
    assert.equal(readKey(keyFile).length, 32);
    assert.equal(made.keyFingerprint, fingerprint(readKey(keyFile)));
    await assert.rejects(runBackup(parseBackupArgs(['keygen', '--key-file', keyFile])), /refusing to overwrite/);
    writeFileSync(join(dir, 'short'), Buffer.alloc(8).toString('base64'));
    assert.throws(() => readKey(join(dir, 'short')), /32 bytes/);
    assert.throws(() => readKey(join(dir, 'absent')), /not found/);
    for (const bad of [[], ['backup'], ['encrypt', '--in', 'a', '--key-file', 'k'], ['decrypt', '--key-file', 'k', '--out', 'o'],
      ['verify', '--in', 'a'], ['encrypt', '--in', 'a', '--out', 'b', '--key-file'], ['verify', '--in', 'a', '--key-file', 'k', '--bogus', 'x']]) {
      assert.throws(() => parseBackupArgs(bad), BackupError, bad.join(' '));
    }
    assert.equal(parseBackupArgs(['encrypt', '--in', 'a', '--out', 'b', '--key-file', 'k', '--keep-plain']).keepPlain, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
