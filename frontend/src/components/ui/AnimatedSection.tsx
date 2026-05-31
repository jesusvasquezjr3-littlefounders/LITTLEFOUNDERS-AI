import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef, type ReactNode, type ElementType } from "react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

type PolymorphicTag = "div" | "section" | "header" | "article";

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: PolymorphicTag;
  once?: boolean;
  id?: string;
}

export function AnimatedSection({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  once = true,
  id,
}: AnimatedSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-80px" });
  const MotionTag = motion(Tag as ElementType);

  return (
    <MotionTag
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={fadeInUp}
      custom={delay}
      className={className}
      id={id}
    >
      {children}
    </MotionTag>
  );
}

interface AnimatedStaggerProps {
  children: ReactNode;
  className?: string;
  as?: PolymorphicTag;
  once?: boolean;
}

export function AnimatedStagger({
  children,
  className,
  as: Tag = "div",
  once = true,
}: AnimatedStaggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: "-60px" });
  const MotionTag = motion(Tag as ElementType);

  return (
    <MotionTag
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

interface AnimatedItemProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedItem({ children, className }: AnimatedItemProps) {
  return (
    <motion.div variants={fadeInUp} className={className}>
      {children}
    </motion.div>
  );
}
