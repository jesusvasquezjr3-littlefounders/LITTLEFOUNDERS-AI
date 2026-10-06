import { useEffect, useState } from 'react';
import { Button, Slider } from '../design/controls';
import { useLessonStageRequest } from './lessonStage';

export interface StepReplayLabels {
  previous: string;
  next: string;
  play: string;
  pause: string;
  step: string;
}

/** A controlled replay of an authored sequence; the caller owns the process state. */
export function StepReplay({ steps, index, onChange, labels, disabled = false }: {
  disabled?: boolean;
  steps: number;
  index: number;
  onChange: (index: number) => void;
  labels: StepReplayLabels;
}) {
  const [playing, setPlaying] = useState(false);
  // GAP-FIX-R5 (08 §11): a replayed step on screen is the Mentor demonstrating beside the board.
  useLessonStageRequest('demonstrating');

  useEffect(() => {
    if (disabled || !playing || index >= steps) return;
    const timer = window.setTimeout(() => onChange(index + 1), 900);
    return () => window.clearTimeout(timer);
  }, [disabled, playing, index, steps, onChange]);

  useEffect(() => {
    if (index >= steps) setPlaying(false);
  }, [index, steps]);

  const move = (next: number) => {
    if (disabled) return;
    setPlaying(false);
    onChange(next);
  };

  return <div className="lf-step-replay" role="group" aria-label={labels.step}>
    <div className="lf-step-replay-actions">
      <Button disabled={disabled || index === 0} onClick={() => move(index - 1)}>{labels.previous}</Button>
      <Button disabled={disabled || (index === steps && !playing)} onClick={() => setPlaying((value) => !value)}>
        {playing ? labels.pause : labels.play}</Button>
      <Button disabled={disabled || index === steps} onClick={() => move(index + 1)}>{labels.next}</Button>
    </div>
    <Slider disabled={disabled} className="lf-step-replay-scrub" label={labels.step} valueText={`${index}/${steps}`} min={0} max={steps} value={index} onValueChange={move} />
  </div>;
}
