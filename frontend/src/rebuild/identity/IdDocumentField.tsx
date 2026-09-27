import { useId } from 'react';
import { Glyph } from '../design/controls';

/*
 * The photo of a parent's ID for A.5 verification (A7, W2S.2): the one file
 * input of the rebuilt frontend, and deliberately NOT a shared design-system
 * control. An upload is a governed surface (docs/rebuild/policies/
 * SOCIAL-GOVERNANCE.md §4.2, E.12): this file is listed there, and a generic
 * file control any screen could import would put a profile image one import
 * away from the child-safety review it needs.
 *
 * The native input keeps the keyboard (Tab to it, Enter or Space opens the
 * platform's picker) and the screen-reader behaviour, visually hidden (a file
 * input's own text is the browser's, clipped with an ellipsis, 02 §7 rule 1).
 * The well around it is its <label>, so a press anywhere on it (at least
 * 64 px) opens the picker, and it takes a dropped file. The input is named by
 * the visible field label; the well's action word and the chosen file's name
 * are what a sighted person reads (the input announces its own file).
 */
export function IdDocumentField({ label, help, error, accept, file, onFileChange, chooseLabel, replaceLabel, disabled }: {
  label: string; help?: string; error?: string; accept: string; file: { name: string } | null;
  onFileChange: (file: File | null) => void; chooseLabel: string; replaceLabel: string; disabled?: boolean;
}) {
  const id = useId();
  const labelId = `${id}-label`, helpId = `${id}-help`, errorId = `${id}-error`;
  const describedBy = [help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
  return <div className="lf-input-field">
    <span id={labelId} className="lf-input-label" data-copy-role="body">{label}</span>
    {help ? <p id={helpId} className="lf-input-help" data-copy-role="body">{help}</p> : null}
    <label htmlFor={id} className="lf-id-document-drop" data-chosen={file ? 'true' : undefined}
      onDragOver={(event) => { if (!disabled) event.preventDefault(); }}
      onDrop={(event) => { if (disabled) return; event.preventDefault(); onFileChange(event.dataTransfer.files?.[0] ?? null); }}>
      <input id={id} type="file" className="lf-id-document-input lf-visually-hidden" accept={accept} disabled={disabled} aria-labelledby={labelId}
        aria-invalid={error ? true : undefined} aria-describedby={describedBy} onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
      <span className="lf-id-document-action" data-copy-role="action" aria-hidden="true">{file ? replaceLabel : chooseLabel}</span>
      {file ? <span className="lf-id-document-name ugc" data-copy-role="data" aria-hidden="true">{file.name}</span> : null}
    </label>
    {error ? <p id={errorId} className="lf-input-error" data-copy-role="body"><Glyph name="warning" /><span>{error}</span></p> : null}
  </div>;
}
