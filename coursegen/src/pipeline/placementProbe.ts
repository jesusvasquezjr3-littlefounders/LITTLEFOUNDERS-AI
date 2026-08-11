// placementProbe.ts — authors and deterministically gates ONE per-topic
// placement-quiz probe (COURSE_ENGINE.md §3.2's "future onboarding/placement
// phase", now built). A probe is authored ONCE per catalog teaching topic at
// generation time, from catalog/topic content only — never per learner, so
// /AGENTS.md §1.9 (no minor PII to any provider) is satisfied by
// construction. The LIVE placement quiz Core serves at runtime is 100%
// deterministic: it only ever reads and grades this pre-authored content,
// mirroring the "deterministic gate before/instead of LLM judgment" posture
// already used everywhere else in this pipeline (Piaget gate, gate 6, etc.).

import { z } from 'zod';
import { completeDeepSeek } from '../providers/deepseek.js';
import type { UsageLedger } from '../providers/usage.js';
import { withCorrectiveRetry, safeJsonParse, formatZodIssues } from './correctiveRetry.js';

const MAX_PROBE_ATTEMPTS = 3;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;
const MAX_PROMPT_LENGTH = 240;
const MAX_OPTION_LENGTH = 80;

export const placementProbeSchema = z
  .object({
    prompt: z.string().min(1).max(MAX_PROMPT_LENGTH),
    options: z.array(z.string().min(1).max(MAX_OPTION_LENGTH)).min(MIN_OPTIONS).max(MAX_OPTIONS),
    correctIndex: z.number().int().min(0),
  })
  .refine((p) => p.correctIndex < p.options.length, {
    message: 'correctIndex must be a valid index into options',
    path: ['correctIndex'],
  });
export type PlacementProbe = z.infer<typeof placementProbeSchema>;

export interface PlacementProbeIssue {
  code: string;
  message: string;
}

export interface PlacementProbeGateResult {
  ok: boolean;
  problems: PlacementProbeIssue[];
}

/**
 * Deterministic, no network. Re-checks option-count/index bounds (already
 * Zod-enforced for a model-authored probe, but this ALSO validates
 * hand-authored catalog overrides, which never go through the schema at
 * all), rejects duplicate options (ambiguous or trivially guessable), and
 * rejects an answer-leak — the correct option's text restated verbatim
 * inside the prompt, the same failure mode gate 8's answer-leak check exists
 * to catch for lesson content.
 */
export function gatePlacementProbe(probe: PlacementProbe): PlacementProbeGateResult {
  const problems: PlacementProbeIssue[] = [];
  if (probe.options.length < MIN_OPTIONS || probe.options.length > MAX_OPTIONS) {
    problems.push({ code: 'option-count', message: `expected ${MIN_OPTIONS}-${MAX_OPTIONS} options, got ${probe.options.length}` });
  }
  if (probe.correctIndex < 0 || probe.correctIndex >= probe.options.length) {
    problems.push({ code: 'correct-index-range', message: `correctIndex ${probe.correctIndex} is out of range for ${probe.options.length} options` });
  }
  const normalized = probe.options.map((o) => o.trim().toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    problems.push({ code: 'duplicate-options', message: 'options must be distinct' });
  }
  const correctText = probe.options[probe.correctIndex]?.trim().toLowerCase();
  if (correctText && correctText.length > 3 && probe.prompt.toLowerCase().includes(correctText)) {
    problems.push({ code: 'answer-leak', message: 'the correct option is restated verbatim inside the prompt' });
  }
  return { ok: problems.length === 0, problems };
}

export interface AuthorPlacementProbeInput {
  concept: string;
  learningObjective: string;
  keyVocabulary: string[];
  factRefs?: string[];
}

export interface AuthorPlacementProbeDeps {
  ledger?: UsageLedger;
  complete?: typeof completeDeepSeek;
}

function buildMessages(input: AuthorPlacementProbeInput, issues: string | undefined) {
  const messages = [
    {
      role: 'system' as const,
      content:
        'You write ONE short multiple-choice placement-quiz question in Mexican Spanish (es-MX) for a ' +
        "children's financial-literacy course. The question tests whether a learner ALREADY understands " +
        'the concept below well enough to skip its lesson, not whether they can recall a definition ' +
        'verbatim. Exactly 3 answer options, exactly one correct, the other two plausible but clearly ' +
        'wrong to someone who understands the concept. No child names, no personal data of any kind — ' +
        'concept content only. Output ONLY this JSON shape, nothing else, no markdown fences: ' +
        '{"prompt": string, "options": string[], "correctIndex": number}.',
    },
    {
      role: 'user' as const,
      content: [
        `Concept: ${input.concept}`,
        `Learning objective: ${input.learningObjective}`,
        `Key vocabulary: ${input.keyVocabulary.join(', ')}`,
        input.factRefs?.length ? `Fact references: ${input.factRefs.join(', ')}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
  if (issues) {
    messages.push({
      role: 'user' as const,
      content: `Your previous JSON was invalid. Fix these issues and resend the FULL corrected JSON:\n${issues}`,
    });
  }
  return messages;
}

/**
 * Authors and gates one probe. Same corrective-retry idiom as plan.ts:
 * schema/gate failures feed back into the NEXT call instead of giving up.
 * maxTokens is explicit (not left to the provider default) for the same
 * documented reason as localize.ts's translateTitle: a reasoning model
 * spends its completion budget thinking before any content appears, and an
 * under-provisioned budget returns an EMPTY string with finish_reason
 * 'length' rather than an error — silent, not loud.
 */
export async function authorPlacementProbe(
  input: AuthorPlacementProbeInput,
  deps: AuthorPlacementProbeDeps = {},
): Promise<PlacementProbe> {
  const complete = deps.complete ?? completeDeepSeek;
  const { data } = await withCorrectiveRetry<PlacementProbe>({
    maxAttempts: MAX_PROBE_ATTEMPTS,
    callModel: async (issues) => {
      const messages = buildMessages(input, issues);
      const result = await complete(
        { messages, temperature: 0.4, jsonMode: true, maxTokens: 2000 },
        { operation: 'placement-probe', ledger: deps.ledger },
      );
      return result.content;
    },
    parse: (raw) => {
      const json = safeJsonParse(raw);
      if (!json.ok) return { ok: false, issues: `invalid JSON: ${json.error}` };
      const parsed = placementProbeSchema.safeParse(json.value);
      if (!parsed.success) return { ok: false, issues: formatZodIssues(parsed.error.issues) };
      const gate = gatePlacementProbe(parsed.data);
      if (!gate.ok) return { ok: false, issues: gate.problems.map((p) => p.message).join('; ') };
      return { ok: true, data: parsed.data };
    },
  });
  return data;
}

export interface TranslatePlacementProbeDeps {
  ledger?: UsageLedger;
  complete?: typeof completeDeepSeek;
}

/**
 * Translates an already-authored (or hand-written es-MX catalog override)
 * probe into one target locale, keeping prompt+options together in ONE
 * JSON round-trip so their tone stays coherent (rather than 4 separate
 * calls per locale). Structurally identical corrective-retry shape as
 * authorPlacementProbe, re-validated against the same schema+gate — a
 * translation is just another untrusted model output.
 */
export async function translatePlacementProbe(
  probe: PlacementProbe,
  targetLocale: 'en-US' | 'pt-BR',
  deps: TranslatePlacementProbeDeps = {},
): Promise<PlacementProbe> {
  const complete = deps.complete ?? completeDeepSeek;
  const localeName = targetLocale === 'en-US' ? 'English (US)' : 'Brazilian Portuguese (pt-BR)';
  const { data } = await withCorrectiveRetry<PlacementProbe>({
    maxAttempts: MAX_PROBE_ATTEMPTS,
    callModel: async (issues) => {
      const messages = [
        {
          role: 'system' as const,
          content:
            `Translate this multiple-choice placement-quiz question from Mexican Spanish (es-MX) into ${localeName}, ` +
            "for a children's financial-literacy app. Keep the same meaning, difficulty, and correctIndex — " +
            'translate naturally, do not translate word-for-word. Output ONLY this JSON shape, nothing else, ' +
            'no markdown fences: {"prompt": string, "options": string[], "correctIndex": number}.',
        },
        { role: 'user' as const, content: JSON.stringify(probe) },
        ...(issues
          ? [{ role: 'user' as const, content: `Your previous JSON was invalid. Fix these issues and resend the FULL corrected JSON:\n${issues}` }]
          : []),
      ];
      const result = await complete(
        { messages, temperature: 0.3, jsonMode: true, maxTokens: 2000 },
        { operation: 'placement-probe-translate', ledger: deps.ledger },
      );
      return result.content;
    },
    parse: (raw) => {
      const json = safeJsonParse(raw);
      if (!json.ok) return { ok: false, issues: `invalid JSON: ${json.error}` };
      const parsed = placementProbeSchema.safeParse(json.value);
      if (!parsed.success) return { ok: false, issues: formatZodIssues(parsed.error.issues) };
      if (parsed.data.correctIndex !== probe.correctIndex) {
        return { ok: false, issues: `correctIndex must stay ${probe.correctIndex} (the same option, translated) — got ${parsed.data.correctIndex}` };
      }
      const gate = gatePlacementProbe(parsed.data);
      if (!gate.ok) return { ok: false, issues: gate.problems.map((p) => p.message).join('; ') };
      return { ok: true, data: parsed.data };
    },
  });
  return data;
}
