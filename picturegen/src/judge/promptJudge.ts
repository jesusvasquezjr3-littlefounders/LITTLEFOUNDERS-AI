import { z } from 'zod';

/*
 * The ART-DIRECTOR JUDGE. Given a bare {label, context?, purpose?} it asks an
 * OpenAI-compatible chat model (JSON mode) to author ONE detailed English
 * image prompt that (a) depicts the label's subject clearly for a child,
 * grounded in the lesson context, and (b) enforces the LittleFounders visual
 * identity below. It NEVER blocks generation: on any judge failure (HTTP
 * error, or unparseable JSON after 2 corrective attempts) it falls back to a
 * deterministic prompt built from the label + context + identity brief.
 *
 * Child safety (/AGENTS.md §1.9): the judge only ever sees lesson content
 * (label + context) — never child PII — and the identity brief itself forbids
 * scary/violent imagery, faces close-up, logos and text.
 */

/**
 * The LittleFounders ILLUSTRATION style guide. `/DESIGN.md` is authoritative
 * for the app UI; THIS brief is the authority for generated illustration
 * style, and is injected verbatim into the judge's system prompt (and into
 * the deterministic fallback) so every asset shares one look.
 */
export const LF_VISUAL_IDENTITY =
  "Flat, modern children's illustration in the LittleFounders style: clean bold vector shapes with soft rounded corners, warm and friendly, zero text or letters in the image. Palette anchored on warm papaya/coral (#ff775c) accents, deep navy (#080f28) and soft blues, with sunny yellows and fresh greens — bright but never neon. Soft warm lighting, gentle shadows, simple uncluttered composition with ONE clear subject filling most of the frame, complete background scene (never a cutout or sticker on white). Cheerful lemonade-stand world: hand-made stands, jars of coins, lemons, sunny neighborhoods. No humans' faces close-up, no brand logos, no watermarks, no scary/violent elements — this is for children aged 6-13.";

export const PICTURE_PURPOSES = ['lesson_option', 'memory_card', 'scene', 'generic'] as const;
export type PicturePurpose = (typeof PICTURE_PURPOSES)[number];

/** Per-purpose composition guidance handed to the judge. */
const PURPOSE_GUIDANCE: Record<PicturePurpose, string> = {
  lesson_option:
    'This image is ONE answer option in a multiple-choice question: depict the single labeled concept in isolation, instantly recognizable at thumbnail size.',
  memory_card:
    'This image is a memory/matching game card face: one bold central subject, symmetric friendly composition, still readable when small.',
  scene:
    'This image is a wide story scene: show the subject acting within the lemonade-stand world with a complete background.',
  generic: 'A clear, friendly illustration of the subject with a simple complete background.',
};

export interface JudgeInput {
  label: string;
  context?: string;
  purpose?: PicturePurpose;
}

export interface CraftedPrompt {
  prompt: string;
  negative?: string;
}

export interface PromptJudgeOptions {
  apiBase: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_PROMPT_CHARS = 800;
/** Two corrective attempts to coax strict JSON before giving up to the fallback. */
const MAX_PARSE_ATTEMPTS = 2;

const CraftedPromptSchema = z.object({
  prompt: z.string().min(1),
  negative: z.string().min(1).optional(),
});

const SYSTEM_PROMPT = [
  'You are the art director for LittleFounders, a finance-and-entrepreneurship learning app for children aged 6-13.',
  'Your job: turn a short label (and optional lesson context) into ONE vivid, self-contained English text-to-image prompt.',
  'The prompt MUST clearly depict the labelled subject so a child instantly recognises it, grounded in the given context.',
  'The prompt MUST enforce this exact illustration identity:',
  LF_VISUAL_IDENTITY,
  'Hard rules: never put readable text, letters, numbers, logos or watermarks in the image; never depict anything scary, violent, or unsafe for children; keep ONE clear subject.',
  'QUANTITIES ARE PICTORIAL: qwen-image loves rendering captions, so NEVER write an amount, price, or label as something to display ("10 pesos", "2 vasos"). Translate every quantity into visual composition instead — "two golden coins side by side", "a small stack of three coins". If the context mentions prices, show the OBJECTS, never the numbers.',
  `Reply with STRICT JSON only, no prose, shaped exactly: {"prompt": string, "negative": string}. "prompt" <= ${MAX_PROMPT_CHARS} characters. "negative" lists things to avoid (e.g. "text, letters, watermark, logo, blurry, scary").`,
].join('\n');

function userMessage(input: JudgeInput): string {
  const purpose = input.purpose ?? 'generic';
  const lines = [`Label: ${input.label}`, `Purpose: ${PURPOSE_GUIDANCE[purpose]}`];
  if (input.context && input.context.trim()) lines.push(`Lesson context: ${input.context.trim()}`);
  return lines.join('\n');
}

/**
 * Deterministic fallback prompt — used whenever the judge is unreachable or
 * returns unusable JSON, so image generation is NEVER blocked on the judge.
 */
/**
 * ALWAYS sent to the image model, merged with whatever the judge adds. First
 * live inspection (2026-07-23) caught qwen-image inventing a fake brand logo
 * with lettering ("Founters") on an otherwise perfect illustration — text and
 * logos are exactly what a children's lesson tile must never contain, and the
 * judge's own negative can't be trusted to always include them.
 */
export const BASE_NEGATIVE =
  'text, letters, words, captions, typography, logo, brand name, wordmark, watermark, signature, signage, labels, numbers overlay';

/**
 * Appended IN CODE to every final prompt (judge-crafted or fallback) — not
 * trusted to the judge. qwen-image's signature strength is text rendering,
 * which for kids' lesson tiles is exactly the failure mode: the v1 batch
 * leaked a fake wordmark, and v2 (negative-only) still rendered a caption
 * ("10 peces + 10 peces") when the judged prompt mentioned amounts. The
 * positive prompt has the last word with this model, so the no-text clause
 * must live there, always, verbatim.
 */
export const PICTORIAL_CLAUSE =
  ' Purely pictorial illustration: absolutely no text, no letters, no numerals, no captions, no logos anywhere in the image.';

/** Cap for the crafted body so the enforced clause always fits under MAX_PROMPT_CHARS. */
const BODY_MAX = MAX_PROMPT_CHARS - PICTORIAL_CLAUSE.length;

/** The single exit gate for prompts: clamp the body, then enforce the pictorial clause. */
export function finalizePrompt(body: string): string {
  return `${body.slice(0, BODY_MAX).trim()}${PICTORIAL_CLAUSE}`;
}

/** Merge the judge's negative (if any) with the non-negotiable base list. */
export function mergeNegative(judgeNegative?: string): string {
  const extra = (judgeNegative ?? '').trim();
  return extra ? `${BASE_NEGATIVE}, ${extra}` : BASE_NEGATIVE;
}

export function fallbackPrompt(input: JudgeInput): CraftedPrompt {
  const context = (input.context ?? '').slice(0, 160).trim();
  const head = context ? `${input.label} — ${context}.` : `${input.label}.`;
  return { prompt: finalizePrompt(`${head} ${LF_VISUAL_IDENTITY}`), negative: BASE_NEGATIVE };
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

function parseCrafted(content: string | null | undefined): CraftedPrompt | null {
  if (!content) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return null;
  }
  const parsed = CraftedPromptSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    prompt: finalizePrompt(parsed.data.prompt),
    // The base no-text/no-logo list is non-negotiable — the judge's negative
    // only ever EXTENDS it.
    negative: mergeNegative(parsed.data.negative),
  };
}

/**
 * Crafts an illustration prompt for `input`. Deterministic + injectable
 * (`fetchImpl`) for tests. Always resolves — a judge failure degrades to
 * `fallbackPrompt`, it never throws.
 */
export async function craftImagePrompt(input: JudgeInput, opts: PromptJudgeOptions): Promise<CraftedPrompt> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (let attempt = 1; attempt <= MAX_PARSE_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${opts.apiBase}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage(input) },
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' },
        }),
      });
      clearTimeout(timer);

      if (!res.ok) continue; // HTTP error → retry, then fall back.

      const json = (await res.json().catch(() => null)) as ChatResponse | null;
      const crafted = parseCrafted(json?.choices?.[0]?.message?.content);
      if (crafted) return crafted;
      // Unparseable JSON → try once more, then fall back.
    } catch {
      clearTimeout(timer);
      // Network/abort — fall through to the next attempt / fallback.
    }
  }

  return fallbackPrompt(input);
}
