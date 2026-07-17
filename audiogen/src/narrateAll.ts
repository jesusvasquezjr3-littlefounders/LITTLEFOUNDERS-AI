// Manual trigger: `npm run narrate:all` — same batch as AUDIOGEN_RUN_ON_START,
// runnable on demand without restarting the service. Operator-opt-in, paid.
import { runBatchNarration } from './batch.js';

runBatchNarration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[audiogen] narrate:all failed:', err);
    process.exit(1);
  });
