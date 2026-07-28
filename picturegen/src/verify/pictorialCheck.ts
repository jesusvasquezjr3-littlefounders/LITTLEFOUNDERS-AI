/*
 * The PICTORIAL VERIFIER — the mechanical half of the no-text guarantee.
 *
 * Prompt engineering alone cannot make qwen-image text-free: the first v3
 * batch (2026-07-23) proved it twice. A prompt saying "lemonade stand" made
 * the model draw the stand WITH a signboard and fill it with a fake wordmark
 * ("Founters") even though the prompt demanded "absolutely no text"; a judge
 * prompt that quoted coin denominations ("'1 peso' coin") got them engraved
 * verbatim — misspelled — onto the coins. The positive prompt always wins.
 *
 * So after every paid generation, a vision model (same DashScope account)
 * looks at the actual pixels and answers: does the image contain (a) readable
 * text — letters, words or numerals — or (b) any PERSON/CHARACTER? Currency
 * symbols ($) alone are acceptable coin iconography; letters and digits are
 * not. People are never acceptable — the app draws its own non-human
 * characters separately, so a generated human contradicts them. Only images
 * that pass both checks get cached and returned; a failing image is
 * regenerated from a fresh judge prompt (the judge is nondeterministic, so
 * each retry is a genuinely new composition).
 *
 * Never-block principle: if the VERIFIER itself is unreachable or returns
 * garbage, the image is accepted unverified ('unavailable') — an outage of
 * the vision model must not take down illustration generation. Only a
 * confident 'defect' verdict (text OR person) triggers a retry.
 */

export type PictorialVerdict = 'clean' | 'defect' | 'unavailable';

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

/** Defensive parse: strict JSON first, then a flag regex over prose. A 'defect'
 *  is readable text OR a depicted person/character. */
export function parseVerdict(content: string | null | undefined): PictorialVerdict {
  if (!content) return 'unavailable';
  try {
    const raw = JSON.parse(content) as { has_text?: unknown; has_person?: unknown };
    if (typeof raw.has_text === 'boolean' || typeof raw.has_person === 'boolean') {
      return raw.has_text === true || raw.has_person === true ? 'defect' : 'clean';
    }
  } catch {
    // Some vision models wrap JSON in prose or fences — fall through to regex.
  }
  const text = content.match(/"has_text"\s*:\s*(true|false)/);
  const person = content.match(/"has_person"\s*:\s*(true|false)/);
  if (text || person) {
    return text?.[1] === 'true' || person?.[1] === 'true' ? 'defect' : 'clean';
  }
  return 'unavailable';
}

/**
 * Asks the vision model whether `bytes` contains readable text. Resolves to a
 * verdict, never throws — any transport/parse failure is 'unavailable'.
 */
export async function verifyPictorial(bytes: Buffer, contentType: string, opts: VerifyOptions): Promise<PictorialVerdict> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const dataUrl = `data:${contentType.split(';')[0]?.trim() || 'image/png'};base64,${bytes.toString('base64')}`;

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
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: VERIFY_INSTRUCTION },
            ],
          },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) return 'unavailable';
    const json = (await res.json().catch(() => null)) as ChatResponse | null;
    return parseVerdict(json?.choices?.[0]?.message?.content);
  } catch {
    return 'unavailable';
  } finally {
    clearTimeout(timer);
  }
}
