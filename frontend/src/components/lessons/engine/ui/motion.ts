/**
 * Playful DS v2 — motion presets (framer-motion).
 * Spring-physics vocabulary shared by every lesson primitive so the whole
 * engine feels like one tactile, alive world.
 */
import type { Variants, Transition } from "framer-motion";

export const spring: Transition = { type: "spring", stiffness: 520, damping: 30, mass: 0.8 };
export const softSpring: Transition = { type: "spring", stiffness: 240, damping: 22 };
export const popSpring: Transition = { type: "spring", stiffness: 600, damping: 17 };

/** Parent that staggers children reveals. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

/** Child reveal — pops up into place. */
export const popIn: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: popSpring },
};

/** Gentle rise — for headings / panels. */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: softSpring },
};

/** Warm "nope" shake — encouraging, not punishing. */
export const shakeKeyframes = { x: [0, -9, 8, -6, 4, -2, 0] };
export const shakeTransition: Transition = { duration: 0.45 };
