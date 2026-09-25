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
/*
 * C.14 / C.15 default OFF in the unit suite, ON in production (`env.ts`
 * defaults both to `act`). Both moves change the shape of a session's early
 * turns — the goal-agreement move turns the learner's first message into a
 * restatement question with no activity, and the self-explanation question
 * follows a decision — which every older end-to-end test was written before.
 * The suites that own these components (`allianceController.test.ts`,
 * `selfExplanation.test.ts`, `alliance-session.test.ts`, the live-session
 * alliance tests) set them to `act` explicitly and cover how they interact
 * with the check-in, the stop offer, safety, moderation and the closing.
 */
process.env.TUTOR_ALLIANCE_CONTROLLER ??= 'off';
process.env.TUTOR_SELF_EXPLANATION ??= 'off';
