import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Glyph } from './glyphs';

/*
 * Form controls (Frontend Bible 02 §3 `input`, §4.4, §9.8). Every control has a
 * visible label, optional help above the control and an error directly under
 * it that pairs a glyph with words. Values scroll inside their box; labels,
 * help and errors wrap. No component owns a string: callers pass translated,
 * copy-budgeted text.
 */

function describedBy(...ids: (string | false | undefined)[]) {
  const value = ids.filter(Boolean).join(' ');
  return value || undefined;
}

function FieldMessages({ helpId, help, errorId, error }: { helpId: string; help?: ReactNode; errorId: string; error?: ReactNode }) {
  return <>
    {help ? <p id={helpId} className="lf-input-help" data-copy-role="body">{help}</p> : null}
    {error ? <p id={errorId} className="lf-input-error" data-copy-role="body"><Glyph name="warning" /><span>{error}</span></p> : null}
  </>;
}

type InputBase = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id' | 'className'> & { label: string; help?: string; error?: string };
export type TextFieldProps =
  | (InputBase & { type?: 'text' | 'email' | 'number' | 'date' | 'search' | 'tel' | 'url'; revealLabels?: never })
  | (InputBase & { type: 'password'; revealLabels: { show: string; hide: string } });

export function TextField({ label, help, error, type = 'text', revealLabels, ...props }: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const helpId = `${id}-help`, errorId = `${id}-error`;
  return <div className="lf-input-field">
    <label htmlFor={id} className="lf-input-label" data-copy-role="body">{label}</label>
    <FieldMessages helpId={helpId} help={help} errorId={errorId} />
    <div className="lf-input-box">
      <input {...props} id={id} type={type === 'password' && revealed ? 'text' : type} className="lf-input"
        aria-invalid={error ? true : undefined} aria-describedby={describedBy(help && helpId, error && errorId, props['aria-describedby'])} />
      {type === 'password' && revealLabels ? <button type="button" className="lf-input-reveal" aria-controls={id} data-copy-role="action"
        aria-label={revealed ? revealLabels.hide : revealLabels.show} disabled={props.disabled} onClick={() => setRevealed((value) => !value)}>
        <Glyph name={revealed ? 'hide' : 'show'} />
      </button> : null}
    </div>
    <FieldMessages helpId={helpId} errorId={errorId} error={error} />
  </div>;
}

export interface SelectOption { value: string; label: string; role?: 'option' | 'data' }

export function SelectField({ label, help, error, options, ...props }: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className' | 'children'> & {
  label: string; help?: string; error?: string; options: readonly SelectOption[];
}) {
  const id = useId();
  const helpId = `${id}-help`, errorId = `${id}-error`;
  return <div className="lf-input-field">
    <label htmlFor={id} className="lf-input-label" data-copy-role="body">{label}</label>
    <FieldMessages helpId={helpId} help={help} errorId={errorId} />
    <div className="lf-input-box">
      <select {...props} id={id} className="lf-input lf-select" aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(help && helpId, error && errorId, props['aria-describedby'])}>
        {options.map((option) => <option key={option.value} value={option.value} data-copy-role={option.role ?? 'option'}>{option.label}</option>)}
      </select>
      <Glyph name="chevron" className="lf-system-glyph lf-select-chevron" />
    </div>
    <FieldMessages helpId={helpId} errorId={errorId} error={error} />
  </div>;
}

export function Checkbox({ label, help, error, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id' | 'className'> & {
  label: string; help?: string; error?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`, errorId = `${id}-error`;
  return <div className="lf-check-field">
    <label className="lf-check" htmlFor={id}>
      <span className="lf-check-control">
        <input {...props} id={id} type="checkbox" className="lf-check-input" aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(help && helpId, error && errorId, props['aria-describedby'])} />
        <Glyph name="check" className="lf-system-glyph lf-check-mark" />
      </span>
      <span className="lf-check-label" data-copy-role="body">{label}</span>
    </label>
    <FieldMessages helpId={helpId} help={help} errorId={errorId} error={error} />
  </div>;
}

export interface ChoiceOption<T extends string> { value: T; label: string; disabled?: boolean }

/** "Choose one" is a rounded rectangle with a ring-and-dot mark (02 §9.5 shape table). */
export function RadioGroup<T extends string>({ legend, help, error, name, options, value, onValueChange, disabled }: {
  legend: string; help?: string; error?: string; name: string; options: readonly ChoiceOption<T>[];
  value: T | null; onValueChange: (value: T) => void; disabled?: boolean;
}) {
  const id = useId();
  const helpId = `${id}-help`, errorId = `${id}-error`;
  return <fieldset className={`lf-radio-group${error ? ' lf-radio-group--invalid' : ''}`} disabled={disabled}
    aria-describedby={describedBy(help && helpId, error && errorId)} aria-invalid={error ? true : undefined}>
    <legend className="lf-input-label" data-copy-role="body">{legend}</legend>
    <FieldMessages helpId={helpId} help={help} errorId={errorId} />
    <div className="lf-radio-options">
      {options.map((option) => <label key={option.value} className="lf-radio-option">
        <input type="radio" className="lf-radio-input" name={name} value={option.value} checked={value === option.value}
          disabled={option.disabled} onChange={() => onValueChange(option.value)} />
        <span className="lf-radio-label" data-copy-role="option">{option.label}</span>
      </label>)}
    </div>
    <FieldMessages helpId={helpId} errorId={errorId} error={error} />
  </fieldset>;
}

/** A compact "choose one view" control; the selected segment also shows a check, so colour is never the only cue. */
export function SegmentedControl<T extends string>({ legend, name, options, value, onValueChange, disabled }: {
  legend: string; name: string; options: readonly ChoiceOption<T>[]; value: T; onValueChange: (value: T) => void; disabled?: boolean;
}) {
  return <fieldset className="lf-segmented" disabled={disabled}>
    <legend className="lf-input-label" data-copy-role="body">{legend}</legend>
    <div className="lf-segmented-options">
      {options.map((option) => <label key={option.value} className="lf-segmented-option">
        <input type="radio" className="lf-segmented-input" name={name} value={option.value} checked={value === option.value}
          disabled={option.disabled} onChange={() => onValueChange(option.value)} />
        {value === option.value ? <Glyph name="check" /> : null}
        <span data-copy-role="option">{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}

/**
 * An on/off setting that applies immediately. The thumb position, a check in
 * the thumb and the state word all change, never the colour alone.
 */
export function Switch({ label, checked, onCheckedChange, stateLabels, pending = false, disabled, help }: {
  label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; stateLabels: { on: string; off: string };
  pending?: boolean; disabled?: boolean; help?: string;
}) {
  const id = useId();
  return <div className="lf-toggle-field">
    <button type="button" role="switch" className="lf-toggle" aria-checked={checked} aria-labelledby={`${id}-label`}
      aria-describedby={help ? `${id}-help` : undefined} disabled={disabled} aria-busy={pending || undefined} aria-disabled={pending || undefined}
      onClick={() => { if (!pending) onCheckedChange(!checked); }}>
      <span id={`${id}-label`} className="lf-toggle-label" data-copy-role="body">{label}</span>
      <span className="lf-toggle-state" aria-hidden="true" data-copy-role="option">{checked ? stateLabels.on : stateLabels.off}</span>
      <span className="lf-toggle-track" aria-hidden="true"><span className="lf-toggle-thumb">{checked ? <Glyph name="check" /> : null}</span></span>
    </button>
    {help ? <p id={`${id}-help`} className="lf-input-help" data-copy-role="body">{help}</p> : null}
  </div>;
}

/** One native range input serves pointer, touch and keyboard; the value is always also written as text. */
export function Slider({ label, valueText, min, max, step = 1, value, onValueChange, disabled }: {
  label: string; valueText: string; min: number; max: number; step?: number; value: number;
  onValueChange: (value: number) => void; disabled?: boolean;
}) {
  const id = useId();
  return <div className="lf-slider">
    <div className="lf-slider-head">
      <label htmlFor={id} className="lf-input-label" data-copy-role="body">{label}</label>
      <output htmlFor={id} className="lf-slider-value" data-copy-role="data">{valueText}</output>
    </div>
    <input id={id} type="range" className="lf-slider-input" min={min} max={max} step={step} value={value}
      aria-valuetext={valueText} disabled={disabled} onChange={(event) => onValueChange(Number(event.target.value))} />
  </div>;
}

/** Discrete −/+ control. Bounds disable the matching button instead of silently clamping a press. */
export function Stepper({ label, value, valueText, min, max, step = 1, onValueChange, labels, disabled }: {
  label: string; value: number; valueText?: string; min: number; max: number; step?: number;
  onValueChange: (value: number) => void; labels: { decrease: string; increase: string }; disabled?: boolean;
}) {
  const id = useId();
  return <div className="lf-stepper" role="group" aria-labelledby={`${id}-label`}>
    <span id={`${id}-label`} className="lf-input-label" data-copy-role="body">{label}</span>
    <div className="lf-stepper-controls">
      <button type="button" className="lf-stepper-button" aria-label={`${label}: ${labels.decrease}`} data-copy-role="action"
        disabled={disabled || value - step < min} onClick={() => onValueChange(value - step)}><Glyph name="minus" /></button>
      <output className="lf-stepper-value" aria-live="polite" data-copy-role="data">{valueText ?? value}</output>
      <button type="button" className="lf-stepper-button" aria-label={`${label}: ${labels.increase}`} data-copy-role="action"
        disabled={disabled || value + step > max} onClick={() => onValueChange(value + step)}><Glyph name="plus" /></button>
    </div>
  </div>;
}
