/**
 * Playful DS v2 — CoinBurst.
 * Celebratory coin particle burst fired on a correct answer. Re-fires whenever
 * `burstKey` increments. Renders inside a position:relative parent.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Coins } from "lucide-react";

const N = 14;

export function CoinBurst({ burstKey }: { burstKey: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-visible">
      <AnimatePresence>
        {burstKey > 0 && (
          <div key={burstKey} className="relative">
            {Array.from({ length: N }).map((_, i) => {
              const angle = (i / N) * Math.PI * 2;
              const dist = 90 + (i % 4) * 28;
              const x = Math.cos(angle) * dist;
              const y = Math.sin(angle) * dist - 50;
              return (
                <motion.div
                  key={i}
                  className="absolute left-0 top-0"
                  initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
                  animate={{ x, y, scale: [0.4, 1.15, 0.85], opacity: [0, 1, 0], rotate: (i % 2 ? 1 : -1) * 200 }}
                  transition={{ duration: 0.9, ease: "easeOut", times: [0, 0.3, 1] }}
                >
                  <Coins className="w-6 h-6" style={{ color: "var(--lp-amber)" }} />
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
