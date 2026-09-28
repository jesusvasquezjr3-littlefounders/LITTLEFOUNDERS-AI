import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Glyph } from './glyphs';
import { withPressFeedback } from './motion';

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

function FieldMessages({ helpId, help, errorId, error, errorLive = false }: { helpId: string; help?: ReactNode; errorId: string; error?: ReactNode; errorLive?: boolean }) {
  return <>
    {help ? <p id={helpId} className="lf-input-help" data-copy-role="body">{help}</p> : null}
    {error ? <p id={errorId} className="lf-input-error" data-copy-role="body" role={errorLive ? 'alert' : undefined}><Glyph name="warning" /><span>{error}</span></p> : null}
  </>;
}

type InputBase = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id' | 'className'> & {
  label: string; help?: string; error?: string;
  /**
   * Announce the error as an alert when it appears. For an error that arrives
   * from outside the field after a submit (a wrong password returned by the
   * server), where nothing else would announce it; the error is still drawn
   * once, directly under the control. Errors that follow the person's own
   * typing stay silent (they are read with the field).
   */
  errorLive?: boolean;
};
export type TextFieldProps =
  | (InputBase & { type?: 'text' | 'email' | 'number' | 'date' | 'search' | 'tel' | 'url'; revealLabels?: never })
  | (InputBase & { type: 'password'; revealLabels: { show: string; hide: string } });

export function TextField({ label, help, error, errorLive = false, type = 'text', revealLabels, ...props }: TextFieldProps) {
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
    <FieldMessages helpId={helpId} errorId={errorId} error={error} errorLive={errorLive} />
  </div>;
}

/**
 * A multi-line text field, for free text of more than one sentence (a staff
 * member's resolution note). The same label, help, error and fill as
 * TextField; the box grows downward only, never sideways.
 */
export function TextAreaField({ label, help, error, rows = 3, ...props }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className' | 'children'> & {
  label: string; help?: string; error?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`, errorId = `${id}-error`;
  return <div className="lf-input-field">
    <label htmlFor={id} className="lf-input-label" data-copy-role="body">{label}</label>
    <FieldMessages helpId={helpId} help={help} errorId={errorId} />
    <textarea {...props} id={id} rows={rows} className="lf-input lf-textarea" aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(help && helpId, error && errorId, props['aria-describedby'])} />
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

export interface PictureOption<T extends string> {
  value: T;
  /** The option's name. Shown when the option has no picture; otherwise it names the picture for assistive technology. */
  label: string;
  /** Our own drawing of the option (a manifest-registered asset), decorative: the label names it. */
  picture?: ReactNode;
  /** A colour to choose, drawn as a round swatch with a thin functional edge (02 §4.4 (1)). */
  swatch?: string;
}

/**
 * "Choose one" among pictures: a colour, a drawing, a preset (W2 profile lane:
 * the avatar parts and the cover presets). One radio group, so the arrow keys
 * move within it and Tab leaves it; every option has a name, and the chosen one
 * carries a ring and a check, never colour alone (02 rule 6, §4.4 (2)). An
 * option without a picture (for example "None") shows its label.
 */
export function PictureChoice<T extends string>({ legend, legendRole = 'body', name, options, value, onValueChange, disabled }: {
  legend: string; legendRole?: 'body' | 'heading'; name: string; options: readonly PictureOption<T>[]; value: T | null;
  onValueChange: (value: T) => void; disabled?: boolean;
}) {
  return <fieldset className="lf-picture-choice" disabled={disabled}>
    <legend className="lf-picture-choice-legend" data-copy-role={legendRole}>{legend}</legend>
    <div className="lf-picture-options">
      {options.map((option) => {
        const kind = option.swatch ? 'swatch' : option.picture ? 'picture' : 'text';
        return <label key={option.value} className={`lf-picture-option lf-picture-option--${kind}`} data-value={option.value} onPointerDown={withPressFeedback()}>
          {/* 02 §9.1: the press ring's clipping layer, so the check badge on the corner stays whole. */}
          <span className="lf-press-host" data-press-host aria-hidden="true" />
          <input type="radio" className="lf-picture-input" name={name} value={option.value} checked={value === option.value}
            aria-label={kind === 'text' ? undefined : option.label} onChange={() => onValueChange(option.value)} />
          {kind === 'swatch' ? <span className="lf-picture-swatch" style={{ background: option.swatch }} aria-hidden="true" />
            : kind === 'picture' ? option.picture : <span data-copy-role="option">{option.label}</span>}
          <span className="lf-picture-check" aria-hidden="true"><Glyph name="check" /></span>
        </label>;
      })}
    </div>
  </fieldset>;
}

/**
 * A compact "choose one" control; the selected segment also shows a check, so
 * colour is never the only cue. `legendHidden` names the group for assistive
 * technology only (no hidden text node) when a visible heading right above
 * already says it.
 */
export function SegmentedControl<T extends string>({ legend, legendHidden = false, name, options, value, onValueChange, disabled, className, size = 'md' }: {
  legend: string; legendHidden?: boolean; name: string; options: readonly ChoiceOption<T>[]; value: T | null; onValueChange: (value: T) => void;
  disabled?: boolean; className?: string;
  /**
   * `compact` (OD-28, owner review item V-13): on a phone-width container the
   * options take less padding, a smaller gap and a smaller check, so the control
   * can share a row with the action beside it. The 48 px target floor, the check
   * mark and the type step never change (02 §8).
   */
  size?: 'md' | 'compact';
}) {
  const classes = ['lf-segmented'];
  if (size === 'compact') classes.push('lf-segmented--compact');
  if (className) classes.push(className);
  return <fieldset className={classes.join(' ')} disabled={disabled} aria-label={legendHidden ? legend : undefined}>
    {legendHidden ? null : <legend className="lf-input-label" data-copy-role="body">{legend}</legend>}
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

export interface StepLabels { decrease: string; increase: string }

/** One −/+ press. At a bound it is disabled instead of clamping silently. */
function StepButton({ direction, label, value, min, max, step, onValueChange, labels, disabled }: {
  direction: -1 | 1; label: string; value: number; min: number; max: number; step: number; onValueChange: (value: number) => void; labels: StepLabels; disabled?: boolean;
}) {
  const next = value + direction * step;
  return <button type="button" className="lf-stepper-button" aria-label={`${label}: ${direction < 0 ? labels.decrease : labels.increase}`} data-copy-role="action"
    disabled={disabled || next < min || next > max} onClick={() => onValueChange(next)}><Glyph name={direction < 0 ? 'minus' : 'plus'} /></button>;
}

/**
 * One native range input serves pointer, touch and keyboard; the value is
 * always also written as text. `stepLabels` adds the discrete −/+ alternative
 * (05 interaction contract) for people who cannot drag precisely.
 */
export function Slider({ label, valueText, min, max, step = 1, value, onValueChange, disabled, stepLabels, className }: {
  label: string; valueText: string; min: number; max: number; step?: number; value: number;
  onValueChange: (value: number) => void; disabled?: boolean; stepLabels?: StepLabels; className?: string;
}) {
  const id = useId();
  return <div className={`lf-slider${className ? ` ${className}` : ''}`}>
    <div className="lf-slider-head">
      <label htmlFor={id} className="lf-input-label" data-copy-role="body">{label}</label>
      {/* The range already speaks this value (aria-valuetext); the written copy is for the eye, not a second live region. */}
      <span className="lf-slider-value" aria-hidden="true" data-copy-role="data">{valueText}</span>
    </div>
    <input id={id} type="range" className="lf-slider-input" min={min} max={max} step={step} value={value}
      aria-valuetext={valueText} disabled={disabled} onChange={(event) => onValueChange(Number(event.target.value))} />
    {stepLabels ? <div className="lf-slider-steps">
      <StepButton direction={-1} label={label} value={value} min={min} max={max} step={step} onValueChange={onValueChange} labels={stepLabels} disabled={disabled} />
      <StepButton direction={1} label={label} value={value} min={min} max={max} step={step} onValueChange={onValueChange} labels={stepLabels} disabled={disabled} />
    </div> : null}
  </div>;
}

/**
 * Discrete −/+ control. Bounds disable the matching button instead of silently
 * clamping a press. `labelHidden` keeps the name for assistive technology when
 * the board right above already shows what is being changed; `showValue={false}`
 * is for estimation tasks, where writing the value would give the answer away
 * (the board's own drawing is the feedback).
 */
export function Stepper({ label, labelHidden = false, showValue = true, valuePlacement = 'between', value, valueText, min, max, step = 1, onValueChange, labels, disabled, className }: {
  label: string; labelHidden?: boolean; showValue?: boolean;
  /**
   * `between` writes the value between − and +. `label` writes it under the
   * label with both buttons together at the end, for rows of steppers (one
   * compact row each); it stacks when its own box is narrow.
   */
  valuePlacement?: 'between' | 'label';
  value: number; valueText?: string; min: number; max: number; step?: number;
  onValueChange: (value: number) => void; labels: StepLabels; disabled?: boolean; className?: string;
}) {
  const id = useId();
  const labelled = valuePlacement === 'label' && showValue;
  const decrease = <StepButton direction={-1} label={label} value={value} min={min} max={max} step={step} onValueChange={onValueChange} labels={labels} disabled={disabled} />;
  const increase = <StepButton direction={1} label={label} value={value} min={min} max={max} step={step} onValueChange={onValueChange} labels={labels} disabled={disabled} />;
  const written = <output className="lf-stepper-value" aria-live="polite" data-copy-role="data">{valueText ?? value}</output>;
  // A hidden label names the group without a hidden text node (nothing invisible to fit or budget twice).
  const name = labelHidden ? null : <span id={`${id}-label`} className="lf-input-label" data-copy-role="body">{label}</span>;
  const naming = labelHidden ? { 'aria-label': label } : { 'aria-labelledby': `${id}-label` };
  if (labelled) return <div className={`lf-stepper lf-stepper--labelled${className ? ` ${className}` : ''}`} role="group" {...naming}>
    <div className="lf-stepper-layout"><div className="lf-stepper-text">{name}{written}</div><div className="lf-stepper-controls">{decrease}{increase}</div></div>
  </div>;
  return <div className={`lf-stepper${className ? ` ${className}` : ''}`} role="group" {...naming}>
    {name}
    <div className="lf-stepper-controls">{decrease}{showValue ? written : null}{increase}</div>
  </div>;
}
