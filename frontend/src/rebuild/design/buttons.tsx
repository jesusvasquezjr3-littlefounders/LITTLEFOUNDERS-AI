import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { Glyph, type GlyphName } from './glyphs';

/**
 * Button colour roles are a taught convention (Frontend Bible 02 §9.5):
 * accent is the one call to action per view, brand navigates, success confirms,
 * reward claims coins or XP, sky helps, mint saves, berry shares or invites,
 * danger is destructive only (always behind a confirmation), secondary is the
 * neutral surface plus soft shadow, inverse sits on a coloured band or card.
 */
export type ButtonVariant = 'accent' | 'brand' | 'success' | 'reward' | 'sky' | 'mint' | 'berry' | 'danger' | 'secondary' | 'inverse';
/** Size follows function, never audience (02 §8): sm = 48, md = 56, lg = 64 px floors. */
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A request this button started is in flight: it stays focusable, refuses a second press and says so. */
  pending?: boolean;
  /** Replaces the label while pending, e.g. "Saving…". The width may grow; text never truncates. */
  pendingLabel?: string;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ children, variant = 'secondary', size = 'md', pending = false, pendingLabel, className, ...props }, ref) {
  const classes = ['lf-button', `lf-button--${variant}`];
  if (size !== 'md') classes.push(`lf-button--${size}`);
  if (pending) classes.push('lf-button--pending');
  if (className) classes.push(className);
  if (!pending) return <button {...props} ref={ref} type={props.type ?? 'button'} className={classes.join(' ')} data-copy-role="action">{children}</button>;
  return <button {...props} ref={ref} type={props.type === 'submit' ? 'button' : props.type ?? 'button'} className={classes.join(' ')} data-copy-role="action"
    aria-busy="true" aria-disabled="true" onClick={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}>{pendingLabel ?? children}</button>;
});

export type IconButtonVariant = 'secondary' | 'soft' | 'inverse';

/** One icon action (the circle shape, 02 §9.5). A glyph never stands alone without an accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  glyph: GlyphName; label: string; variant?: IconButtonVariant;
}>(function IconButton({ glyph, label, variant = 'secondary', className, ...props }, ref) {
  return <button {...props} ref={ref} type={props.type ?? 'button'} className={`lf-icon-button lf-icon-button--${variant}${className ? ` ${className}` : ''}`}
    aria-label={label} title={label} data-copy-role="action"><Glyph name={glyph} /></button>;
});

/** A wrapping row of buttons: they grow to share the line and wrap before any label is squeezed (02 §7 rule 3). */
export function ButtonGroup({ label, children }: { label?: string; children: ReactNode }) {
  return <div className="lf-button-group" role={label ? 'group' : undefined} aria-label={label}>{children}</div>;
}

/**
 * A navigation link that looks like a button (the marketing header's "Log in"
 * and "Start free"). It is a real link: it goes somewhere, it does not act.
 */
export const ButtonLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: ButtonVariant; size?: ButtonSize }>(
  function ButtonLink({ children, variant = 'secondary', size = 'md', className, ...props }, ref) {
    const classes = ['lf-button', `lf-button--${variant}`, 'lf-button-link'];
    if (size !== 'md') classes.push(`lf-button--${size}`);
    if (className) classes.push(className);
    return <a {...props} ref={ref} className={classes.join(' ')} data-copy-role="action">{children}</a>;
  });
