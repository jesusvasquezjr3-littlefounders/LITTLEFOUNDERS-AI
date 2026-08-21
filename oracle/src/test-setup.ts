/*
 * Fixture credentials. Every value starts with `test-`, which is the
 * placeholder convention `agent/tools/check-secrets.sh` exempts — see
 * /AGENTS.md §1.14. A 32-char secret that did NOT start with a declared
 * placeholder prefix would be treated as a real credential and fail the gate.
 */
process.env.NODE_ENV ??= 'test';
process.env.INTERNAL_API_KEY ??= 'test-internal-key-0123456789';
process.env.TUTOR_SESSION_SECRET ??= 'test-tutor-session-secret-0123456789abcd';
process.env.CORE_URL ??= 'http://localhost:4000';
process.env.CORE_INTERNAL_KEY ??= 'test-core-internal-key-0123456789';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.VOICE_PROVIDER ??= 'none';
