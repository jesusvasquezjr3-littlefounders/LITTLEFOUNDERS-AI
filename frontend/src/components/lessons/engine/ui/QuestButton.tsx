/**
 * Playful DS v2 — QuestButton.
 * The chunky tactile action button (gold "treasure" by default; emerald on
 * success-continue, coral on retry, indigo for neutral/brand actions).
 */
import { cn } from "@/lib/utils";

type Variant = "gold" | "go" | "retry" | "brand";

interface QuestButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: Variant;
  className?: string;
}

const VARIANT_CLASS: Record<Variant, string> = {
  gold: "",
  go: "lp-cta--go",
  retry: "lp-cta--retry",
  brand: "lp-cta--brand",
};

export function QuestButton({ children, onClick, disabled, variant = "gold", className }: QuestButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "lp-cta w-full h-[3.75rem] px-6 text-lg inline-flex items-center justify-center gap-2 select-none",
        "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both",
        VARIANT_CLASS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
