import { createApp, SERVICE } from './app.js';
import { getConfig } from './env.js';

// Env is validated (and frozen) once here, at boot — the service crashes on
// invalid env immediately, never at request time (agent/core/CONVENTIONS.md).
const config = getConfig();

createApp().listen(config.PORT, () => {
  console.log(`[${SERVICE}] listening on :${config.PORT}`);
});
