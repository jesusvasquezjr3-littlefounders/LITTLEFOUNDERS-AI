/*
 * The motion every page shares, so a repeated gesture is identical everywhere. Motion
 * (`motion/react`) plays them; `MotionConfig reducedMotion="user"` in App.tsx removes the
 * movement and keeps the fade for visitors who ask for less.
 *
 *  - `reveal`   a block that rises into place once, the first time it is mostly on screen.
 *               Spread it on a `motion.*` element; add `transition={{ ...reveal.transition, delay }}`
 *               to stagger siblings.
 *  - `ENTER`    the easing of everything that arrives.
 */

export const ENTER = [0.16, 1, 0.3, 1] as const;

export const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: ENTER },
} as const;

/** Delay between siblings of a staggered reveal, in seconds. */
export const STAGGER = 0.08;
