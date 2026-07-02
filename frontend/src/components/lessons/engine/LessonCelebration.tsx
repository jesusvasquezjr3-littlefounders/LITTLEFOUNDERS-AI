import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Clock, ArrowRight, Loader2, Sparkles, Zap, Star, Flame, RotateCcw, LogOut } from "lucide-react";
import { DinoCharacter } from "@/components/characters/DinoCharacter";
import { DinaCharacter } from "@/components/characters/DinaCharacter";
import DrRhoCharacter from "@/components/characters/DrRhoCharacter";
import ZaraVexCharacter from "@/components/characters/ZaraVexCharacter";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

// ─── Character renderer ───────────────────────────────────────────────────────

function CelebrationCharacter({ characterCode }: { characterCode: string }) {
  switch (characterCode) {
    case "dina":    return <DinaCharacter expression="happy" />;
    case "dr_rho":  return <DrRhoCharacter mood="explaining" />;
    case "zara_vex":return <ZaraVexCharacter mood="excited" />;
    case "liruf":
    default:        return <DinoCharacter mood="excited" showBubble={false} />;
  }
}

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration: number = 1200, isVisible: boolean) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible) { setValue(0); return; }
    startTimeRef.current = null;
    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isVisible, target, duration]);

  return value;
}

// ─── Star rating component ────────────────────────────────────────────────────

function StarRating({ accuracy }: { accuracy: number }) {
  const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 50 ? 1 : 0;
  return (
    <div className="flex items-center justify-center gap-2 mb-3">
      {[0, 1, 2].map((i) => {
        const filled = i < stars;
        const delay = `${i * 0.18}s`;
        return (
          <div
            key={i}
            className="lp-star-pop"
            style={{ animationDelay: delay }}
          >
            <Star
              className={cn(
                "w-9 h-9 drop-shadow-lg transition-all",
                filled
                  ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]"
                  : "text-white/15 fill-white/10"
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  delay: string;
  lipColor: string;
  glowColor: string;
  prefix?: string;
}

function StatCard({ icon, value, label, delay, lipColor, glowColor, prefix = "" }: StatCardProps) {
  return (
    <div
      className="lp-stat-pop lp-shimmer-card relative flex flex-col items-center gap-1 rounded-2xl px-3 py-4 flex-1 min-w-0"
      style={{
        animationDelay: delay,
        background: "var(--lp-surface)",
        border: "1.5px solid var(--lp-line)",
        boxShadow: `0 6px 0 ${lipColor}, 0 10px 24px -8px ${glowColor}`,
      }}
    >
      {/* Icon */}
      <div className="mb-1">{icon}</div>
      {/* Value */}
      <span
        className="lp-display text-2xl sm:text-3xl font-black"
        style={{ color: "var(--lp-ink)" }}
      >
        {prefix}{value}
      </span>
      {/* Label */}
      <span
        className="lp-display text-[9px] sm:text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--lp-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LessonCelebrationProps {
  isVisible: boolean;
  completionResult?: {
    points_earned: number;
    xp_earned: number;
    new_streak: number;
    is_fallback?: boolean;
  } | null;
  basePoints: number;
  durationSeconds: number;
  nextLessonCode: string | null | undefined;
  characterCode: string;
  exerciseStats?: { correct: number; total: number } | null;
  onNext: () => void;
  onExit: () => void;
  onRetry: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LessonCelebration({
  isVisible,
  completionResult,
  basePoints,
  durationSeconds,
  nextLessonCode,
  characterCode,
  exerciseStats,
  onNext,
  onExit,
  onRetry,
}: LessonCelebrationProps) {
  const { t } = useTranslation("lessons");
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting">("entering");
  const [showFlash, setShowFlash] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pointsTarget  = completionResult?.points_earned ?? basePoints;
  const xpTarget      = completionResult?.xp_earned     ?? Math.round(basePoints * 0.5);
  const streakValue   = completionResult?.new_streak     ?? 0;
  const correctCount  = exerciseStats?.correct           ?? 0;
  const totalCount    = exerciseStats?.total             ?? 1;
  const accuracy      = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 100;

  const getMessageKey = useCallback(() => {
    if (accuracy >= 90) return "status.perfect";
    if (accuracy >= 70) return "status.great_job";
    if (accuracy >= 50) return "status.good_job";
    return "status.completed";
  }, [accuracy]);

  const animatedPoints = useCountUp(pointsTarget, 1200, isVisible);
  const animatedXP     = useCountUp(xpTarget,     1000, isVisible);
  const animatedStreak = useCountUp(streakValue,   800,  isVisible);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}:${String(secs).padStart(2, "0")}`;
    return `0:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!isVisible) { setPhase("entering"); return; }

    setShowFlash(true);
    setPhase("entering");

    const flashTimeout = setTimeout(() => setShowFlash(false), 600);
    const enterTimeout = setTimeout(() => setPhase("visible"), 100);

    const confettiTimeout = setTimeout(() => {
      const colors =
        accuracy >= 90
          ? ["#fbbf24", "#f59e0b", "#fcd34d", "#a78bfa", "#ffffff"]
          : accuracy >= 70
          ? ["#10b981", "#34d399", "#6ee7b7", "#5b6ef5", "#ffffff"]
          : ["#3b82f6", "#60a5fa", "#93c5fd", "#ffffff"];

      confetti({ particleCount: 80, angle: 60,  spread: 55, origin: { x: 0,   y: 0.9 }, colors, startVelocity: 55, gravity: 0.8 });
      confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1,   y: 0.9 }, colors, startVelocity: 55, gravity: 0.8 });
      confetti({ particleCount: 40, spread: 80,             origin: { x: 0.5, y: 0.3 }, colors, startVelocity: 30, gravity: 1.0, scalar: 0.8 });
    }, 350);

    timeoutsRef.current.push(flashTimeout, enterTimeout, confettiTimeout);
    return () => {
      clearTimeout(flashTimeout);
      clearTimeout(enterTimeout);
      clearTimeout(confettiTimeout);
      timeoutsRef.current = [];
    };
  }, [isVisible, accuracy]);

  if (!isVisible) return null;

  const messageKey = getMessageKey();
  const isPerfect  = accuracy >= 90;
  const accentColor = isPerfect ? "var(--lp-indigo)" : "var(--lp-emerald)";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
    >
      {/* ── Flash burst on entry ─────────────────────────────────────────── */}
      {showFlash && (
        <div
          className="lp-flash-in absolute inset-0 z-[10001] pointer-events-none"
          style={{ background: "white" }}
        />
      )}

      {/* ── Background: Light/Dark ───────────────────────── */}
      <div
        className={cn(
          "bg-slate-50 absolute inset-0 z-0 animate-in fade-in duration-700",
        )}
      />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "lp relative z-10 w-full h-[100dvh] flex flex-col items-center justify-between px-4 pb-6 pt-8 max-w-md mx-auto transition-all duration-700 ease-out",
          phase === "entering" ? "scale-95 opacity-0" : "scale-100 opacity-100"
        )}
      >
        {/* TOP: character + title + stars + accuracy */}
        <div className="flex flex-col items-center text-center w-full">

          {/* Character */}
          <div className="relative flex justify-center mb-3 pointer-events-none isolate">
            {/* Glow behind character */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 rounded-full z-[-1]"
              style={{ background: `radial-gradient(circle, ${accentColor}33 0%, transparent 65%)`, filter: "blur(30px)" }}
            />
            <div className="lp-bounce-in relative w-44 h-44 sm:w-52 sm:h-52 drop-shadow-2xl z-10 lp-bob">
              <CelebrationCharacter key={characterCode} characterCode={characterCode} />
            </div>
            {/* Sparkle accents */}
            <div className="absolute top-1 right-8 animate-pulse" style={{ color: accentColor, animationDelay: "0.2s" }}>
              <Sparkles size={22} />
            </div>
            <div className="absolute top-6 left-6 animate-pulse" style={{ color: "var(--lp-amber)", animationDelay: "0.5s" }}>
              <Sparkles size={14} />
            </div>
          </div>

          {/* Stars rating */}
          <div className="lp-title-drop" style={{ animationDelay: "0.1s" }}>
            <StarRating accuracy={accuracy} />
          </div>

          {/* Title */}
          <div className="lp-title-drop" style={{ animationDelay: "0.18s" }}>
            <h2
              id="celebration-title"
              className="lp-display text-3xl sm:text-4xl font-black mb-1"
              style={{ color: accentColor, textShadow: `0 0 30px ${accentColor}55` }}
            >
              {t(messageKey, { defaultValue: "¡Bien hecho!" })}
            </h2>
          </div>

          <div className="lp-title-drop mb-4" style={{ animationDelay: "0.24s" }}>
            <p className="lp-display text-sm sm:text-base font-semibold" style={{ color: "var(--lp-muted)" }}>
              {t("completion.subtitle")}
            </p>
          </div>

          {/* Accuracy bar */}
          <div
            className="w-full max-w-xs mb-6 animate-in fade-in duration-500"
            style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="lp-display text-xs font-bold uppercase tracking-wider" style={{ color: "var(--lp-muted)" }}>
                {t("completion.accuracy", { defaultValue: "Precisión" })}
              </span>
              <span className="lp-display text-sm font-black" style={{ color: accentColor }}>
                {correctCount}/{totalCount}
              </span>
            </div>
            <div className="lp-track h-4">
              <div
                className="lp-track-fill h-full transition-all duration-1000 ease-out"
                style={{
                  width: phase === "visible" ? `${accuracy}%` : "0%",
                  transitionDelay: "500ms",
                  background: isPerfect
                    ? "linear-gradient(90deg, var(--lp-indigo), #818cf8)"
                    : "linear-gradient(90deg, var(--lp-emerald), #34d399)",
                }}
              />
            </div>
          </div>

          {/* Stat cards */}
          <div className="flex gap-2 sm:gap-3 w-full mb-2">

            {/* Points */}
            <StatCard
              delay="0.30s"
              icon={<Star className="w-7 h-7" style={{ color: "var(--lp-indigo)", fill: "var(--lp-indigo)" }} />}
              value={animatedPoints}
              label={t("completion.points_earned", { defaultValue: "Puntos" })}
              prefix="+"
              lipColor="var(--lp-indigo-lip)"
              glowColor="rgba(91,110,245,0.25)"
            />

            {/* XP */}
            <StatCard
              delay="0.42s"
              icon={<Zap className="w-7 h-7" style={{ color: "var(--lp-amber)", fill: "var(--lp-amber)" }} />}
              value={animatedXP}
              label="XP"
              prefix="+"
              lipColor="var(--lp-amber-lip)"
              glowColor="rgba(246,168,33,0.25)"
            />

            {/* Time */}
            <StatCard
              delay="0.54s"
              icon={<Clock className="w-7 h-7" style={{ color: "var(--lp-muted)" }} />}
              value={formatDuration(durationSeconds)}
              label={t("completion.time")}
              lipColor="rgba(44,38,64,0.18)"
              glowColor="rgba(0,0,0,0.15)"
            />

            {/* Streak */}
            <StatCard
              delay="0.66s"
              icon={
                <Flame
                  className="w-7 h-7"
                  style={{
                    color: streakValue > 0 ? "var(--lp-amber)" : "var(--lp-muted)",
                    fill: streakValue > 0 ? "var(--lp-amber)" : "transparent",
                    filter: streakValue > 0 ? "drop-shadow(0 0 8px rgba(246,168,33,0.6))" : "none",
                  }}
                />
              }
              value={animatedStreak}
              label={t("completion.streak")}
              lipColor={streakValue > 0 ? "var(--lp-amber-lip)" : "rgba(44,38,64,0.18)"}
              glowColor={streakValue > 0 ? "rgba(246,168,33,0.22)" : "rgba(0,0,0,0.1)"}
            />
          </div>
        </div>

        {/* BOTTOM: action buttons */}
        <div
          className="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-8 duration-700"
          style={{ animationDelay: "700ms", animationFillMode: "backwards" }}
        >
          {/* Primary: next lesson / back to map */}
          <button
            onClick={onNext}
            disabled={nextLessonCode === undefined}
            className="lp-cta lp-cta--go w-full h-14 sm:h-16 text-lg sm:text-xl lp-display flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {nextLessonCode === undefined ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : nextLessonCode ? (
              <ArrowRight className="w-5 h-5" />
            ) : null}
            {nextLessonCode === undefined
              ? t("loading")
              : nextLessonCode
              ? t("completion.next_lesson")
              : t("completion.back_to_map", { defaultValue: "Volver al mapa" })}
          </button>

          {/* Secondary row */}
          <div className="flex gap-3">
            <button
              onClick={onExit}
              className="lp-token flex-1 h-12 lp-display text-sm sm:text-base font-bold flex items-center justify-center gap-1.5"
              style={{ color: "var(--lp-muted)" }}
            >
              <LogOut className="w-4 h-4" />
              {t("game_over.exit_button")}
            </button>
            <button
              onClick={onRetry}
              className="lp-cta lp-cta--retry flex-1 h-12 lp-display text-sm sm:text-base flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              {t("actions.retry")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
