import { type Variants } from "framer-motion";

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export const fadeInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export const fadeInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const pageTransition: Variants = {
  initial: {
    opacity: 0,
    y: 12,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    transition: {
      duration: 0.25,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export const liquidGlow: Variants = {
  animate: {
    x: [0, 30, -20, 0],
    y: [0, -40, 20, 0],
    scale: [1, 1.08, 0.95, 1],
    transition: {
      duration: 12,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const liquidGlowSlow: Variants = {
  animate: {
    x: [0, -25, 35, 0],
    y: [0, 30, -20, 0],
    scale: [1, 0.95, 1.06, 1],
    transition: {
      duration: 16,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

export const cardHover = {
  rest: {
    y: 0,
    boxShadow: "0 4px 12px 0 hsl(var(--background) / 0.1)",
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
  hover: {
    y: -4,
    boxShadow: "0 12px 40px 0 hsl(var(--background) / 0.25)",
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
};
