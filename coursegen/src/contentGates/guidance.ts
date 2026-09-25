// The author-facing statement of gates 11-13, injected into the write prompt so
// the model is told the numbers BEFORE the gate has to reject a draft (each
// corrective retry is a paid call when generation runs live). Derived from
// the same budgets the gates enforce, so the prompt can never drift from them.

import { captionLimit, wordLimit, type Audience } from './budgets.js';
import type { LessonPolicy } from './policyGates.js';

export function contentGateGuidance(audience: Audience): string {
  const es = (role: Parameters<typeof wordLimit>[0]) => wordLimit(role, 'es-MX', audience);
  const caption = captionLimit('es-MX', audience);
  return [
    `COPY BUDGET (OD-13, hard gate 13, ${audience.label}; es-MX word limits, English gets 80% of these): ` +
      `prompt_md and every other question/instruction <= ${es('prompt')} words and 2 sentences; ` +
      `each option/item/token <= ${es('option')} words and 1 sentence; ` +
      `each character line or scene narration (one Mentor turn) <= ${es('mentor')} words and 2 sentences; ` +
      `explanation_md, rationale_md, recap and card text <= ${es('body')} words and 2 sentences; ` +
      `segment and card titles <= ${es('heading')} words, 1 sentence; each hint <= ${es('detail')} words. ` +
      'Write it short from the start: a draft over budget is rejected, never truncated.',
    `NARRATION VS SCREEN (B.18, hard gate 11): every narrated field is read aloud exactly as shown, so a narrated on-screen block may be at most a caption (<= ${caption.words} words, <= ${caption.sentences} sentences). ` +
      'When a segment needs a longer spoken explanation, set `"narration": {"mode": "differentiated", "script_md": "<what the Mentor explains aloud>"}` and keep prompt_md a short cue that does NOT repeat the script; ' +
      'when a segment should be read, not heard, set `"narration": {"mode": "text_only"}`. Omit `narration` otherwise.',
    'MENTOR, NEVER A BANK (Law 2, hard gate 12): never voice banking/transaction frames ("saldo de la cuenta", "fondos insuficientes"), hype or urgency ("duplica tu dinero", "sin riesgo", "actúa ya") or resource-exhaustion wording ("no quedan intentos"). ' +
      'A lesson that examines a scam quotes the message in quotation marks or names it as a warning sign ("la señal de ganancia garantizada").',
  ].join('\n');
}

/**
 * Gates 14-16 stated to the author for ONE lesson (S05.4b), from its catalog
 * policy: the concepts it may introduce, the mentor-misjudgment episode it
 * must stage, and the market it is written for. Empty when there is nothing
 * lesson-specific to say.
 */
export function lessonPolicyGuidance(policy: LessonPolicy | undefined): string {
  if (!policy) return '';
  const lines: string[] = [];
  const { concepts } = policy;
  const declared = concepts.declaredLabels.length > 0 ? concepts.declaredLabels.join('; ') : 'none (practice or consolidation only)';
  const ahead = concepts.future.slice(0, 12).map((f) => f.id);
  lines.push(
    `NEW CONCEPTS (B.17, hard gate 14, working-memory band ${concepts.band}, ceiling ${concepts.ceiling}): this lesson introduces ONLY: ${declared}. ` +
      'Everything else must be something the learner has already met.' +
      (ahead.length > 0 ? ` Do not introduce concepts taught later in the course: ${ahead.join(', ')}.` : ''),
  );
  if (policy.misjudgment) {
    const { character, misjudgment, recovery } = policy.misjudgment;
    lines.push(
      `MENTOR MISJUDGMENT EPISODE (B.11, hard gate 15): ${character} makes this real money misjudgment: ${misjudgment} Then recovers: ${recovery} ` +
        `${character} must be in meta.cast and speak in at least two moments (the misjudgment, then the recovery). ` +
        'Narrate it exactly like a learner mistake: name the decision and what changes next, never the person ("olvidé contar la bolsita", never "soy un desastre").',
    );
  }
  const scenarios = policy.regional.scenarios;
  if (policy.regional.required && scenarios) {
    const own = scenarios['es-MX'];
    const others = [...scenarios['en-US'].anchors, ...scenarios['pt-BR'].anchors];
    lines.push(
      `MARKET SCENARIO (B.16, hard gate 16): this es-MX lesson is written for Mexico: ${own.scenario} ` +
        `Use at least one of: ${own.anchors.join(', ')}. Never use the other markets' context (${others.join(', ')}); ` +
        'the English and Portuguese versions are adapted to their own markets from separate scenarios.',
    );
  }
  return lines.join('\n');
}
