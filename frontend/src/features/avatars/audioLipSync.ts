import type { MouthPose } from './visemes';

/*
 * Drives the mouth from an audio element while it plays, with no text: it reads the loudness (how far the jaw opens)
 * and where the energy sits in the spectrum, which separates the vowels well enough for a cartoon mouth:
 *   low energy, under about 700 Hz       "oo" and "o": the lips round
 *   mid energy                            "a": the mouth opens wide
 *   high energy, over about 1.4 kHz       "e" and "i": the lips spread
 *   a lot of energy above 4 kHz           "s", "sh": the teeth show and the lips spread
 * It is the fallback for narration whose text is not at hand; with the text, `speak` with a `duration` is better,
 * because words are known. Nothing is recorded or sent anywhere: the analyser only reads the sound being played.
 */
const sources = new WeakMap<HTMLMediaElement, AudioLipSync>();

export class AudioLipSync {
  private readonly analyser: AnalyserNode;
  private readonly time: Uint8Array<ArrayBuffer>;
  private readonly spectrum: Uint8Array<ArrayBuffer>;
  private readonly hertzPerBin: number;
  private pose: MouthPose = { open: 0, wide: 1, pucker: 0, press: 0 };

  private constructor(private readonly context: AudioContext, media: HTMLMediaElement) {
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.55;
    this.time = new Uint8Array(this.analyser.fftSize);
    this.spectrum = new Uint8Array(this.analyser.frequencyBinCount);
    this.hertzPerBin = context.sampleRate / this.analyser.fftSize;

    const source = context.createMediaElementSource(media);

    source.connect(this.analyser);
    this.analyser.connect(context.destination);
  }

  /** One analyser per element: a media element can feed a Web Audio graph only once. */
  static of(media: HTMLMediaElement): AudioLipSync {
    let found = sources.get(media);

    if (!found) {
      found = new AudioLipSync(new AudioContext(), media);
      sources.set(media, found);
    }

    return found;
  }

  /** Browsers start audio contexts suspended until the visitor acts; call this from the play gesture. */
  resume(): Promise<void> {
    return this.context.state === 'suspended' ? this.context.resume() : Promise.resolve();
  }

  /** The mouth shape for this moment of the sound. */
  sample(): MouthPose {
    this.analyser.getByteTimeDomainData(this.time);
    this.analyser.getByteFrequencyData(this.spectrum);

    let sum = 0;

    for (const value of this.time) sum += ((value - 128) / 128) ** 2;

    const loudness = Math.sqrt(sum / this.time.length);
    const open = Math.max(0, Math.min(1, (loudness - 0.015) * 9));
    let weighted = 0;
    let total = 0;
    let high = 0;

    this.spectrum.forEach((value, bin) => {
      const hertz = bin * this.hertzPerBin;

      if (hertz > 4000) high += value;

      if (hertz < 150 || hertz > 4000) return;

      weighted += hertz * value;
      total += value;
    });

    const centroid = total > 0 ? weighted / total : 800;
    const hiss = total + high > 0 ? high / (total + high) : 0;

    const target: MouthPose = hiss > 0.45
      ? { open: open * 0.3, wide: 1.18, pucker: 0, press: 0 }
      : centroid < 700
        ? { open: open * 0.8, wide: 0.66, pucker: 0.55, press: 0 }
        : centroid > 1400
          ? { open: open * 0.6, wide: 1.2, pucker: 0, press: 0 }
          : { open, wide: 1, pucker: 0, press: 0 };

    // the shape eases, so the mouth does not flicker on every analysis frame
    this.pose = {
      open: this.pose.open + (target.open - this.pose.open) * 0.5,
      wide: this.pose.wide + (target.wide - this.pose.wide) * 0.35,
      pucker: this.pose.pucker + (target.pucker - this.pose.pucker) * 0.35,
      press: this.pose.press + (target.press - this.pose.press) * 0.35,
    };

    return this.pose;
  }
}
