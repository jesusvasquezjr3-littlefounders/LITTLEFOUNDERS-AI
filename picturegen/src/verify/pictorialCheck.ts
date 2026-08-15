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
  /**
   * Does the image actually depict the subject it was asked for? `null` when
   * no subject was supplied or the model did not answer — only an explicit
   * `false` is a defect, so a verifier that ignores the question can never
   * block generation (the never-block principle above).
   */
  depictsSubject: boolean | null;
}

export interface VerifyOptions {
  apiBase: string;
  apiKey: string;
  model: string;
  /**
   * What the image is supposed to show. When present the inspector is also
   * asked whether the pixels match it. Omit to run the legacy two-defect
   * check unchanged.
   */
  subject?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

/** Subject text is user-ish content going into a prompt — keep it short and single-line. */
const MAX_SUBJECT_CHARS = 300;

function sanitizeSubject(subject: string): string {
  return subject.replace(/\s+/g, ' ').trim().slice(0, MAX_SUBJECT_CHARS);
}

const TEXT_AND_PERSON_CHECKS = [
  'You are a strict QA inspector for a children\'s learning app. Inspect the image for these defects:',
  '(1) READABLE TEXT of any kind — words, brand names, signs/signboards with writing, captions, labels,',
  'price tags, or NUMERALS (digits), including text/numbers engraved on coins. A bare currency symbol',
  '($) with no letters or digits does NOT count as text.',
  '(2) ANY PERSON OR CHARACTER — a human, child, adult, face, hands, mascot, or cartoon character of any',
  'kind. This app draws its own characters separately, so a generated image must show ONLY objects and',
  'setting; any depicted person or character is a defect.',
].join(' ');

/*
 * (3) SUBJECT MATCH — added 2026-08-14. The two original checks both pass on a
 * beautiful, on-style illustration of entirely the wrong thing, which is
 * exactly what shipped: a lemonade stand over exercises about markets, budgets
 * and fraud. Text and people are defects of FORM; this is the defect of
 * CONTENT, and nothing in the pipeline looked for it.
 *
 * The bias is deliberately toward `true`. A false negative here costs a paid
 * redraw of an image that was fine, so the inspector is told to accept any
 * reasonable depiction and to answer `false` only when the picture plainly
 * shows a different situation. Note the subject arrives in the authoring
 * locale (es-MX) while the image prompt was English — the vision model is
 * multilingual and compares meaning, not strings.
 */
function subjectCheck(subject: string): string {
  return [
    `(3) WRONG SUBJECT. This image was commissioned to depict: "${sanitizeSubject(subject)}".`,
    'Judge ONLY whether the picture plausibly shows that place/object/situation.',
    'Be generous: different styling, framing, colours, extra props, or a partial view all still count as a match,',
    'and so does a close relative of the named thing. Answer false ONLY if the image clearly depicts a DIFFERENT',
    'situation or object than the one named — for example a drinks stand when a bank counter was asked for.',
  ].join(' ');
}

const REPLY_SHAPE_WITH_SUBJECT = [
  'Reply with STRICT JSON only, shaped exactly:',
  '{"has_text": boolean, "has_person": boolean, "depicts_subject": boolean, "found": string}.',
  '"found" briefly names the text and/or person you saw and, if depicts_subject is false, what the image shows instead; "" if none.',
].join(' ');

const REPLY_SHAPE_PLAIN = [
  'Reply with STRICT JSON only, shaped exactly: {"has_text": boolean, "has_person": boolean, "found": string}.',
  '"found" briefly names the text and/or person you saw, or "" if none.',
].join(' ');

export function verifyInstruction(subject?: string): string {
  const trimmed = subject ? sanitizeSubject(subject) : '';
  return trimmed
    ? `${TEXT_AND_PERSON_CHECKS} ${subjectCheck(trimmed)} ${REPLY_SHAPE_WITH_SUBJECT}`
    : `${TEXT_AND_PERSON_CHECKS} ${REPLY_SHAPE_PLAIN}`;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * Grades one parsed answer set. A partial reply can prove a defect but can
 * never prove an image clean.
 *
 * `depictsSubject` is asymmetric on purpose: an explicit `false` is a defect,
 * but `null` (question not asked, or model silent) must never stand in the way
 * of a `clean` verdict — otherwise adding the question would have turned every
 * older/quieter verifier into a permanent redraw loop.
 */
function grade(hasText: boolean | null, hasPerson: boolean | null, depictsSubject: boolean | null): PictorialInspection {
  if (hasText === true || hasPerson === true || depictsSubject === false) {
    return { verdict: 'defect', hasText, hasPerson, depictsSubject };
  }
  if (hasText === false && hasPerson === false) return { verdict: 'clean', hasText, hasPerson, depictsSubject };
  return { verdict: 'unavailable', hasText, hasPerson, depictsSubject };
}

const UNAVAILABLE: PictorialInspection = { verdict: 'unavailable', hasText: null, hasPerson: null, depictsSubject: null };

function boolOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function matchBool(content: string, key: string): boolean | null {
  const found = content.match(new RegExp(`"${key}"\\s*:\\s*(true|false)`))?.[1];
  return found === undefined ? null : found === 'true';
}

/** A partial reply can prove a defect but can never prove an image clean. */
export function parseInspection(content: string | null | undefined): PictorialInspection {
  if (!content) return UNAVAILABLE;
  try {
    const raw = JSON.parse(content) as { has_text?: unknown; has_person?: unknown; depicts_subject?: unknown };
    const graded = grade(boolOrNull(raw.has_text), boolOrNull(raw.has_person), boolOrNull(raw.depicts_subject));
    if (graded.verdict !== 'unavailable') return graded;
  } catch {
    // Some vision models wrap JSON in prose or fences — fall through to regex.
  }
  return grade(matchBool(content, 'has_text'), matchBool(content, 'has_person'), matchBool(content, 'depicts_subject'));
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
        messages: [
          { role: 'user', content: [{ type: 'image_url', image_url: { url: dataUrl } }, { type: 'text', text: verifyInstruction(opts.subject) }] },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) return UNAVAILABLE;
    const json = (await res.json().catch(() => null)) as ChatResponse | null;
    return parseInspection(json?.choices?.[0]?.message?.content);
  } catch {
    return UNAVAILABLE;
  } finally {
    clearTimeout(timer);
  }
}
