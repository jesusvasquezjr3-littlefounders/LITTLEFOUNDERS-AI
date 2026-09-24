import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import type { CopyRole } from './copyBudget';

export function Copy({ role, children, as: Tag = 'p' }: { role: CopyRole; children: ReactNode; as?: 'p' | 'span' | 'h1' | 'h2' }) {
  return <Tag data-copy-role={role}>{children}</Tag>;
}

export function Button({ children, variant = 'secondary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'accent' | 'secondary' | 'success' }) {
  return <button {...props} type={props.type ?? 'button'} className={`lf-button lf-button--${variant}`} data-copy-role="action">{children}</button>;
}

export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return <div className="lf-field">
    <label htmlFor={id} data-copy-role="body">{label}</label>
    <input {...props} id={id} aria-describedby={hint ? `${id}-hint` : undefined} />
    {hint ? <p id={`${id}-hint`} data-copy-role="body">{hint}</p> : null}
  </div>;
}

/** In-house system glyphs, class A. No identity or character pictograms. */
export function StatusMark({ correct }: { correct: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="lf-system-glyph" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={correct ? 'M5 12l4 4L19 6' : 'M6 6l12 12M18 6L6 18'} />
  </svg>;
}
