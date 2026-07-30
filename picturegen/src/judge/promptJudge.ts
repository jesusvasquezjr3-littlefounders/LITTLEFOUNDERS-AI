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
  "Flat, modern children's illustration in the LittleFounders style: clean bold vector shapes with soft rounded corners, warm and friendly, zero text or letters in the image. Palette anchored on warm papaya/coral (#ff775c) accents, deep navy (#080f28) and soft blues, with sunny yellows and fresh greens — bright but never neon. Soft warm lighting, gentle shadows, simple uncluttered composition with ONE clear subject filling most of the frame, complete background scene (never a cutout or sticker on white). Cheerful lemonade-stand world: hand-made stands, jars of coins, lemons, sunny neighborhoods. ABSOLUTELY NO PEOPLE: never draw a person, human, child, adult, face, hands, mascot or cartoon character of ANY kind — depict ONLY objects and the setting. (The app renders its own non-human characters separately; a drawn human would contradict them.) No brand logos, no watermarks, no scary/violent elements — this is for children aged 6-13.";

export const PICTURE_PURPOSES = [
  'lesson_option',
  'option_card',
  'item_card',
  'scene_anchor',
  'memory_card',
  'outcome',
  'scene',
  // Arcade (gamegen/) — GAME_ENGINE.md §2. Purpose is part of the request-cache
  // hash (service/pictures.ts), so adding values is cache-safe: it mints new
  // keys and cannot invalidate an existing asset. NEVER bump STYLE_VERSION for
  // a new purpose — that would re-pay for the entire catalog.
  'game_sprite',
  'game_background',
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
  // simple/near-plain background, no scene clutter, unmistakable at thumbnail size.
  item_card:
    'This is a small answer/item TILE shown at ~64-96px. Depict ONE single object, centered, on a simple near-plain warm background, with a bold clear silhouette — instantly recognizable as the named object by a 6-year-old even when small. No scene clutter, no secondary objects.',
  option_card:
    'This is ONE option in a multiple-choice set shown at thumbnail size. Depict the single labeled object centered on a simple background. CRITICAL: it will sit beside sibling options — keep the SAME framing, scale, lighting and background as a neutral sibling; never make this tile look "nicer"/brighter/happier than the others (that would telegraph the answer). Just the object, clearly.',
  lesson_option:
    'This is ONE option in a multiple-choice set shown at thumbnail size. Depict the single labeled object centered on a simple background, instantly recognizable, visually parallel to sibling options (same framing/scale, never telegraph the answer).',
  memory_card:
    'This is a memory/matching game card face: one bold central subject, symmetric friendly composition, simple background, still readable when small.',
  // A wide establishing illustration above the prompt that sets the SITUATION.
  scene_anchor:
    'This is a wide ESTABLISHING scene shown above the exercise (roughly 16:9). Show the concrete situation through OBJECTS and SETTING ONLY — the lemonade stand, the goods, coins, jars, the sunny neighborhood — with a complete background, and NO people/characters of any kind. It sets context and mood; it MUST NOT reveal or hint at the answer to the exercise.',
  scene:
    'This is a wide story scene: show the objects and setting of the lemonade-stand world with a complete background, and NO people or characters.',
  outcome:
    'This is an OUTCOME/consequence illustration for a story branch ending. Convey the result through the SCENE and OBJECTS (e.g. a full coin jar for success, wilted lemonade for a setback) — never through a person or character, never anything scary or shaming.',
  // A minigame SPRITE: one prop the engine composites onto a live canvas, often
  // rendered at ~48-96px while it moves. It must read as the named object in a
  // fraction of a second, so it is the strictest legibility case we have.
  game_sprite:
    'This is a minigame SPRITE — a single game piece the engine draws on a moving canvas, often at ~48-96px. Depict ONE object, centered, filling the frame, with a bold high-contrast silhouette and chunky simple shapes; a child must name it at a glance while it is small and in motion. Sit it on a simple near-plain single-tone warm ground so it composites cleanly over the game canvas — no scene, no horizon, no secondary props, no fine detail or thin lines that vanish when scaled down. Ambiguity is a failure: the object must be unmistakable, never a generic blob and never a symbolic stand-in for the thing.',
  // A minigame BACKGROUND: deliberately the quietest image in the catalogue. It
  // sits UNDER the sprites and the HUD, so anything eye-catching in it is a bug.
  game_background:
    'This is a minigame BACKGROUND — a wide (roughly 16:9) backdrop that sits BEHIND moving sprites and a HUD of score/lives text. It must NEVER compete with the foreground for attention: this is the failure mode, so treat it as the rule. Keep it low-detail, low-contrast and softly muted (a calm sky, a gentle far-off street, simple ground bands), with an uncluttered, almost empty middle where the game is played and any detail pushed low and to the edges. NO single dominant subject, no bright accents, no busy patterns, no hard edges or high-contrast shapes that could be mistaken for a game piece or make overlaid text unreadable. Setting and objects only, complete background, no people or characters of any kind.',
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
  'NEVER DRAW PEOPLE OR CHARACTERS: no person, human, child, adult, face, hands, mascot, or cartoon character of ANY kind — depict ONLY objects and the setting. If the label or context names a character (Dina, Liruf, Rho, Zara) or "a kid/customer/vendor", do NOT draw them — draw the OBJECTS and PLACE of the scene instead (the app draws its own non-human characters separately). A drawn human is a hard failure.',
  'CHILD-LEGIBILITY (this is a picture a 6-year-old must read at a glance): draw the ACTUAL, LITERAL object named — never a symbolic or abstract stand-in. A "cost" is drawn as coins/a lemon, never a receipt; a "savings goal" is the actual toy, never a trophy or a target; "ice" is ice cubes, not a snowflake symbol. One dominant subject, bold high-contrast silhouette, unmistakable as the named thing.',
  'QUANTITIES ARE PICTORIAL: qwen-image loves rendering captions, so NEVER write an amount, price, or label as something to display ("10 pesos", "2 vasos"). Translate every quantity into visual composition instead — "two golden coins side by side", "a small stack of three coins". If the context mentions prices, show the OBJECTS, never the numbers.',
  "NEVER NAME DENOMINATIONS: never write a currency amount or denomination anywhere in your prompt, not even inside quotation marks — \"'1 peso' coin\" WILL be engraved verbatim onto the coin. Distinguish coins ONLY by size, color, or finish: 'one small copper coin and two larger golden coins'.",
  'NO TEXT-CARRYING PROPS: never mention signs, signboards, banners, price tags, labels, chalkboards, or menus. When a lemonade stand appears, describe only its awning, wooden table, and props, and state explicitly that the stand has no sign — otherwise the model invents one and fills it with a fake wordmark.',
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
  'text, letters, words, captions, typography, logo, brand name, wordmark, watermark, signature, signage, labels, numbers overlay, ' +
  'sign with writing, signboard text, price tag, chalkboard writing, coin inscriptions, engraved letters, engraved numbers, ' +
  'person, people, human, man, woman, child, kid, boy, girl, face, hands, character, mascot, cartoon character, humanoid figure';

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
