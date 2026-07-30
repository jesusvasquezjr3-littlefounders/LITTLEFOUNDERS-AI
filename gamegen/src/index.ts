import { createApp, SERVICE } from './app.js';
import { getBootPort } from './env.js';

/*
 * OPEN THE LISTENER NO MATTER WHAT (/AGENTS.md §1.14).
 *
 * This used to be `const config = getConfig()` at module scope, which meant any
 * env the schema disliked threw before `listen()` ever ran: the platform
 * healthcheck got connection-refused, Railway restarted the container, and the
 * same throw happened again forever. A service that cannot answer /health is
 * indistinguishable from a service that is down — so a bad OPTIONAL credential
 * would have taken Arcade completely offline (Core does the same thing for
 * Redis: listen first, degrade the dependency).
 *
 * `getBootPort()` therefore resolves the port without ever throwing, printing
 * the full operator-facing configuration error when there is one. The service
 * then boots DEGRADED: /health answers, and /api/v1 stays FAIL CLOSED because
 * app.ts refuses every request it cannot authenticate.
 */
const port = getBootPort();

createApp().listen(port, () => {
  console.log(`[${SERVICE}] listening on :${port}`);
});
