import { forwardRef, type AnimationEvent, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { Glyph, type GlyphName } from './glyphs';
import { useIdleMotion, useOneShot, withPressFeedback } from './motion';

/**
 * Button colour roles are a taught convention:
 * accent is the one call to action per view, brand navigates, success confirms,
 * reward claims coins or XP, sky helps, mint saves, berry shares or invites,
 * danger is destructive only (always behind a confirmation), secondary is the
 * neutral surface plus soft shadow, inverse sits on a coloured band or card.
 */
export type ButtonVariant = 'accent' | 'brand' | 'success' | 'reward' | 'sky' | 'mint' | 'berry' | 'danger' | 'secondary' | 'inverse' | 'ghost';
/** Size follows function, never audience: sm = 48, md = 56, lg = 64 px floors. */
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A request this button started is in flight: it stays focusable, refuses a second press and says so. */
  pending?: boolean;
  /** Replaces the label while pending, e.g. "Saving…", with a spinner beside it. The width may grow; text never truncates. */
  pendingLabel?: string;
  /**
   * The one emphasised call to action on the screen breathes: a slow halo in
   * its own colour. Accent only, only while usable, and only one per
   * document: a second breathing button is refused a slot and stays still.
   */
  breathing?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ children, variant = 'secondary', size = 'md', pending = false, pendingLabel, breathing = false, className, onAnimationEnd, onPointerDown, ...props }, ref) {
  const usable = !props.disabled && !pending;
  // Armed: when a disabled or pending button becomes usable it bumps once; never on first render.
  const [armed, settle] = useOneShot(usable ? 'usable' : null);
  const breathes = useIdleMotion('breathing-cta', breathing && variant === 'accent' && usable);
  const classes = ['lf-button', `lf-button--${variant}`];
  if (size !== 'md') classes.push(`lf-button--${size}`);
  if (pending) classes.push('lf-button--pending');
  if (armed) classes.push('lf-button--armed');
  if (breathes) classes.push('lf-button--breathing');
  if (className) classes.push(className);
  const animationEnd = (event: AnimationEvent<HTMLButtonElement>) => {
    // The bump is the only finite animation a button runs (the breathing halo never ends).
    if (event.target === event.currentTarget) settle();
    onAnimationEnd?.(event);
  };
  // The scale press is CSS; the ring from the touch point and the haptic tick are the shared press feedback.
  const motion = { onAnimationEnd: animationEnd, onPointerDown: withPressFeedback(onPointerDown), 'data-idle-motion': breathes ? 'breathing-cta' : undefined };
  if (!pending) return <button {...props} {...motion} ref={ref} type={props.type ?? 'button'} className={classes.join(' ')} data-copy-role="action">{children}</button>;
  return <button {...props} {...motion} ref={ref} type={props.type === 'submit' ? 'button' : props.type ?? 'button'} className={classes.join(' ')} data-copy-role="action"
    aria-busy="true" aria-disabled="true" onClick={(event: MouseEvent<HTMLButtonElement>) => event.preventDefault()}>
    {/* A spinner beside the changed label, busy motion (motion.tsx); still under reduced motion, never the only signal. */}
    <span className="lf-button-spinner" aria-hidden="true" data-busy-motion="spinner" />{pendingLabel ?? children}</button>;
});

export type IconButtonVariant = 'secondary' | 'soft' | 'inverse';

/** One icon action (the circle shape). A glyph never stands alone without an accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  glyph: GlyphName; label: string; variant?: IconButtonVariant;
}>(function IconButton({ glyph, label, variant = 'secondary', className, onPointerDown, ...props }, ref) {
  return <button {...props} onPointerDown={withPressFeedback(onPointerDown)} ref={ref} type={props.type ?? 'button'} className={`lf-icon-button lf-icon-button--${variant}${className ? ` ${className}` : ''}`}
    aria-label={label} title={label} data-copy-role="action"><Glyph name={glyph} /></button>;
});
