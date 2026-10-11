// Mints the key of a database role that is reached through the REST interface: a token signed with
// the stack's JWT secret that names the role. The gateway lets it through to the REST routes only
// (database/railway/kong/kong.yml) and the database gives it what the role was granted, no more.
//
//   JWT_SECRET=... node database/scripts/mint-role-key.mjs mail_service
//
// The secret is read from the environment, never from an argument (arguments show in the process
// list and the shell history). The key is printed to standard output and nowhere else: put it
// straight into the secret store of the two services that need it. It is valid for five years, like
// the stack's other keys; mint a new one and replace both copies to rotate it.
import { createHmac } from 'node:crypto';

const ROLES = new Set(['mail_service']);
const YEARS = 5;

const role = process.argv[2];
const secret = process.env.JWT_SECRET;

if (!role || !ROLES.has(role)) {
  console.error(`usage: JWT_SECRET=... node mint-role-key.mjs <${[...ROLES].join('|')}>`);
  process.exit(1);
}

if (!secret || secret.length < 16) {
  console.error('JWT_SECRET is not set (the stack\'s JWT secret, at least 16 characters)');
  process.exit(1);
}

const encode = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
const issuedAt = Math.floor(Date.now() / 1000);
const content = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, iss: 'supabase', iat: issuedAt, exp: issuedAt + YEARS * 365 * 24 * 60 * 60 })}`;

process.stdout.write(`${content}.${createHmac('sha256', secret).update(content, 'ascii').digest('base64url')}\n`);
