// B.18 — redundancy gate: on-screen text versus narration (Mayer's redundancy
// principle, Appendix B §1.5).
//
// The rule, from the SPEC and Frontend 08 §5 ("The Forge content gate for
// authored segments follows B.18 (no long on-screen text duplicating
// narration)"):
//
//   A narrated on-screen block may repeat its narration word for word only
//   while it is a caption: at most one Mentor turn (Bible 06: 20 words and 2
//   sentences, 12 words for ages 6–9, ×1.25 for es-MX/pt-BR). A LONGER block
//   that substantially duplicates what is being read aloud fails, and the
//   author must either differentiate the two (narration explains, the text
//   labels or cues: `narration.mode = differentiated` + `script_md`), shorten
//   the block to a caption, or deliberately choose one channel for the segment
//   (`narration.mode = text_only`).
//
// "Substantially duplicates" is measured, not judged: the share of the block's
// words that sit inside a run of at least three consecutive words also found
// in the narration (shorter blocks need the whole block). The 0.6 threshold is
// a starting point recorded in the Threshold Recalibration Log.

import { tokens, countSentences, countWords, excerpt } from './text.js';
import { captionLimit, type Audience, type ContentLocale } from './budgets.js';
import type { NarrationUnit, ScreenBlock } from './lessonModel.js';

export const REDUNDANCY_THRESHOLD = 0.6;
/** A differentiated script that adds less than this share of new words is not a differentiation. */
export const SCRIPT_REPEAT_THRESHOLD = 0.8;
/** The shortest run of consecutive words that counts as verbatim (Block B threshold log). */
export const VERBATIM_RUN_WORDS = 3;

/** Share of `screen` tokens covered by common runs of ≥ VERBATIM_RUN_WORDS tokens (or the whole block when shorter). */
export function verbatimCoverage(screen: readonly string[], spoken: readonly string[]): number {
  if (screen.length === 0 || spoken.length === 0) return 0;
  const minRun = Math.min(VERBATIM_RUN_WORDS, screen.length);
  const covered = new Array<boolean>(screen.length).fill(false);
  let previous = new Array<number>(spoken.length + 1).fill(0);
  for (let i = 1; i <= screen.length; i += 1) {
    const current = new Array<number>(spoken.length + 1).fill(0);
    for (let j = 1; j <= spoken.length; j += 1) {
      if (screen[i - 1] === spoken[j - 1]) {
        current[j] = previous[j - 1]! + 1;
        if (current[j]! >= minRun) for (let k = i - current[j]!; k < i; k += 1) covered[k] = true;
      }
    }
    previous = current;
  }
  return covered.filter(Boolean).length / screen.length;
}

export interface RedundancyFinding {
  kind: 'verbatim-long-block' | 'script-repeats-cue';
  segmentId: string;
  unitId: string;
  path: string;
  coverage: number;
  words: number;
  sentences: number;
  captionWords: number;
  message: string;
}

export function checkRedundancy(
  blocks: readonly ScreenBlock[],
  units: readonly NarrationUnit[],
  locale: ContentLocale,
  audience: Audience,
): RedundancyFinding[] {
  const caption = captionLimit(locale, audience);
  const byKey = new Map(blocks.map((block) => [`${block.segmentId}::${block.path}`, block]));
  const findings: RedundancyFinding[] = [];

  for (const unit of units) {
    const spoken = tokens(unit.text);
    if (unit.script) {
      // Differentiated: the script must add to the cue, not repeat it.
      const cue = byKey.get(`${unit.segmentId}::prompt_md`);
      if (!cue) continue;
      const scriptCoverage = verbatimCoverage(spoken, tokens(cue.raw));
      if (scriptCoverage >= SCRIPT_REPEAT_THRESHOLD) {
        findings.push({
          kind: 'script-repeats-cue',
          segmentId: unit.segmentId,
          unitId: unit.unitId,
          path: 'narration.script_md',
          coverage: scriptCoverage,
          words: countWords(unit.text),
          sentences: countSentences(unit.text),
          captionWords: caption.words,
          message:
            `segment "${unit.segmentId}" declares a differentiated narration, but ${Math.round(scriptCoverage * 100)}% of narration.script_md repeats the on-screen prompt word for word. ` +
            'Make the script EXPLAIN what the prompt only cues (the why, the worked step, the story), or remove `narration` so the prompt itself is read as a short caption.',
        });
      }
      continue;
    }
    for (const path of unit.voices) {
      const block = byKey.get(`${unit.segmentId}::${path}`);
      if (!block) continue;
      const words = countWords(block.text);
      const sentences = countSentences(block.text);
      if (words <= caption.words && sentences <= caption.sentences) continue; // a caption may duplicate its narration
      const coverage = verbatimCoverage(tokens(block.raw), spoken);
      if (coverage < REDUNDANCY_THRESHOLD) continue;
      findings.push({
        kind: 'verbatim-long-block',
        segmentId: unit.segmentId,
        unitId: unit.unitId,
        path,
        coverage,
        words,
        sentences,
        captionWords: caption.words,
        message:
          `segment "${unit.segmentId}" ${path}: ${words} words / ${sentences} sentence(s) on screen, and ${Math.round(coverage * 100)}% of them are read aloud verbatim (narration unit ${unit.unitId}) — ` +
          `long on-screen text duplicating narration competes for the same channel (B.18). A narrated block may repeat its narration only as a caption (≤ ${caption.words} words, ≤ ${caption.sentences} sentences, ${audience.label}, ${locale}). ` +
          (path === 'prompt_md'
            ? 'Differentiate: set `narration: {"mode":"differentiated","script_md":"<what the Mentor explains>"}` and cut prompt_md to the cue; or set `narration: {"mode":"text_only"}` to keep it text-only. '
            : 'Cut it to a caption, split it across turns, or set `narration: {"mode":"text_only"}` for the segment. ') +
          `Text: "${excerpt(block.text, 70)}"`,
      });
    }
  }
  return findings;
}
