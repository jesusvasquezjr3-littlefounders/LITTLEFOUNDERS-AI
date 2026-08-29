/*
 * `npm run voice:probe-prosody` — does the voice provider INTERPRET a direction
 * tag, or READ IT OUT LOUD?
 *
 * WHY THIS MUST BE MEASURED BEFORE IT IS SHIPPED. The tutor already chooses an
 * `emotion` for every single turn — happy, thinking, encouraging, proud — from
 * a closed vocabulary, and the synthesizer never receives it: the call site
 * passes `turn.say` and drops the rest. That is the blueprint's differentiator
 * #2, "prosodia dirigida por pedagogía", computed and discarded, and it is the
 * fourth field found in one day travelling correctly into something that
 * ignores it.
 *
 * The blueprint says Inworld renders inline direction tags — `[warm]`,
 * `[excited]` — as real audio events. Our TTS request has no emotion field, so
 * inline tags are the only route. And if that is wrong, the tag is not ignored:
 * it is SPOKEN. A child asks why money grows and the tutor answers "corchete
 * warm cierra corchete, imagina que guardas diez pesos". That is a worse defect
 * than the one being fixed, in front of the youngest users, and no unit test
 * can see it because the failure is in the audio.
 *
 * So this asks the provider. The same sentence is synthesized three ways, and
 * the AUDIO LENGTH answers the question: a tag that directs delivery produces
 * audio close to the plain sentence, and a tag that is read aloud produces
 * audibly more of it. Bytes are a proxy for duration at a fixed bitrate, which
 * is what a fixed model and encoding give us.
 *
 * It changes nothing. Costs three short syntheses.
 */

import process from 'node:process';
import { getConfig } from '../src/env.js';
import { getVoiceProvider } from '../src/voice/index.js';
import type { Locale } from '../src/context/schema.js';

const SENTENCE =
  'Imagina que guardas diez pesos en el banco y cada año te dan uno extra por dejarlo ahí.';

const CASES = [
  { name: 'plain (what production says today)', text: SENTENCE },
  { name: 'square-bracket tag', text: `[warm] ${SENTENCE}` },
  { name: 'angle-bracket tag', text: `<warm> ${SENTENCE}` },
];

async function main(): Promise<void> {
  const config = getConfig();
  const provider = getVoiceProvider();
  if (!provider.available) {
    console.error('No voice provider is available — nothing to measure.');
    process.exit(1);
  }

  const locale: Locale = 'es-MX';
  console.log(`== Direction tags against ${config.VOICE_PROVIDER}, ${locale} ==`);
  console.log('');

  const results: { name: string; bytes: number }[] = [];
  for (const testCase of CASES) {
    try {
      const result = await provider.synthesize({
        text: testCase.text,
        character: 'rho',
        locale,
      });
      const bytes = result.audio.byteLength;
      results.push({ name: testCase.name, bytes });
      console.log(`  ${String(bytes).padStart(7)} bytes  ${testCase.name}`);
    } catch (error) {
      console.log(`  FAILED           ${testCase.name} — ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log('');
  const plain = results.find((r) => r.name.startsWith('plain'));
  if (!plain || results.length < 2) {
    console.log('  Not enough successful syntheses to compare.');
    process.exit(1);
  }

  console.log('== What this means ==');
  for (const result of results) {
    if (result === plain) continue;
    const ratio = result.bytes / plain.bytes;
    /*
     * A spoken "[warm]" adds roughly a word to a twenty-word sentence, so the
     * threshold is deliberately generous: anything within 8% is noise from the
     * encoder, and a clear increase means the tag became speech.
     */
    if (ratio > 1.08) {
      console.log(
        `  ${result.name}: ${Math.round((ratio - 1) * 100)}% MORE audio — the tag is being SPOKEN. Do not use it.`,
      );
    } else if (ratio < 0.92) {
      console.log(`  ${result.name}: ${Math.round((1 - ratio) * 100)}% less audio — something was dropped. Investigate.`);
    } else {
      console.log(
        `  ${result.name}: within ${Math.round(Math.abs(ratio - 1) * 100)}% of plain — consistent with the tag being CONSUMED as direction.`,
      );
      console.log('    Not proof it changed the delivery, only that it was not read aloud.');
      console.log('    A person has to listen before this ships to a child.');
    }
  }
}

await main();
