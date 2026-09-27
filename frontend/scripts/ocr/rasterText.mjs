import { resolve } from 'node:path';
import sharp from 'sharp';
import { createWorker, OEM } from 'tesseract.js';

/*
 * The automated "no text inside raster art" check (Frontend Bible 07 §7 item 1,
 * "the no-text check (OCR finds no text)"; owner decision OD-28 V-16).
 *
 * Zero spend and offline (OD-23): tesseract.js runs its bundled WASM core, and
 * the English, Spanish and Portuguese LSTM models are vendored beside this file
 * (`tessdata/*.traineddata.gz`, the 4.0.0_best_int models of the MIT-licensed
 * @tesseract.js-data packages). `langPath` always points there, so tesseract.js
 * never falls back to its CDN download; `cacheMethod: 'none'` writes no cache.
 *
 * Each image is read twice: flattened onto white and onto black, so dark text
 * on a transparent render and light text on one are both found. A recognized
 * word counts as text when it has at least TEXT_MIN_CHARS letters or digits and
 * a confidence of at least TEXT_MIN_CONFIDENCE. Calibrated on the 22 Mentor
 * renders registered on 27 September 2026: their shapes read as noise tokens of
 * one to three characters at confidence 79 or less, while real words (16 px to
 * 60 px, light or dark, EN/ES/PT) read at 90 or more.
 */
export const OCR_LANGS = ['eng', 'spa', 'por'];
export const TEXT_MIN_CHARS = 3;
export const TEXT_MIN_CONFIDENCE = 85;
export const TESSDATA = resolve(import.meta.dirname, 'tessdata');

const alphanumerics = (text) => (text.match(/[\p{L}\p{N}]/gu) ?? []).length;

/** Words that count as text in one OCR result. */
export function textWords(words) {
  return words.filter((word) => alphanumerics(word.text) >= TEXT_MIN_CHARS && word.confidence >= TEXT_MIN_CONFIDENCE);
}

/** Opens one OCR worker; `read(bytes)` returns the words that count as text (PNG or WebP bytes). */
export async function createRasterTextReader() {
  const worker = await createWorker(OCR_LANGS, OEM.LSTM_ONLY, { langPath: TESSDATA, cacheMethod: 'none', gzip: true });
  return {
    async read(bytes) {
      const found = [];
      for (const background of ['#ffffff', '#000000']) {
        const image = await sharp(bytes).flatten({ background }).png().toBuffer();
        const { data } = await worker.recognize(image, {}, { blocks: true });
        const words = (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)));
        for (const word of textWords(words)) if (!found.some((seen) => seen.text === word.text)) found.push({ text: word.text, confidence: Math.round(word.confidence) });
      }
      return found;
    },
    close: () => worker.terminate(),
  };
}
