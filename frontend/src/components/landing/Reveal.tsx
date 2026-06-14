import React from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

type RevealVariant = "up" | "left" | "right" | "scale";

interface RevealProps {
  children: React.ReactNode;
  /** Direction the element animates in from. Default: "up". */
  variant?: RevealVariant;
  /** Stagger delay in ms. */
  delay?: number;
  className?: string;
  /** Render as a different element (e.g. "li", "section"). Default: "div". */
  as?: keyof JSX.IntrinsicElements;
  once?: boolean;
}

const variantClass: Record<RevealVariant, string> = {
  up: "",
  left: "reveal-left",
  right: "reveal-right",
  scale: "reveal-scale",
};

/**
 * Reveal — declarative scroll-in wrapper for the corporate landing pages.
 * Wraps children in a `.reveal` element observed by IntersectionObserver.
 */
export const Reveal: React.FC<RevealProps> = ({
  children,
  variant = "up",
  delay = 0,
  className = "",
  as = "div",
  once = true,
}) => {
  const ref = useScrollReveal<HTMLElement>({ once });
  const Tag = as as React.ElementType;

  return (
    <Tag
      ref={ref}
      className={`reveal ${variantClass[variant]} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
