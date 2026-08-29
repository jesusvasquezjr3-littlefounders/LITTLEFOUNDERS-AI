/*
 * PUTTING A STREAMED CLIP BACK TOGETHER.
 *
 * The learner's microphone uploads while they are still speaking: MediaRecorder
 * emits a chunk every few hundred milliseconds and each one crosses the socket
 * as its own base64 frame. Reassembling them is one line, and getting that line
 * wrong is invisible — the clip still decodes, still transcribes, and still
 * comes back with words in it.
 *
 * THE DEFECT THIS EXISTS TO PREVENT. The commit used to do
 * `parts.join('')`, concatenating the base64 STRINGS. That is not the same
 * operation as base64-encoding concatenated BYTES: every frame is its own
 * complete document, so any chunk whose byte length is not a multiple of three
 * ends in `=` padding, and joining puts that padding in the middle. Decoders
 * stop there. Two four-byte chunks joined that way decode to four bytes.
 *
 * MediaRecorder's first chunk is the container header plus a fraction of a
 * second of audio, so what actually reached the transcriber was the first
 * syllable — for every microphone turn, on every browser, for as long as
 * streaming had existed. A learner who asked "¿Qué es el interés compuesto?"
 * was heard saying "Ah."
 *
 * It never looked like a bug in the assembly, because it looked like a bug in
 * speech recognition.
 */

/** One streamed frame, decoded on arrival. Decoding here is the whole point. */
export function decodeChunk(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * The complete clip, as bytes.
 *
 * Takes already-decoded chunks so the concatenation cannot be done on the
 * encoded form by mistake — the type is the guardrail.
 */
export function assembleClip(parts: readonly Buffer[]): Buffer {
  return Buffer.concat(parts as Buffer[]);
}
