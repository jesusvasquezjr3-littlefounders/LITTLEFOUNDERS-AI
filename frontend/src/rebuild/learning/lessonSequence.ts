export type LessonSequenceControl = {
  index: number;
  total: number;
  onAdvance: () => void;
};

export function sequenceProgress(sequence: LessonSequenceControl | undefined, finished: boolean): number {
  if (!sequence) return finished ? 100 : 0;
  return Math.round(100 * (sequence.index + (finished ? 1 : 0)) / sequence.total);
}
