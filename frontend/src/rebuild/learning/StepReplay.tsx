import { useEffect, useState } from 'react';
import { Button, Slider } from '../design/controls';

export interface StepReplayLabels {
  previous: string;
  next: string;
  play: string;
  pause: string;
  step: string;
}

/** A controlled replay of an authored sequence; the caller owns the process state. */
export function StepReplay({ steps, index, onChange, labels }: {
  steps: number;
  index: number;
  onChange: (index: number) => void;
  labels: StepReplayLabels;
}) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || index >= steps) return;
    const timer = window.setTimeout(() => onChange(index + 1), 900);
    return () => window.clearTimeout(timer);
  }, [playing, index, steps, onChange]);

  useEffect(() => {
    if (index >= steps) setPlaying(false);
  }, [index, steps]);

  const move = (next: number) => {
    setPlaying(false);
    onChange(next);
  };

  return <div className="lf-step-replay" role="group" aria-label={labels.step}>
    <div className="lf-step-replay-actions">
      <Button disabled={index === 0} onClick={() => move(index - 1)}>{labels.previous}</Button>
      <Button disabled={index === steps && !playing} onClick={() => setPlaying((value) => !value)}>
        {playing ? labels.pause : labels.play}</Button>
      <Button disabled={index === steps} onClick={() => move(index + 1)}>{labels.next}</Button>
    </div>
    <Slider className="lf-step-replay-scrub" label={labels.step} valueText={`${index}/${steps}`} min={0} max={steps} value={index} onValueChange={move} />
  </div>;
}
