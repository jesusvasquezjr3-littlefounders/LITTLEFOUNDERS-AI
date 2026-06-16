/**
 * StreakCelebration — Cinematic full-screen immersive streak celebration
 *
 * Duolingo-level production quality with:
 * - Full-screen immersive experience (not a modal)
 * - Cinematic background with animated gradients and light rays
 * - Massive flame animation with glow effects
 * - Huge animated streak number with shadow/blur
 * - Per-character kinetic typography
 * - Particle rain (confetti, embers, sparkles) everywhere
 * - Screen shake effect on entry
 * - Complex animation timeline with staggered effects
 * - Multiple sound layers
 * - Pulsing ring expansion from center
 * - Light effects and corona glows
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useSound } from "@/contexts/SoundContext";
import confetti from "canvas-confetti";

// ─── Constants ───────────────────────────────────────────────────────────────

const FLAME_URL =
  "https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie";

const FIRE_COLORS = [
  "#FF1744", // vibrant red
  "#FF5100", // violet-red
  "#FF6D00", // orange
  "#FFB300", // amber
  "#FFF176", // light yellow
  "#FFFFFF", // white
];

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StreakCelebrationProps {
  isVisible: boolean;
  streakCount: number;
  xpGained?: number;
  message?: string;
  onComplete: () => void;
}

// ─── Helper: Screen shake effect ──────────────────────────────────────────────

function useScreenShake() {
  const shakeRef = useRef<HTMLDivElement>(null);

  const trigger = useCallback(() => {
    if (!shakeRef.current) return;
    shakeRef.current.style.animation = "none";
    // Trigger reflow to restart animation
    void shakeRef.current.offsetHeight;
    shakeRef.current.style.animation = "streak-shake 0.6s cubic-bezier(0.36,0,0.66,1)";
  }, []);

  return { shakeRef, trigger };
}

// ─── Animated gradient background ─────────────────────────────────────────────

function CinematicBackground({ isVisible }: { isVisible: boolean }) {
  return (
    <>
      {/* Main animated background */}
      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-1000 ease-out bg-[length:200%_200%] ${
          isVisible
            ? "bg-gradient-to-br from-amber-50/80 via-white to-orange-50/80 dark:from-[#0a0a0a] dark:via-[#0d0905] dark:to-[#1a0d0a] animate-streak-bg"
            : "bg-white dark:bg-[#0a0a0a]"
        }`}
      />

      {/* Dot-grid overlay — characteristic map-paper texture */}
      {isVisible && (
        <div className="absolute inset-0 corp-grid-bg pointer-events-none opacity-20 dark:opacity-10 z-0" />
      )}

      {/* Animated orbs in background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden saturate-[120%] dark:saturate-[150%]">
        {/* Orb 1 - fiery glow */}
        <div
          className="absolute w-96 h-96 rounded-full blur-[120px] pointer-events-none from-amber-400/40 dark:from-[rgba(255,107,53,0.45)]"
          style={{
            background: "radial-gradient(circle, var(--tw-gradient-from) 0%, transparent 70%)",
            top: "-10%",
            right: "-5%",
            animation: isVisible ? "streak-orb-float-1 6s ease-in-out infinite" : "none",
          }}
        />

        {/* Orb 2 - amber glow */}
        <div
          className="absolute w-80 h-80 rounded-full blur-[100px] pointer-events-none from-orange-400/35 dark:from-[rgba(255,179,0,0.35)]"
          style={{
            background: "radial-gradient(circle, var(--tw-gradient-from) 0%, transparent 70%)",
            bottom: "-8%",
            left: "10%",
            animation: isVisible ? "streak-orb-float-2 7s ease-in-out infinite" : "none",
          }}
        />

        {/* Orb 3 - center subtle */}
        <div
          className="absolute w-72 h-72 rounded-full blur-[90px] pointer-events-none from-purple-400/20 dark:from-[rgba(139,69,255,0.3)]"
          style={{
            background: "radial-gradient(circle, var(--tw-gradient-from) 0%, transparent 70%)",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            animation: isVisible ? "streak-orb-float-3 8s ease-in-out infinite" : "none",
          }}
        />
        
        {/* Orb 4 - Liquid glass highlight */}
        <div
          className="absolute w-80 h-80 rounded-full blur-[80px] pointer-events-none mix-blend-overlay from-white/40 dark:from-[rgba(255,255,255,0.15)]"
          style={{
            background: "radial-gradient(circle, var(--tw-gradient-from) 0%, transparent 60%)",
            bottom: "20%",
            right: "20%",
            animation: isVisible ? "streak-orb-float-1 7s ease-in-out infinite reverse" : "none",
          }}
        />
      </div>

      {/* Light rays / crepuscular effect */}
      <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-30">
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <filter id="streak-glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Light rays from center */}
          {isVisible &&
            [0, 1, 2, 3, 4].map((i) => {
              const angle = (i * 72) * (Math.PI / 180);
              const x2 = Math.cos(angle) * 100;
              const y2 = Math.sin(angle) * 100;
              return (
                <line
                  key={`ray-${i}`}
                  x1="50%"
                  y1="50%"
                  x2={`calc(50% + ${x2}%)`}
                  y2={`calc(50% + ${y2}%)`}
                  stroke="rgba(255,140,0,0.3)"
                  strokeWidth="2"
                  filter="url(#streak-glow)"
                  style={{
                    animation: `streak-ray-pulse 2s ease-in-out infinite`,
                    animationDelay: `${i * 0.4}s`,
                  }}
                />
              );
            })}
        </svg>
      </div>
    </>
  );
}

// ─── Character-by-character animated text ────────────────────────────────────

function AnimatedText({
  text,
  delay,
  className,
  style,
}: {
  text: string;
  delay: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={className} style={style}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            animation: `streak-char-in 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay + i * 0.08}s both`,
            transformOrigin: "center bottom",
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StreakCelebration({
  isVisible,
  streakCount,
  xpGained,
  message,
  onComplete,
}: StreakCelebrationProps) {
  const { t } = useTranslation("dashboard");
  const { playSound } = useSound();

  const [phase, setPhase] = useState<"entering" | "visible" | "exiting">(
    "entering"
  );
  const [displayCount, setDisplayCount] = useState(0);
  const [pulseRing, setPulseRing] = useState(false);
  const [isIgnited, setIsIgnited] = useState(false);

  const dismissedRef = useRef(false);
  const { shakeRef, trigger: triggerShake } = useScreenShake();

  // ── Cleanup timers ─────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    // Timers are auto-cleaned in useEffect returns
  }, []);

  // ── Dismiss handler ────────────────────────────────────────────────────
  const handleDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    clearTimers();
    setPhase("exiting");
    setTimeout(onComplete, 400);
  }, [clearTimers, onComplete]);

  // ── Entry lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) {
      dismissedRef.current = false;
      setPhase("entering");
      setDisplayCount(0);
      setPulseRing(false);
      return;
    }

    dismissedRef.current = false;
    setPhase("entering");
    setDisplayCount(Math.max(0, streakCount - 1));
    setIsIgnited(false);

    // (Sounds and aggressive shakes have been removed from the entrance)

    // === CONFETTI SEQUENCE ===
    // Wave 1: Explodes synchronously with ignition
    setTimeout(() => {
      if (dismissedRef.current) return;
      confetti({
        particleCount: 100, 
        spread: 120,
        origin: { y: 0.4 },
        colors: FIRE_COLORS,
        startVelocity: 60, // Snappy but magical
        ticks: 300,
        gravity: 0.6,
        shapes: ["circle", "square"],
        scalar: 1.2,
      });
    }, 1050); // 50ms after ignition

    // Wave 2 & 3: Wide cannons
    setTimeout(() => {
      if (dismissedRef.current) return;
      confetti({
        particleCount: 60,
        angle: 55,
        spread: 60,
        origin: { x: -0.1, y: 0.7 },
        colors: FIRE_COLORS,
        startVelocity: 50,
        ticks: 350,
        gravity: 0.7,
      });
      confetti({
        particleCount: 60,
        angle: 125,
        spread: 60,
        origin: { x: 1.1, y: 0.7 },
        colors: FIRE_COLORS,
        startVelocity: 50,
        ticks: 350,
        gravity: 0.7,
      });
    }, 1250);

    // Wave 4: Gentle top rain
    setTimeout(() => {
      if (dismissedRef.current) return;
      confetti({
        particleCount: 40,
        spread: 120,
        origin: { y: -0.1 },
        colors: FIRE_COLORS,
        startVelocity: 20,
        ticks: 250,
        gravity: 0.8,
        decay: 0.95,
      });
    }, 1600);

    // === ANIMATION TIMELINE ===
    // Transition entering → visible
    const enterTimeout = setTimeout(() => setPhase("visible"), 600);

    // === COUNT-UP / IGNITION ANIMATION ===
    // Timeline: 
    // 0.0s: Screen fades in softly. Flame is visible but gray/muted.
    // 1.0s: IGNITION! The flame elegantly transitions to color.
    let countInterval: ReturnType<typeof setInterval>;
    const ignitionTimer = setTimeout(() => {
      if (dismissedRef.current) return;
      
      setIsIgnited(true);
      setPulseRing(true);
      triggerShake(); // Very subtle pop and shake here
      
      // Play the accomplishment sounds exactly when color blooms
      playSound("edu_complete");
      setTimeout(() => {
        playSound("ui_tap");
        
        // Start counting exactly after the sound pops
        let current = Math.max(0, streakCount - 1);
        const totalDiff = streakCount - current;
        
        if (totalDiff > 0) {
          const stepSize = Math.max(1, Math.ceil(totalDiff / 10));
          const tickMs = Math.max(40, Math.floor(400 / (totalDiff / stepSize))); // Snappy count
          
          countInterval = setInterval(() => {
            current = Math.min(current + stepSize, streakCount);
            setDisplayCount(current);
            if (current >= streakCount) clearInterval(countInterval);
          }, tickMs);
        }
      }, 100);
      
    }, 1000);

    // === CONTINUOUS EMBERS (Liquid Fire Effect) ===
    let embersInterval: ReturnType<typeof setInterval>;
    setTimeout(() => {
      if (dismissedRef.current) return;
      embersInterval = setInterval(() => {
        if (dismissedRef.current) return;
        confetti({
          particleCount: 2 + Math.floor(Math.random() * 2),
          angle: 90,
          spread: 60,
          origin: { x: Math.random() * 0.8 + 0.1, y: 1.1 }, // from bottom
          colors: ['#FF1744', '#FFB300', '#FF6D00', '#FFFFFF', '#FFD060'],
          startVelocity: Math.random() * 20 + 15,
          gravity: -0.3, // floats upwards
          ticks: 400,
          scalar: Math.random() * 0.5 + 0.3, // Slightly smaller
          shapes: ["circle"],
          disableForReducedMotion: true,
          zIndex: 9998
        });
      }, 400); 
    }, 1800);

    return () => {
      clearTimeout(enterTimeout);
      clearTimeout(ignitionTimer);
      clearInterval(countInterval);
      clearInterval(embersInterval);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  if (!isVisible) return null;

  // Use a very robust and generic fallback so we ALWAYS have a title string
  const title = message || t("celebration.title", { ns: "onboarding", defaultValue: "¡Celebración!" });

  // ── Render: full-screen immersive experience ────────────────────────────
  return createPortal(
    <div
      ref={shakeRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "rgba(0,0,0,0)",
      }}
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* ── Background layers ────────────────────────────────────────────── */}
      {/* ── Overlay click handler (transparent) ───────────────────────────── */}
      <div
        className="absolute inset-0 z-0"
        onClick={handleDismiss}
        style={{ cursor: "pointer" }}
      />

      {/* ── Background layers ────────────────────────────────────────────── */}
      <CinematicBackground isVisible={phase !== "exiting"} />

      {/* ── Pulsing ring from center ──────────────────────────────────────── */}
      {pulseRing && (
        <>
          <div
            className="absolute w-96 h-96 rounded-full pointer-events-none z-0"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              border: "2px solid rgba(255,107,53,0.4)",
              animation: "streak-ring-pulse 1.2s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          />
          <div
            className="absolute w-80 h-80 rounded-full pointer-events-none z-0"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              border: "1px solid rgba(255,179,0,0.2)",
              animation: "streak-ring-pulse 1.2s cubic-bezier(0.34,1.56,0.64,1) 0.15s",
            }}
          />
        </>
      )}

      {/* ── Main content: centered composition ────────────────────────────── */}
      <div
        className={`relative z-10 w-full h-[100dvh] flex flex-col items-center justify-between px-4 pb-12 pt-16 pointer-events-none max-w-md mx-auto`}
        style={{
          animation:
            phase === "exiting"
              ? "streak-zoom-out 0.4s ease-in forwards"
              : "streak-zoom-in 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.2s both",
        }}
      >
        <div className="flex flex-col items-center justify-center flex-1 w-full mt-4">

          {/* ── Micro-stars (appear on ignition) ─────────────────────────── */}
          {isIgnited && (
            <>
              <div
                className="absolute top-[18%] left-[12%] lp-star-pop pointer-events-none"
                style={{ animationDelay: "0.05s" }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#FFD060" opacity="0.8">
                  <path d="M10 1l2.4 6.6H19l-5.4 3.9 2 6.6L10 14 4.4 18.1l2-6.6L1 7.6h6.6z" />
                </svg>
              </div>
              <div
                className="absolute top-[14%] right-[10%] lp-star-pop pointer-events-none"
                style={{ animationDelay: "0.2s" }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="#FF8C00" opacity="0.7">
                  <path d="M10 1l2.4 6.6H19l-5.4 3.9 2 6.6L10 14 4.4 18.1l2-6.6L1 7.6h6.6z" />
                </svg>
              </div>
              <div
                className="absolute top-[35%] right-[6%] lp-star-pop pointer-events-none"
                style={{ animationDelay: "0.35s" }}
              >
                <svg width="10" height="10" viewBox="0 0 20 20" fill="#FFEB3B" opacity="0.6">
                  <path d="M10 1l2.4 6.6H19l-5.4 3.9 2 6.6L10 14 4.4 18.1l2-6.6L1 7.6h6.6z" />
                </svg>
              </div>
              <div
                className="absolute top-[40%] left-[7%] lp-star-pop pointer-events-none"
                style={{ animationDelay: "0.5s" }}
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="#FFD060" opacity="0.65">
                  <path d="M10 1l2.4 6.6H19l-5.4 3.9 2 6.6L10 14 4.4 18.1l2-6.6L1 7.6h6.6z" />
                </svg>
              </div>
            </>
          )}

          {/* ── Title ────────────────────────────────────────────────────── */}
          <div
            className={`text-center mb-0 mt-4 transition-all duration-700 delay-100 ${isIgnited ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-8"}`}
          >
            <h1
              className="bg-clip-text text-transparent drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]"
              style={{
                fontSize: "clamp(28px, 8vw, 42px)",
                fontWeight: 900,
                letterSpacing: "0.05em",
                backgroundImage: "linear-gradient(135deg, #FFB300 0%, #FF6B35 50%, #FF1744 100%)",
                textTransform: "uppercase",
                lineHeight: 1.1
              }}
            >
              {title}
            </h1>
          </div>

          {/* ── Flame + Number Composite ──────────────────────────────────────── */}
          <div className="relative flex items-center justify-center w-[280px] h-[300px] mb-2 scale-90 sm:scale-100">
            {/* Outer glow corona */}
            <div
              className="absolute pointer-events-none"
              style={{
                width: "360px",
                height: "360px",
                borderRadius: "50%",
                background: isIgnited 
                  ? "radial-gradient(circle, rgba(255,107,53,0.55) 0%, transparent 60%)"
                  : "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%)",
                filter: "blur(60px)",
                animation: "streak-glow-pulse 3s ease-in-out infinite",
                transition: "background 1.5s ease-out",
              }}
            />

            {/* Middle glow ring */}
            <div
              className="absolute pointer-events-none"
              style={{
                width: "280px",
                height: "280px",
                borderRadius: "50%",
                background: isIgnited
                  ? "radial-gradient(circle, rgba(255,179,0,0.35) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
                filter: "blur(40px)",
                animation: "streak-glow-pulse 3s ease-in-out infinite 0.3s",
                transition: "background 1.5s ease-out",
              }}
            />

            {/* Flame animation (behind number) */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                filter: isIgnited ? "grayscale(0) brightness(1)" : "grayscale(1) brightness(0.4)",
                opacity: isIgnited ? 1 : 0.4,
                transform: isIgnited ? "scale(1)" : "scale(0.85) translateY(0)",
                transition: "all 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)", 
              }}
            >
              {/* @ts-ignore */}
              <dotlottie-wc
                src={FLAME_URL}
                autoplay
                loop
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            {/* Streak Number (on top of flame) */}
            <div
              className="relative z-10 flex items-center justify-center mt-12 pointer-events-none"
            >
              {/* Shadow layer */}
              <div
                className="bg-clip-text text-transparent"
                style={{
                  position: "absolute",
                  fontSize: "clamp(100px, 25vw, 140px)",
                  fontWeight: 900,
                  lineHeight: 1,
                  backgroundImage: isIgnited 
                    ? "linear-gradient(135deg, #FFD060 0%, #FF8C00 100%)"
                    : "linear-gradient(135deg, #a1a1aa 0%, #71717a 100%)",
                  filter: isIgnited ? "blur(14px)" : "blur(6px)",
                  opacity: isIgnited ? 0.6 : 0.15,
                  transform: "translate(0, 8px)",
                  transition: "all 1.5s ease-out",
                }}
              >
                {displayCount}
              </div>
              {/* Main number layer */}
              <div
                className="bg-clip-text text-transparent"
                style={{
                  fontSize: "clamp(100px, 25vw, 140px)",
                  fontWeight: 900,
                  lineHeight: 1,
                  backgroundImage: isIgnited
                    ? "linear-gradient(145deg, #FFEB3B 0%, #FFC107 25%, #FF8C00 60%, #FF4500 100%)"
                    : "linear-gradient(145deg, #e4e4e7 0%, #a1a1aa 50%, #71717a 100%)",
                  filter: isIgnited ? "drop-shadow(0 0 25px rgba(255,107,53,0.6))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                  position: "relative",
                  textAlign: "center",
                  transform: isIgnited ? "scale(1.15)" : "scale(0.95)",
                  transition: "all 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              >
                {displayCount}
              </div>
            </div>
          </div>

          {/* ── Subtitle ────────────────────────────────────── */}
          <p
            className={`text-base font-bold text-gray-800/80 dark:text-white/70 mb-4 text-center mt-4 tracking-wider uppercase transition-opacity duration-700 delay-300 ${isIgnited ? "opacity-100" : "opacity-0"}`}
          >
            {t("streak_celebration.days", { count: displayCount, defaultValue: `${displayCount} DÍAS DE RACHA` })}
          </p>

          {/* ── XP badge ─────────────────────────────────────────────────────── */}
          <div
            className={`transition-all duration-500 delay-500 ${isIgnited ? "opacity-100 scale-100" : "opacity-0 scale-90 translate-y-4"}`}
          >
            {xpGained && xpGained > 0 && (
              <div
                className="inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full border pointer-events-none bg-violet-500/10 dark:bg-[rgba(255,179,0,0.12)] border-violet-500/20 dark:border-[rgba(255,179,0,0.35)] shadow-[0_0_30px_rgba(255,140,0,0.15)] dark:shadow-[0_0_30px_rgba(255,179,0,0.15)]"
              >
                {/* @ts-ignore */}
                <dotlottie-wc
                  src="https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie"
                  autoplay
                  loop
                  style={{ width: 24, height: 24 }}
                />
                <span
                  className="font-black text-base"
                  style={{
                  background: "linear-gradient(135deg, #FFD060 0%, #FF8C00 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                +{xpGained} XP
              </span>
            </div>
          )}
          </div>
        </div>

        {/* ── Continue button ──────────────────────────────────────────────── */}
        <div className="lp w-full mt-auto pt-4" style={{ pointerEvents: "auto" }}>
          <div
            className={`w-full transition-all duration-500 delay-500 ${isIgnited ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-8"}`}
          >
            <button
              onClick={handleDismiss}
              className="lp-cta lp-cta--go w-full py-5 rounded-3xl text-lg lp-display relative overflow-hidden"
            >
              {/* Shine/shimmer overlay */}
              <span
                className="absolute inset-0 rounded-3xl pointer-events-none"
                style={{
                  background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.30) 50%, transparent 70%)",
                  animation: "streak-shine 4s ease-in-out infinite 1.6s",
                }}
              />
              <span className="relative drop-shadow-sm">{t("streak_celebration.continue")}</span>
            </button>
          </div>
        </div>
      </div>

    </div>,
    document.body
  );
}
