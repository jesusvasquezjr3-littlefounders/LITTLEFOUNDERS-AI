import { useId, useRef, useState, type ChangeEvent } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

/*
 * /DESIGN.md §Components — FileField: custom image picker (never the native
 * control's look). A dashed drop-well on surface-sunken; once a file is
 * chosen it shows name + size with a clear affordance to replace it.
 * Keyboard/tap accessible via the wrapped native input (sr-only).
 */

interface FileFieldProps {
  label: string;
  help?: string;
  error?: string;
  accept?: string;
  file: File | null;
  onFile(file: File | null): void;
  /** i18n'd action labels */
  chooseLabel: string;
  replaceLabel: string;
  className?: string;
}

export function FileField({
  label,
  help,
  error,
  accept = 'image/jpeg,image/png,image/webp',
  file,
  onFile,
  chooseLabel,
  replaceLabel,
  className,
}: FileFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onFile(e.target.files?.[0] ?? null);
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="lf-label text-content">{label}</span>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors duration-150',
          'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-base',
          error ? 'border-error bg-error-soft/40' : dragOver ? 'border-primary bg-primary-soft/40' : 'border-outline bg-surface-sunken hover:border-primary',
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={handleChange}
          className="sr-only"
        />
        {file ? (
          <>
            <Icon name="task_alt" className="text-success" />
            <span className="lf-body break-all text-content">{file.name}</span>
            <span className="lf-caption text-content-muted">
              {(file.size / 1024 / 1024).toFixed(1)} MB · {replaceLabel}
            </span>
          </>
        ) : (
          <>
            <Icon name="add_a_photo" className="text-content-muted" />
            <span className="lf-label text-primary">{chooseLabel}</span>
          </>
        )}
      </label>
      {error ? (
        <p id={`${id}-error`} role="alert" className="lf-caption text-error-strong">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="lf-caption text-content-muted">
          {help}
        </p>
      ) : null}
    </div>
  );
}
