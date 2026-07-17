import { createApp, SERVICE } from './app.js';
import { getConfig } from './config.js';

const { PORT } = getConfig();
createApp().listen(PORT, () => {
  console.log(`[${SERVICE}] listening on :${PORT}`);
});
