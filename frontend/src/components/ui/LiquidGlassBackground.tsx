import { motion } from "framer-motion";
import { liquidGlow, liquidGlowSlow } from "@/lib/animations";

export function LiquidGlassBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      <motion.div
        variants={liquidGlow}
        animate="animate"
        className="absolute -top-[10%] -right-[5%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(236,72,153,0.12) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <motion.div
        variants={liquidGlowSlow}
        animate="animate"
        className="absolute -bottom-[5%] -left-[10%] w-[45vw] h-[45vw] max-w-[600px] max-h-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(16,185,129,0.06) 40%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <motion.div
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -30, 40, 0],
          scale: [1, 1.05, 0.97, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[40%] right-[10%] w-[30vw] h-[30vw] max-w-[400px] max-h-[400px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(251,146,60,0.08) 0%, rgba(236,72,153,0.05) 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
    </div>
  );
}
