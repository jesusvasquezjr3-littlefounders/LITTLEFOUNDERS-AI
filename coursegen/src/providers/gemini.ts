// Gemini image generation ("nanobanana") — COURSE_ENGINE.md §4/§5 images
// stage. Optional: with no GEMINI_API_KEY the module throws a clear
// ProviderNotConfiguredError that pipeline/images.ts treats as "skip
// cleanly", never as a pipeline failure.

import { getConfig } from '../env.js';
import { ProviderHttpError, ProviderNetworkError, ProviderNotConfiguredError, ProviderTimeoutError } from './errors.js';
import { withTransportRetry } from './retry.js';
import { makeBackgroundTransparent } from './pngTransparency.js';
import type { UsageLedger } from './usage.js';

export interface GenerateImageRequest {
  /** Learner-visible image concept — kid-safe, no minor PII (§1.9). */
  prompt: string;
  operation: string;
  ledger?: UsageLedger;
}

export interface GenerateImageResult {
  /** Transparent-background PNG, ready for filebase upload. */
  pngBuffer: Buffer;
}

const STYLE_SUFFIX =
  ' Flat solid light background (single pale color, no gradient, no shadow on the background), ' +
  'centered subject, no text, no watermark, friendly rounded illustration style suitable for a children\'s app.';

interface GeminiGenerateContentResponse {
  candidates?: {
    content?: {
      parts?: { inlineData?: { data?: string; mimeType?: string } }[];
    };
  }[];
}

export async function generateImage(req: GenerateImageRequest): Promise<GenerateImageResult> {
  const c = getConfig();
  if (!c.GEMINI_API_KEY) throw new ProviderNotConfiguredError('gemini-image');

  req.ledger?.checkBudget();

  const timeoutMs = 120_000;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${c.GEMINI_IMAGE_MODEL}:generateContent?key=${c.GEMINI_API_KEY}`;

  const json = await withTransportRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${req.prompt}${STYLE_SUFFIX}` }] }],
            generationConfig: { responseModalities: ['IMAGE'] },
          }),
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) throw new ProviderTimeoutError('gemini-image', timeoutMs);
        throw new ProviderNetworkError('gemini-image', err);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new ProviderHttpError('gemini-image', res.status, body);
      }
      return (await res.json()) as GeminiGenerateContentResponse;
    } finally {
      clearTimeout(timer);
    }
  });

  const base64 = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!base64) {
    throw new Error('gemini-image: response had no inline image data');
  }

  const rawPng = Buffer.from(base64, 'base64');
  const transparent = makeBackgroundTransparent(rawPng);

  if (req.ledger) {
    await req.ledger.record({
      provider: 'gemini-image',
      model: c.GEMINI_IMAGE_MODEL,
      operation: req.operation,
      promptTokens: 0,
      completionTokens: 0,
    });
  }

  return { pngBuffer: transparent };
}
