"use client";
import * as React from "react";
import { motion } from "motion/react";
import { Icon, type IconProps } from "@/components/ui/icon";
import { useChoreography } from "@/lib/cojeev-motion/choreography";

export type IconMotion = "auto" | "tremor" | "draw" | "spin" | "bounce" | "validation" | "pulse" | "none";
export type IconMotionEase="gentle"|"settle"|"linear"|readonly [number,number,number,number];
export type AnimatedIconProps = IconProps & { preset?:IconMotion; active?:boolean; amplitude?:number; duration?:number; ease?:IconMotionEase };
/*
 * The library animated its own line icons here. Our icons carry their own movements (components/AppIcon.tsx), so
 * this only draws the icon; the motion props are accepted so the library's components keep compiling.
 */
export function AnimatedIcon({name,size="default",className}:AnimatedIconProps) {
  return <span data-slot="animated-icon" className="v-animated-icon"><span><Icon name={name} size={size} className={className} /></span></span>;
}


export type StateChevronProps = Omit<React.ComponentProps<"span">,"children"> & {
  /** Omit to follow the closest native trigger's data-state/aria-expanded. */
  open?: boolean;
  direction?: "down" | "right";
};
/** One real state cue; quiet motion still updates the direction immediately. */
export function StateChevron({ open, direction="down", className, ref, ...props }: StateChevronProps) {
  const host = React.useRef<HTMLSpanElement | null>(null);
  const [nativeOpen, setNativeOpen] = React.useState(false);
  const { quiet, transition } = useChoreography();
  const attach = React.useCallback((node: HTMLSpanElement | null) => {
    host.current = node;
    if (typeof ref === "function") return ref(node);
    if (ref) ref.current = node;
  }, [ref]);
  React.useEffect(() => {
    if (open !== undefined) return;
    const trigger = host.current?.parentElement?.closest("[aria-expanded],[data-state]");
    if (!trigger) return;
    const sync = () => setNativeOpen(trigger.getAttribute("aria-expanded") === "true" || trigger.getAttribute("data-state") === "open");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(trigger, { attributes:true, attributeFilter:["data-state","aria-expanded"] });
    return () => observer.disconnect();
  }, [open]);
  const expanded = open ?? nativeOpen;
  return <span {...props} ref={attach} data-slot="state-chevron" data-open={expanded} aria-hidden="true" className={["v-state-chevron",className].filter(Boolean).join(" ")}>
    <motion.span initial={false} animate={{rotate:expanded?(direction==="right"?90:180):0}} transition={quiet?{duration:0}:transition}><Icon name={direction==="right"?"chevron-right":"chevron-down"} size="sm" /></motion.span>
  </span>;
}
