import { createApp, SERVICE } from './app.js';
import { getConfig } from './env.js';

const config = getConfig();

createApp().listen(config.PORT, () => {
  console.log(`[${SERVICE}] listening on :${config.PORT}`);
});
