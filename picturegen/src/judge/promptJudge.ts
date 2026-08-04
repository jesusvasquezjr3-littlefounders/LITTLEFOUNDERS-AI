import { z } from 'zod';
import { MAX_NEGATIVE_PROMPT_CHARS, truncateAtCommaBoundary } from '../gen/qwenImageClient.js';

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
  "Strictly two-dimensional flat educational vector graphic in the original LittleFounders style: polished animated-editorial feel, clean geometric shapes, crisp high-contrast visual reasoning, soft rounded corners, warm and friendly, zero text or letters in the image. Never imitate a named third-party brand and never use 3D rendering, photorealism, clay/plastic materials, painterly shading, soft focus or cinematic depth of field. Palette anchored on papaya-coral accents, deep navy and soft blues, with sunny yellows and fresh greens — bright but never neon. Use a pure white or transparent-looking plain background for single-object tiles; reserve complete contextual backgrounds for wide scenes only. Cheerful lemonade-stand world: hand-made stands, jars of coins, lemons, sunny neighborhoods. The frame holds only the physical objects, props, and setting themselves — a still-life composition of the WORLD as it sits between visits, exactly as it would look photographed at dawn before anyone arrived. (The app renders its own non-human characters separately, in a different layer.) No brand logos, no watermarks, no scary/violent elements — this is for young learners.";

export const PICTURE_PURPOSES = [
  'lesson_option',
  'option_card',
  'item_card',
  'scene_anchor',
  'memory_card',
  'outcome',
  'scene',
  'generic',
] as const;
export type PicturePurpose = (typeof PICTURE_PURPOSES)[number];

/*
 * Per-purpose ART DIRECTION handed to the judge. A children's lesson uses a
 * picture in one of a few structural roles, and each role needs a DIFFERENT
 * composition — a tiny answer-option thumbnail and a wide establishing scene
 * are not the same picture. Getting the role right is what makes an image
 * legible in its slot (COURSE_ENGINE.md §"Content quality", QA synthesis §5).
 */
const PURPOSE_GUIDANCE: Record<PicturePurpose, string> = {
  // A single tappable answer/item tile shown ~64-96px. ONE object, centered,
  // pure-white/transparent edge-to-edge canvas, no scene clutter, unmistakable at thumbnail size.
  item_card:
    'This is a small answer/item TILE shown at ~64-96px. Depict ONE single object, centered alone on a pure-white or transparent-looking canvas that reaches every edge — never a colored backdrop, inset card, border, frame, floor or shadow. Use a bold clear silhouette, instantly recognizable as the named object by a 6-year-old. No scene clutter or secondary objects.',
  option_card:
    'This is ONE option in a multiple-choice set shown at thumbnail size. Depict the single labeled object centered alone on an edge-to-edge pure-white or transparent-looking canvas. CRITICAL: sibling options must share the SAME framing, scale and neutral white canvas; never make one tile look "nicer"/brighter/happier (that would telegraph the answer).',
  lesson_option:
    'This is ONE option in a multiple-choice set shown at thumbnail size. Depict the single labeled object centered alone on a pure-white or transparent-looking edge-to-edge canvas, instantly recognizable and visually parallel to siblings (same framing/scale; never telegraph the answer).',
  memory_card:
    'This is a memory/matching game card face: one bold central object, centered on a pure-white or transparent-looking edge-to-edge canvas, symmetric and friendly, still readable when small.',
  // A wide establishing illustration above the prompt that sets the SITUATION.
  scene_anchor:
    'This is a wide ESTABLISHING scene shown above the exercise (roughly 16:9). Show the concrete situation through OBJECTS and SETTING ONLY — the lemonade stand, the goods, coins, jars, the sunny neighborhood — with a complete background, and NO people/characters of any kind. It sets context and mood; it MUST NOT reveal or hint at the answer to the exercise.',
  scene:
    'This is a wide story scene: show the objects and setting of the lemonade-stand world with a complete background, and NO people or characters.',
  outcome:
    'This is an OUTCOME/consequence illustration for a story branch ending. Convey the result through the SCENE and OBJECTS (e.g. a full coin jar for success, wilted lemonade for a setback) — never through a person or character, never anything scary or shaming.',
  generic: 'A clear, friendly illustration of the subject with a simple complete background.',
};

/**
 * Tiny reusable tiles are a constrained rendering problem, not an open-ended
 * scene-writing task. Letting an LLM expand a label such as "Helado" caused it
 * to invent a child eating it, then spend three paid verification retries.
 * A deterministic object-only prompt is safer, cheaper and more consistent
 * across sibling options; wide scenes still use the art-director model.
 *
 * SINGLE SOURCE OF TRUTH for "which purposes are object tiles". The service
 * layer (service/pictures.ts) imports this same set to collapse the tile
 * cache key — an invariant that is only correct while cache-key collapsing
 * and deterministic-prompt selection agree on membership. Never redeclare
 * this set elsewhere: drift between two copies would serve a cross-context
 * wrong image straight from cache.
 */
export const OBJECT_TILE_PURPOSES: ReadonlySet<PicturePurpose> = new Set<PicturePurpose>([
  'item_card',
  'option_card',
  'lesson_option',
  'memory_card',
]);

/**
 * What the verifier caught on the IMMEDIATELY PRIOR paid attempt for this same
 * request, if any. Every attempt used to send the exact same (or, for the
 * judge path, only randomly-varied) prompt regardless of why the last one
 * failed — three paid rolls of the dice against the SAME instruction, with no
 * attempt learning from the last (production cost concern 2026-08-03: object
 * tiles alone repeatedly burned all 3 PICTUREGEN_VERIFY_ATTEMPTS on
 * non-white-background/text/person defects). Feeding the specific defect back
 * lets the next attempt's prompt reinforce EXACTLY the constraint that broke,
 * the same corrective-feedback idea already used for the writer's Zod issues.
 */
export interface PreviousImageDefect {
  nonWhiteBackground?: boolean;
  text?: boolean;
  person?: boolean;
}

export interface JudgeInput {
  label: string;
  context?: string;
  purpose?: PicturePurpose;
  previousDefect?: PreviousImageDefect;
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
/*
 * 1000, not 800 (2026-08-04): the positive-framing rewrite of PICTORIAL_CLAUSE
 * plus a defect reinforcement (retry.ts's per-attempt feedback) can legitimately
 * need every character — a worst case of all three reinforcements combining on
 * a long label left under 10 chars of margin at the old cap, one bad label away
 * from silently truncating mid-sentence again (exactly the bug this same file
 * fixed once already for fallbackPrompt). Not a DashScope hard limit — this
 * constant is this codebase's own conservative choice.
 */
const MAX_PROMPT_CHARS = 1000;
/** Two corrective attempts to coax strict JSON before giving up to the fallback. */
const MAX_PARSE_ATTEMPTS = 2;

const CraftedPromptSchema = z.object({
  prompt: z.string().min(1),
  negative: z.string().min(1).optional(),
});

const SYSTEM_PROMPT = [
  'You are the art director for LittleFounders, a finance-and-entrepreneurship learning app for young learners.',
  'Your job: turn a short label (and optional lesson context) into ONE vivid, self-contained English text-to-image prompt.',
  'The prompt MUST clearly depict the labelled subject so a child instantly recognises it, grounded in the given context.',
  'The prompt MUST enforce this exact illustration identity:',
  LF_VISUAL_IDENTITY,
  'Hard rules: never put readable text, letters, numbers, logos or watermarks in the image; never depict anything scary, violent, or unsafe for children; keep ONE clear subject.',
  'NEVER DRAW PEOPLE OR CHARACTERS: no person, human, child, adult, face, hands, mascot, or cartoon character of ANY kind — depict ONLY objects and the setting. If the label or context names a character (Dina, Liruf, Rho, Zara) or "a kid/customer/vendor", do NOT draw them — draw the OBJECTS and PLACE of the scene instead (the app draws its own non-human characters separately). A drawn human is a hard failure.',
  'HOW TO WRITE THE "prompt" FIELD ITSELF (this is not a rule for you to follow — it is an instruction about your OUTPUT TEXT): the image model reads your prompt literally, and text-to-image models are known to fixate on whatever a prompt NAMES even when the sentence negates it — writing "no person" still primes the model toward a person. So NEVER write the words person/people/human/child/face/hands/mascot/character anywhere inside the "prompt" string, not even to negate them. Describe the scene the way a photographer would caption an empty room: name only the objects, props and setting that ARE there. The exclusion list belongs entirely in the separate "negative" field, never inline in "prompt".',
  'CHILD-LEGIBILITY (this is a picture a 6-year-old must read at a glance): draw the ACTUAL, LITERAL object named — never a symbolic or abstract stand-in. A "cost" is drawn as coins/a lemon, never a receipt; a "savings goal" is the actual toy, never a trophy or a target; "ice" is ice cubes, not a snowflake symbol. One dominant subject, bold high-contrast silhouette, unmistakable as the named thing.',
  'QUANTITIES ARE PICTORIAL: Qwen-Image loves rendering captions, so NEVER write an amount, price, or label as something to display ("10 pesos", "2 vasos"). Translate every quantity into visual composition instead — "two golden coins side by side", "a small stack of three coins". If the context mentions prices, show the OBJECTS, never the numbers.',
  "NEVER NAME DENOMINATIONS: never write a currency amount or denomination anywhere in your prompt, not even inside quotation marks — \"'1 peso' coin\" WILL be engraved verbatim onto the coin. Distinguish coins ONLY by size, color, or finish: 'one small copper coin and two larger golden coins'.",
  'NO TEXT-CARRYING PROPS: never mention signs, signboards, banners, price tags, labels, chalkboards, or menus. When a lemonade stand appears, describe only its awning, wooden table, and props, and state explicitly that the stand has no sign — otherwise the model invents one and fills it with a fake wordmark.',
  `Reply with STRICT JSON only, no prose, shaped exactly: {"prompt": string, "negative": string}. "prompt" <= ${MAX_PROMPT_CHARS} characters. "negative" lists things to avoid (e.g. "text, letters, watermark, logo, blurry, scary").`,
].join('\n');

/**
 * One reinforcing instruction per defect the verifier caught on the prior
 * paid attempt for this SAME request. Stated as an instruction for THIS
 * attempt (not a description of what went wrong) — a positive-prompt model
 * reads whatever text it's given as content to consider, so "this time do X"
 * is safer than dwelling on the failure. Multiple defects concatenate.
 */
function reinforcementFor(defect: PreviousImageDefect | undefined): string {
  if (!defect) return '';
  const lines: string[] = [];
  if (defect.nonWhiteBackground) {
    lines.push('RETRY: the background must be flat pure white to every edge, nothing else touching the border.');
  }
  if (defect.text) {
    lines.push('RETRY: a bare, unmarked object — no labels or symbols anywhere.');
  }
  if (defect.person) {
    lines.push('RETRY: a still life of the object and setting alone, as in an empty room.');
  }
  return lines.join(' ');
}

function userMessage(input: JudgeInput): string {
  const purpose = input.purpose ?? 'generic';
  const lines = [`Label: ${input.label}`, `Purpose: ${PURPOSE_GUIDANCE[purpose]}`];
  if (input.context && input.context.trim()) lines.push(`Lesson context: ${input.context.trim()}`);
  const reinforcement = reinforcementFor(input.previousDefect);
  if (reinforcement) lines.push(reinforcement);
  return lines.join('\n');
}

/**
 * Deterministic fallback prompt — used whenever the judge is unreachable or
 * returns unusable JSON, so image generation is NEVER blocked on the judge.
 */
/**
 * ALWAYS sent to the image model, merged with whatever the judge adds. First
 * live inspection (2026-07-23) caught Qwen-Image inventing a fake brand logo
 * with lettering ("Founters") on an otherwise perfect illustration — text and
 * logos are exactly what a children's lesson tile must never contain, and the
 * judge's own negative can't be trusted to always include them. Rendered
 * digits/captions are a RECORDED live failure mode too ("10 peces + 10
 * peces"), so caption/word/number coverage is part of this core, for every
 * purpose.
 *
 * DashScope caps negative_prompt at MAX_NEGATIVE_PROMPT_CHARS (500), so this
 * list is (a) COMPRESSED to umbrella terms so it fits well under the cap with
 * room left for judge extras, and (b) PRIORITY-ORDERED — no-people, then
 * anti-3D/photorealism, then no-text — because anything past the cap is
 * clipped from the tail. An earlier 789-char version was sliced mid-token at
 * the cap, silently amputating the entire no-people and anti-3D blocks and
 * every judge-supplied negative.
 *
 * The base negative is PURPOSE-AWARE: this core reaches every purpose, while
 * the anti-scenery / anti-background / anti-framing terms live in
 * OBJECT_TILE_NEGATIVE_EXTENSION and reach object tiles ONLY. Scene purposes
 * (scene_anchor/scene/outcome/generic) explicitly demand a wide establishing
 * scene with a complete background — sending them "scenery" or a background
 * negation would directly fight their own positive prompt.
 */
export const BASE_NEGATIVE_CORE =
  'person, people, human, child, face, hands, mascot, cartoon character, ' +
  '3d render, photorealistic, clay, plastic, painterly, soft focus, depth of field, ' +
  'text, letters, typography, captions, words, numbers, numerals, ' +
  'logo, wordmark, watermark, signage, price tag, coin engraving';

/**
 * Extra negatives for the four object-tile purposes only: their contract is
 * ONE object on a pure-white edge-to-edge canvas, so scenery, any non-white
 * canvas (including the neutral gray/off-white/cream drifts seen live) and
 * framing/shadow decorations are defects — for tiles, and only for tiles.
 */
export const OBJECT_TILE_NEGATIVE_EXTENSION =
  'scenery, colored background, gradient background, gray background, off-white background, cream background, ' +
  // black/dark canvas was never negated in ANY prior list, and qwen-image-max
  // sometimes reads the positive prompt's "pure white #FFFFFF" as the OBJECT
  // color, rendering a white silhouette on a solid black field (reproduced
  // live: 'Carrito de juguete' → 665/665 border pixels at channel 0). The
  // production run failed ~46% of tile targets on exactly this inversion.
  'black background, dark background, white silhouette on dark, ' +
  'border, frame, inset card, shadow, reflection';

/** The non-negotiable base negative for a purpose: common core everywhere, plus the tile-only extension. */
export function baseNegativeFor(purpose?: PicturePurpose): string {
  return OBJECT_TILE_PURPOSES.has(purpose ?? 'generic')
    ? `${BASE_NEGATIVE_CORE}, ${OBJECT_TILE_NEGATIVE_EXTENSION}`
    : BASE_NEGATIVE_CORE;
}

/**
 * Appended IN CODE to every final prompt (judge-crafted or fallback) — not
 * trusted to the judge. Qwen-Image's signature strength is text rendering,
 * which for kids' lesson tiles is exactly the failure mode: the v1 batch
 * leaked a fake wordmark, and v2 (negative-only) still rendered a caption
 * ("10 peces + 10 peces") when the judged prompt mentioned amounts. The
 * positive prompt has the last word with this model, so the no-text clause
 * must live there, always, verbatim — that half is proven and untouched.
 *
 * The people-avoidance half was rewritten 2026-08-04 (production incident:
 * a broad "person" defect spike after switching image models) following
 * prompt-engineering guidance that inline negation ("no people, no faces,
 * no hands") keeps the excluded concept in the model's attention even while
 * negating it — the model's own name for the thing it's told to avoid is
 * still the strongest signal in the sentence. Reframed as a positive scene
 * description (an empty still life) with the exclusion stated ONCE, not as
 * a checklist of body parts. `negative_prompt` (BASE_NEGATIVE_CORE) still
 * carries the full explicit exclusion list — that channel is unaffected.
 */
export const PICTORIAL_CLAUSE =
  ' Purely pictorial: no text, letters, numerals, captions or logos anywhere. A still life of objects and setting only — as if photographed at dawn, before anyone arrived.';

/** Cap for the crafted body so the enforced clause always fits under MAX_PROMPT_CHARS. */
const BODY_MAX = MAX_PROMPT_CHARS - PICTORIAL_CLAUSE.length - 1;

/** The single exit gate for prompts: clamp the body, then enforce the pictorial clause. */
export function finalizePrompt(body: string): string {
  const truncated = body.slice(0, BODY_MAX).trim().replace(/[,:;-]$/, '');
  const terminal = /[.!?]$/.test(truncated) ? truncated : `${truncated}.`;
  return `${terminal}${PICTORIAL_CLAUSE}`;
}

/**
 * Merge the judge's negative (if any) with the non-negotiable, purpose-aware
 * base list, budgeted against the provider cap: the base always survives
 * whole, and judge extras fill the remainder, truncated only at a comma
 * boundary (never mid-token) — an extra that cannot fit is dropped, not
 * sliced.
 */
export function mergeNegative(judgeNegative?: string, purpose?: PicturePurpose): string {
  const base = baseNegativeFor(purpose);
  const extra = (judgeNegative ?? '').trim();
  if (!extra) return base;
  const budget = MAX_NEGATIVE_PROMPT_CHARS - base.length - ', '.length;
  const clipped = budget > 0 ? truncateAtCommaBoundary(extra, budget) : '';
  return clipped ? `${base}, ${clipped}` : base;
}

export function fallbackPrompt(input: JudgeInput): CraftedPrompt {
  const context = (input.context ?? '').slice(0, 160).trim();
  const head = context ? `${input.label} — ${context}.` : `${input.label}.`;
  // LF_VISUAL_IDENTITY alone (1100+ chars) already overflows BODY_MAX and gets
  // clipped by finalizePrompt — anything appended AFTER it never survives.
  // The reinforcement is the more time-critical instruction on a retry, so it
  // goes BEFORE the identity block, not after, or it would always be silently
  // truncated away.
  const reinforcement = reinforcementFor(input.previousDefect);
  const body = reinforcement ? `${head} ${reinforcement} ${LF_VISUAL_IDENTITY}` : `${head} ${LF_VISUAL_IDENTITY}`;
  return { prompt: finalizePrompt(body), negative: baseNegativeFor(input.purpose) };
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

function parseCrafted(content: string | null | undefined, purpose?: PicturePurpose): CraftedPrompt | null {
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
    // The purpose-aware base no-text/no-logo list is non-negotiable — the
    // judge's negative only ever EXTENDS it.
    negative: mergeNegative(parsed.data.negative, purpose),
  };
}

/**
 * Crafts an illustration prompt for `input`. Deterministic + injectable
 * (`fetchImpl`) for tests. Always resolves — a judge failure degrades to
 * `fallbackPrompt`, it never throws.
 */
export async function craftImagePrompt(input: JudgeInput, opts: PromptJudgeOptions): Promise<CraftedPrompt> {
  if (OBJECT_TILE_PURPOSES.has(input.purpose ?? 'generic')) {
    const reinforcement = reinforcementFor(input.previousDefect);
    return {
      prompt: finalizePrompt(
        // "silhouette" is deliberately ABSENT: qwen-image-max reads it as
        // monochrome-icon-on-a-dark-field and renders a white shape on a black
        // canvas or black inset panel (reproduced live with 'Carrito de
        // juguete'; ~46% of production tile targets failed on the inversion).
        `Single brightly colored object: ${input.label}. Centered, fully visible, bold and simple, alone in the frame. ` +
          `Solid pure white #FFFFFF background filling the entire canvas to all four edges — no panel, no card, no dark field. ` +
          `Flat 2D animated vector illustration with clean geometric shapes, crisp high contrast, soft rounded forms and bright educational colors.` +
          (reinforcement ? ` ${reinforcement}` : ''),
      ),
      negative: baseNegativeFor(input.purpose),
    };
  }
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
      const crafted = parseCrafted(json?.choices?.[0]?.message?.content, input.purpose);
      if (crafted) return crafted;
      // Unparseable JSON → try once more, then fall back.
    } catch {
      clearTimeout(timer);
      // Network/abort — fall through to the next attempt / fallback.
    }
  }

  return fallbackPrompt(input);
}
