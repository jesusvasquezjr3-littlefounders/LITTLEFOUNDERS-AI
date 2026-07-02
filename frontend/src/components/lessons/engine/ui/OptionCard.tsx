/**
 * Playful DS v2 — OptionCard.
 * A tactile "token" answer option: chunky, colored index coin, springy press,
 * warm correct/wrong states. Shared by multiple-choice, true/false, etc.
 */
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type OptionState = "idle" | "selected" | "correct" | "wrong" | "dimmed";

const HUES = ["indigo", "amber", "emerald", "coral"] as const;

interface OptionCardProps {
  index: number;
  text: string;
  state: OptionState;
  onClick: () => void;
  disabled?: boolean;
  /** Show the A/B/C/D index coin (true for MC, false for true/false). */
  showLetter?: boolean;
}

export function OptionCard({ index, text, state, onClick, disabled, showLetter = true }: OptionCardProps) {
  const hue = HUES[index % HUES.length];
  const letter = String.fromCharCode(65 + index);
  const locked = disabled || state === "correct" || state === "wrong" || state === "dimmed";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="radio"
      aria-checked={state === "selected" || state === "correct"}
      aria-label={text}
      whileTap={locked ? undefined : { scale: 0.97 }}
      style={{ animationDelay: `${0.04 + index * 0.06}s` }}
      className={cn(
        "lp-token lp-option text-left w-full px-4 py-4 flex items-center gap-3.5",
        "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
        `lp-option--${hue}`,
        locked && "lp-token--locked",
        state === "selected" && "is-selected",
        state === "correct" && "is-correct",
        state === "wrong" && "is-wrong",
        state === "dimmed" && "is-dimmed",
      )}
    >
      {showLetter && (
        <span className="lp-badge shrink-0 w-9 h-9 flex items-center justify-center text-base">
          {state === "correct" ? <Check className="w-5 h-5" strokeWidth={3.5} />
            : state === "wrong" ? <X className="w-5 h-5" strokeWidth={3.5} />
            : letter}
        </span>
      )}
      <span className="lp-display text-[1.05rem] leading-snug" style={{ color: "var(--lp-ink)" }}>
        {text}
      </span>
      {!showLetter && (state === "correct" || state === "wrong") && (
        <span className="ml-auto shrink-0" style={{ color: state === "correct" ? "var(--lp-emerald)" : "var(--lp-coral)" }}>
          {state === "correct" ? <Check className="w-6 h-6" strokeWidth={3.5} /> : <X className="w-6 h-6" strokeWidth={3.5} />}
        </span>
      )}
    </motion.button>
  );
}
