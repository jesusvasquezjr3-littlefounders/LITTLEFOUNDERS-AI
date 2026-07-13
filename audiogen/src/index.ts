import { createApp, SERVICE } from './app.js';
import { getConfig } from './env.js';
import { runBatchNarration } from './batch.js';

const config = getConfig();

createApp().listen(config.PORT, () => {
  console.log(`[${SERVICE}] listening on :${config.PORT}`);
});

// Batch narration is OPERATOR-OPT-IN (paid API calls) — never runs by default.
if (config.AUDIOGEN_RUN_ON_START) {
  runBatchNarration().catch((err) => {
    console.error('[audiogen] AUDIOGEN_RUN_ON_START batch failed:', err);
  });
}
