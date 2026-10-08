// Retired v1 entry point. Use v2:author and v2:publish.
import { refuseLegacyAuthoring } from '../pipeline/legacyRetirement.js';

try {
  refuseLegacyAuthoring();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
