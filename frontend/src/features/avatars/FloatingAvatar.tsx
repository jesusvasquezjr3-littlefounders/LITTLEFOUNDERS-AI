import { forwardRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Avatar, type AvatarHandle, type AvatarProps } from './Avatar';

/*
 * The avatar as a floating companion: a round-cornered button in a corner of the screen that bobs a little, looks at
 * the pointer, and can hold a speech bubble beside it. It is the shape the product uses for an avatar that follows
 * the visitor through a screen. Reduced motion stops the bobbing (MotionConfig in App.tsx).
 *
 * `bubble` is already-translated text or content; the avatar never carries words of its own. `onActivate` makes it a
 * button (name it with `label`, which is then required for assistive technology).
 */
export interface FloatingAvatarProps extends AvatarProps {
  bubble?: ReactNode;
  onActivate?: () => void;
  /** Pixel height of the avatar. */
  size?: number;
}

export const FloatingAvatar = forwardRef<AvatarHandle, FloatingAvatarProps>(function FloatingAvatar({ bubble, onActivate, size = 132, label, ...avatar }, ref) {
  const body = <Avatar ref={ref} label={onActivate ? undefined : label} {...avatar} className="block h-full w-auto" />;

  return <div className="pointer-events-none fixed bottom-4 end-4 z-20 flex max-w-[calc(100vw-2rem)] items-end gap-3">
    {bubble ? <div role="status" className="pointer-events-auto mb-8 max-w-64 rounded-[var(--r-panel)] border border-[var(--v-border)] bg-[var(--v-paper)] px-4 py-3 text-[length:var(--fs-body)] leading-snug text-[var(--v-text)] shadow-[var(--shadow-float)]">{bubble}</div> : null}
    <motion.div className="pointer-events-auto" style={{ height: size }} animate={{ y: [0, -5, 0] }} transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}>
      {onActivate
        ? <button type="button" aria-label={label} onClick={onActivate} className="block h-full min-h-12 min-w-12 cursor-pointer rounded-[var(--r-panel)] bg-transparent p-0">{body}</button>
        : body}
    </motion.div>
  </div>;
});
