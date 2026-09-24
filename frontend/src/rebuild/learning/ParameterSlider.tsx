import { useId } from 'react';

interface StepperLabels { decrease: string; increase: string }

/** One HTML control path for pointer, touch, keyboard and discrete step alternatives. */
export function ParameterSlider({ className, label, valueText, minimum, maximum, step, value, onValueChange, stepper }: {
  className?: string; label: string; valueText: string; minimum: number; maximum: number; step: number;
  value: number; onValueChange: (value: number) => void; stepper?: StepperLabels;
}) {
  const inputId = useId();
  return <div className={className ? `lf-parameter-slider ${className}` : 'lf-parameter-slider'}>
    <label htmlFor={inputId} data-copy-role="body">{label} <strong data-copy-role="data">{valueText}</strong></label>
    <input id={inputId} type="range" min={minimum} max={maximum} step={step} value={value} aria-valuetext={valueText}
      onChange={(event) => onValueChange(Number(event.target.value))} />
    {stepper ? <div className="lf-parameter-stepper">
      <button type="button" data-copy-role="action" aria-label={stepper.decrease} disabled={value <= minimum}
        onClick={() => onValueChange(value - step)}>−</button>
      <button type="button" data-copy-role="action" aria-label={stepper.increase} disabled={value >= maximum}
        onClick={() => onValueChange(value + step)}>+</button>
    </div> : null}
  </div>;
}
