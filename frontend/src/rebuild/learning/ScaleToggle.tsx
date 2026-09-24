export type ScaleOption = { value: number; label: string };

/** A compact, keyboard-accessible scale switch for one continuous model. */
export function ScaleToggle({ label, options, value, onValueChange }: {
  label: string;
  options: readonly ScaleOption[];
  value: number;
  onValueChange: (value: number) => void;
}) {
  return <div className="lf-scale-toggle" role="group" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" data-copy-role="action"
      aria-pressed={option.value === value} onClick={() => onValueChange(option.value)}>{option.label}</button>)}
  </div>;
}
