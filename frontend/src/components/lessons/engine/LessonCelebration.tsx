import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Clock, ArrowRight, Loader2, Zap, Star, Flame, RotateCcw, LogOut } from "lucide-react";
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
  accentColor: string;
  prefix?: string;
}

function StatCard({ icon, value, label, delay, accentColor, prefix = "" }: StatCardProps) {
  return (
    <div
      className="lp-stat-pop flex flex-col items-center gap-1.5 rounded-[1.5rem] px-3 py-4 flex-1 min-w-0 bg-white dark:bg-[#0d1426] border border-slate-100 dark:border-white/5 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)]"
      style={{ animationDelay: delay }}
    >
      <div className="mb-1">{icon}</div>
      <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
        {prefix}{value}
      </span>
      <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
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
      {/* Flash burst on entry */}
      {showFlash && (
        <div
          className="lp-flash-in absolute inset-0 z-[10001] pointer-events-none"
          style={{ background: "white" }}
        />
      )}

      {/* Clean slate-50 background */}
      <div className="bg-slate-50 dark:bg-[#0a0e1a] absolute inset-0 z-0 animate-in fade-in duration-700" />

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
          <div className="relative flex justify-center mb-3 pointer-events-none">
            <div className="lp-bounce-in relative w-40 h-40 sm:w-48 sm:h-48 z-10 lp-bob">
              <CelebrationCharacter key={characterCode} characterCode={characterCode} />
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
              className="text-3xl sm:text-4xl font-bold mb-1 text-slate-900 dark:text-white"
            >
              {t(messageKey, { defaultValue: "¡Bien hecho!" })}
            </h2>
          </div>

          <div className="lp-title-drop mb-5" style={{ animationDelay: "0.24s" }}>
            <p className="text-sm sm:text-base font-medium text-slate-500 dark:text-slate-400">
              {t("completion.subtitle")}
            </p>
          </div>

          {/* Accuracy bar — inside island card */}
          <div
            className="w-full max-w-sm mb-5 bg-white dark:bg-[#0d1426] rounded-[2rem] p-5 border border-slate-100 dark:border-white/5 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] animate-in fade-in duration-500"
            style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t("completion.accuracy", { defaultValue: "Precisión" })}
              </span>
              <span className="text-sm font-bold" style={{ color: accentColor }}>
                {correctCount}/{totalCount}
              </span>
            </div>
            <div className="relative w-full h-3 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: phase === "visible" ? `${accuracy}%` : "0%",
                  transitionDelay: "500ms",
                  background: isPerfect
                    ? "#5b6ef5"
                    : "#10b981",
                }}
              />
            </div>
          </div>

          {/* Stat cards */}
          <div className="flex gap-2 sm:gap-3 w-full mb-2">

            {/* Points */}
            <StatCard
              delay="0.30s"
              icon={<Star className="w-6 h-6 text-indigo-500" fill="currentColor" />}
              value={animatedPoints}
              label={t("completion.points_earned", { defaultValue: "Puntos" })}
              prefix="+"
              accentColor="#5b6ef5"
            />

            {/* XP */}
            <StatCard
              delay="0.42s"
              icon={<Zap className="w-6 h-6 text-amber-500" fill="currentColor" />}
              value={animatedXP}
              label="XP"
              prefix="+"
              accentColor="#f59e0b"
            />

            {/* Time */}
            <StatCard
              delay="0.54s"
              icon={<Clock className="w-6 h-6 text-slate-400" />}
              value={formatDuration(durationSeconds)}
              label={t("completion.time")}
              accentColor="#64748b"
            />

            {/* Streak */}
            <StatCard
              delay="0.66s"
              icon={
                <Flame
                  className="w-6 h-6"
                  style={{
                    color: streakValue > 0 ? "#f59e0b" : "#94a3b8",
                    fill: streakValue > 0 ? "#f59e0b" : "transparent",
                  }}
                />
              }
              value={animatedStreak}
              label={t("completion.streak")}
              accentColor={streakValue > 0 ? "#f59e0b" : "#94a3b8"}
            />
          </div>
        </div>

        {/* BOTTOM: action buttons */}
        <div
          className="flex flex-col gap-3 w-full max-w-sm mx-auto animate-in slide-in-from-bottom-8 duration-700"
          style={{ animationDelay: "700ms", animationFillMode: "backwards" }}
        >
          {/* Primary: next lesson / back to map */}
          <button
            onClick={onNext}
            disabled={nextLessonCode === undefined}
            className="corp-btn-primary w-full h-12 rounded-full text-base font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
              className="flex-1 h-11 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 text-sm font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t("game_over.exit_button")}
            </button>
            <button
              onClick={onRetry}
              className="flex-1 h-11 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 text-sm font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
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
