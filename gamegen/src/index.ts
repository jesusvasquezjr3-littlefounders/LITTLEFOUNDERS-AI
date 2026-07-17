import { createApp, SERVICE } from './app.js';

const port = Number(process.env.PORT ?? 4003);
createApp().listen(port, () => {
  console.log(`[${SERVICE}] listening on :${port}`);
});
