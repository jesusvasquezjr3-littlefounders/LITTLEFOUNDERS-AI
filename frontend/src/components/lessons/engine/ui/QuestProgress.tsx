/**
 * Playful DS v2 — QuestProgress (lesson top bar).
 * Close button, springy gold progress track, coin purse, and hearts.
 */
import { motion } from "framer-motion";
import { X, Heart, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { spring } from "./motion";

interface QuestProgressProps {
  value: number; // 0..1
  coins: number;
  hearts: number;
  maxHearts?: number;
  onClose?: () => void;
}

export function QuestProgress({ value, coins, hearts, maxHearts = 3, onClose }: QuestProgressProps) {
  return (
    <div className="w-full flex items-center gap-3 px-4 pt-4 pb-1 max-w-2xl mx-auto">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="lp-token shrink-0 w-10 h-10 flex items-center justify-center"
        style={{ color: "var(--lp-muted)" }}
      >
        <X className="w-5 h-5" strokeWidth={2.5} />
      </button>

      <div className="lp-track flex-1 h-3.5">
        <motion.div
          className="lp-track-fill h-full"
          initial={false}
          animate={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
          transition={spring}
        />
      </div>

      <motion.div
        key={coins}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.18, 1] }}
        transition={{ duration: 0.35 }}
        className="bg-white rounded-full shadow-sm shrink-0 h-10 px-3 flex items-center gap-1.5"
        style={{ color: "var(--lp-amber-ink)" }}
      >
        <Coins className="w-4.5 h-4.5" style={{ color: "var(--lp-amber)" }} />
        <span className="text-sm tabular-nums">{coins}</span>
      </motion.div>

      <div className="bg-white rounded-full shadow-sm shrink-0 h-10 px-3 flex items-center gap-1" style={{ color: "var(--lp-coral-ink)" }}>
        {Array.from({ length: maxHearts }).map((_, i) => (
          <Heart
            key={i}
            className={cn("w-4.5 h-4.5 transition-colors")}
            style={{
              color: i < hearts ? "var(--lp-coral)" : "transparent",
              fill: i < hearts ? "var(--lp-coral)" : "transparent",
              stroke: i < hearts ? "var(--lp-coral)" : "var(--lp-muted)",
            }}
            strokeWidth={2.5}
          />
        ))}
      </div>
    </div>
  );
}
