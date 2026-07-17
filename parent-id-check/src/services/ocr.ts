import { createWorker, type Worker } from 'tesseract.js';
import { getConfig } from '../config.js';

/*
 * Local OCR — tesseract.js (WASM). Chosen (Jesús, 2026-07-12) over external
 * providers so the ID photograph NEVER leaves our infrastructure: the image
 * buffer lives only in this process's memory for the duration of recognize()
 * and is never written to disk, logged, or sent anywhere.
 */

export type RecognizeFn = (image: Buffer) => Promise<string>;

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker(getConfig().OCR_LANGUAGES.split('+'));
  return workerPromise;
}

export const recognize: RecognizeFn = async (image) => {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(image);
  return text;
};

/** Test/shutdown hook. */
export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
