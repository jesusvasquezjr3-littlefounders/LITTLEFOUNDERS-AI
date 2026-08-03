/*
 * The PICTORIAL VERIFIER — the mechanical half of the no-text guarantee.
 *
 * Prompt engineering alone cannot make Qwen-Image text-free: the first v3
 * batch (2026-07-23) proved it twice. A prompt saying "lemonade stand" made
 * the model draw the stand WITH a signboard and fill it with a fake wordmark
 * ("Founters") even though the prompt demanded "absolutely no text"; a judge
 * prompt that quoted coin denominations ("'1 peso' coin") got them engraved
 * verbatim — misspelled — onto the coins. The positive prompt always wins.
 *
 * After every paid generation, a vision model checks actual pixels for
 * readable text and people/characters. White object-tile canvases are checked
 * separately by `whiteCanvasCheck.ts`: a deterministic edge-pixel rule is
 * more reliable than asking a vision model to distinguish a colored object
 * from its background.
 *
 * Never-block principle: if the vision verifier is unreachable or returns
 * garbage, the image is accepted unverified ('unavailable'). Only a confident
 * text/person verdict triggers a retry.
 */

export type PictorialVerdict = 'clean' | 'defect' | 'unavailable';

/** Structured, non-user-facing diagnosis; provider prose is discarded. */
export interface PictorialInspection {
  verdict: PictorialVerdict;
  hasText: boolean | null;
  hasPerson: boolean | null;
}

export interface VerifyOptions {
  apiBase: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

const VERIFY_INSTRUCTION = [
  'You are a strict QA inspector for a children\'s learning app. Inspect the image for TWO defects:',
  '(1) READABLE TEXT of any kind — words, brand names, signs/signboards with writing, captions, labels,',
  'price tags, or NUMERALS (digits), including text/numbers engraved on coins. A bare currency symbol',
  '($) with no letters or digits does NOT count as text.',
  '(2) ANY PERSON OR CHARACTER — a human, child, adult, face, hands, mascot, or cartoon character of any',
  'kind. This app draws its own characters separately, so a generated image must show ONLY objects and',
  'setting; any depicted person or character is a defect.',
  'Reply with STRICT JSON only, shaped exactly: {"has_text": boolean, "has_person": boolean, "found": string}.',
  '"found" briefly names the text and/or person you saw, or "" if none.',
].join(' ');

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/** A partial reply can prove a defect but can never prove an image clean. */
export function parseInspection(content: string | null | undefined): PictorialInspection {
  if (!content) return { verdict: 'unavailable', hasText: null, hasPerson: null };
  try {
    const raw = JSON.parse(content) as { has_text?: unknown; has_person?: unknown };
    const hasText = typeof raw.has_text === 'boolean' ? raw.has_text : null;
    const hasPerson = typeof raw.has_person === 'boolean' ? raw.has_person : null;
    if (hasText === true || hasPerson === true) return { verdict: 'defect', hasText, hasPerson };
    if (hasText === false && hasPerson === false) return { verdict: 'clean', hasText, hasPerson };
  } catch {
    // Some vision models wrap JSON in prose or fences — fall through to regex.
  }
  const text = content.match(/"has_text"\s*:\s*(true|false)/)?.[1];
  const person = content.match(/"has_person"\s*:\s*(true|false)/)?.[1];
  const hasText = text === undefined ? null : text === 'true';
  const hasPerson = person === undefined ? null : person === 'true';
  if (hasText === true || hasPerson === true) return { verdict: 'defect', hasText, hasPerson };
  if (hasText === false && hasPerson === false) return { verdict: 'clean', hasText, hasPerson };
  return { verdict: 'unavailable', hasText, hasPerson };
}

/** Compatibility helper for callers that only need the gate decision. */
export function parseVerdict(content: string | null | undefined): PictorialVerdict {
  return parseInspection(content).verdict;
}

/** Resolves to a structured inspection, never throws. */
export async function verifyPictorial(bytes: Buffer, contentType: string, opts: VerifyOptions): Promise<PictorialInspection> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dataUrl = `data:${contentType.split(';')[0]?.trim() || 'image/png'};base64,${bytes.toString('base64')}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${opts.apiBase}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: dataUrl } }, { type: 'text', text: VERIFY_INSTRUCTION }] }],
        temperature: 0,
      }),
    });
    if (!res.ok) return { verdict: 'unavailable', hasText: null, hasPerson: null };
    const json = (await res.json().catch(() => null)) as ChatResponse | null;
    return parseInspection(json?.choices?.[0]?.message?.content);
  } catch {
    return { verdict: 'unavailable', hasText: null, hasPerson: null };
  } finally {
    clearTimeout(timer);
  }
}
