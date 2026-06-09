import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Clock, ArrowRight, Loader2, Sparkles, Zap, Star, Flame, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DinoCharacter } from "@/components/characters/DinoCharacter";
import { DinaCharacter } from "@/components/characters/DinaCharacter";
import DrRhoCharacter from "@/components/characters/DrRhoCharacter";
import ZaraVexCharacter from "@/components/characters/ZaraVexCharacter";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

// Extracted OUTSIDE component to prevent remount on every render
function CelebrationCharacter({ characterCode }: { characterCode: string }) {
  switch (characterCode) {
    case "dina": return <DinaCharacter expression="happy" />;
    case "dr_rho": return <DrRhoCharacter mood="explaining" />;
    case "zara_vex": return <ZaraVexCharacter mood="excited" />;
    case "liruf":
    default: return <DinoCharacter mood="excited" showBubble={false} />;
  }
}

/** Animate a numeric value from 0 to target over `duration` ms */
function useCountUp(target: number, duration: number = 1200, isVisible: boolean) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isVisible) {
      setValue(0);
      return;
    }
    startTimeRef.current = null;

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isVisible, target, duration]);

  return value;
}

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
  characterCode: string; // 'liruf', 'dina', 'dr_rho', 'zara_vex'
  exerciseStats?: { correct: number; total: number } | null;
  onNext: () => void;
  onExit: () => void;
  onRetry: () => void;
}

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
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Derived values
  const pointsTarget = completionResult?.points_earned ?? basePoints;
  const xpTarget = completionResult?.xp_earned ?? Math.round(basePoints * 0.5);
  const streakValue = completionResult?.new_streak ?? 0;
  const isFallback = completionResult?.is_fallback ?? false;
  const correctCount = exerciseStats?.correct ?? 0;
  const totalCount = exerciseStats?.total ?? 1;
  const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 100;

  // Dynamic message based on performance
  const getMessageKey = useCallback(() => {
    if (accuracy >= 90) return "status.perfect";
    if (accuracy >= 70) return "status.great_job";
    if (accuracy >= 50) return "status.good_job";
    return "status.completed";
  }, [accuracy]);

  // Count-up animations
  const animatedPoints = useCountUp(pointsTarget, 1200, isVisible);
  const animatedXP = useCountUp(xpTarget, 1000, isVisible);
  const animatedStreak = useCountUp(streakValue, 800, isVisible);

  // Format duration consistently: always MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${String(secs).padStart(2, '0')}`;
    }
    return `0:${String(secs).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isVisible) {
      setPhase("entering");
      return;
    }
    setPhase("entering");
    const enterTimeout = setTimeout(() => setPhase("visible"), 100);

    const confettiTimeout = setTimeout(() => {
      const colors = accuracy >= 90
        ? ["#fbbf24", "#f59e0b", "#fcd34d", "#ffffff"] // gold
        : accuracy >= 70
          ? ["#10b981", "#34d399", "#6ee7b7", "#ffffff"] // emerald
          : ["#3b82f6", "#60a5fa", "#93c5fd", "#ffffff"]; // blue
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.4 },
        colors,
        startVelocity: 45,
        gravity: 0.6,
      });
    }, 300);

    timeoutsRef.current.push(enterTimeout, confettiTimeout);

    return () => {
      clearTimeout(enterTimeout);
      clearTimeout(confettiTimeout);
      timeoutsRef.current = [];
    };
  }, [isVisible, accuracy]);

  if (!isVisible) return null;

  const messageKey = getMessageKey();
  const isPerfect = accuracy >= 90;
  const hasErrors = correctCount < totalCount;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "rgba(0,0,0,0)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
    >
      {/* Background gradient */}
      <div className={cn(
        "absolute inset-0 z-0 animate-in fade-in duration-1000 backdrop-blur-sm",
        isPerfect ? "bg-indigo-50/95 dark:bg-indigo-950/95" : "bg-emerald-50/95 dark:bg-emerald-950/95"
      )} />
      
      {/* Drifting Orbs - Subtle, less distracting */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-[120px] bg-emerald-400/10 dark:bg-emerald-600/20 animate-[streak-orb-float-1_10s_ease-in-out_infinite]" />
        <div className="absolute -bottom-40 -right-32 w-[420px] h-[420px] rounded-full blur-[100px] bg-teal-300/10 dark:bg-teal-500/15 animate-[streak-orb-float-2_12s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] bg-blue-300/10 dark:bg-blue-600/10 animate-[streak-orb-float-3_8s_ease-in-out_infinite]" />
      </div>

      <div className={cn(
        "relative z-10 w-full h-[100dvh] flex flex-col items-center justify-between px-4 pb-8 pt-12 max-w-md mx-auto transition-all duration-700 ease-out",
        phase === "entering" ? "scale-95 opacity-0" : "scale-100 opacity-100"
      )}>
           
        <div className="flex flex-col items-center text-center w-full mt-4">
            
          {/* Character Spotlight */}
          <div className="relative w-full flex justify-center mb-6 pointer-events-none isolate">
             {/* Central glow */}
            <div className={cn(
              "absolute bottom-4 w-56 h-56 rounded-full z-[-1]",
              isPerfect
                ? "bg-indigo-400/20 dark:bg-indigo-500/30"
                : "bg-emerald-400/20 dark:bg-emerald-500/30"
            )} style={{ filter: "blur(28px)" }} />
            
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 drop-shadow-2xl z-10 animate-bounce-in">
              <CelebrationCharacter key={characterCode} characterCode={characterCode} />
            </div>

            {/* Sparkle particles */}
            <div className="absolute top-0 right-10 animate-pulse text-indigo-400 z-10">
              <Sparkles size={28} />
            </div>
            {isPerfect && (
              <div className="absolute top-4 left-8 animate-pulse text-indigo-300 z-10" style={{ animationDelay: '0.3s' }}>
                <Star size={20} className="fill-indigo-300" />
              </div>
            )}
          </div>

          {/* Dynamic Title */}
          <h2 id="celebration-title" className={cn(
            "text-3xl sm:text-4xl font-black mb-2 drop-shadow-sm",
            isPerfect ? "text-indigo-500 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            {t(messageKey, { defaultValue: "Great Job!" })}
          </h2>
          <p className="text-gray-600 dark:text-white/80 text-base sm:text-lg font-medium mb-2">
            {t("completion.subtitle")}
          </p>

          {/* Accuracy Bar */}
          <div className="w-full max-w-xs mb-6 animate-in fade-in zoom-in-95 duration-500" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-gray-500 dark:text-white/60 uppercase tracking-wider">
                {t("completion.accuracy", { defaultValue: "Accuracy" })}
              </span>
              <span className={cn(
                "text-sm font-black",
                isPerfect ? "text-indigo-500" : "text-emerald-500"
              )}>
                {correctCount}/{totalCount}
              </span>
            </div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-1000 ease-out",
                  isPerfect ? "bg-indigo-400" : "bg-emerald-500"
                )}
                style={{
                  width: phase === "visible" ? `${accuracy}%` : "0%",
                  transitionDelay: "400ms",
                }}
              />
            </div>
            {/* Performance badges */}
            <div className="flex justify-center gap-2 mt-2">
              {isPerfect && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                  <Star size={10} className="fill-indigo-500 text-indigo-500" />
                  {t("badges.perfect", { defaultValue: "Perfect" })}
                </span>
              )}
              {completionResult?.new_streak && completionResult.new_streak >= 3 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 text-[10px] font-bold uppercase tracking-wider">
                  <Flame size={10} className="text-violet-500" />
                  {t("badges.streak", { defaultValue: "Streak" })}
                </span>
              )}
              {isFallback && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                  <Target size={10} />
                  {t("badges.estimated", { defaultValue: "Estimated" })}
                </span>
              )}
            </div>
          </div>

          {/* Stats Row - Staggered entrance */}
          <div className="flex justify-center gap-2 sm:gap-4 w-full mb-6">
            {/* Points Box */}
            <div
              className="relative rounded-3xl p-3 sm:p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col items-center transition-transform hover:-translate-y-1 animate-in zoom-in-75 fade-in duration-500"
              style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}
            >
               <div className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center mb-1">
                  <div className="relative">
                    <Star className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400 fill-indigo-400 drop-shadow-md" />
                    <Sparkles className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 text-indigo-300" />
                  </div>
               </div>
               <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                 +{animatedPoints}
               </span>
               <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-white/60 uppercase tracking-widest mt-0.5">
                 {t("completion.points_earned", { defaultValue: "Points" })}
               </span>
            </div>

            {/* XP Box */}
            <div
              className="relative rounded-3xl p-3 sm:p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col items-center transition-transform hover:-translate-y-1 animate-in zoom-in-75 fade-in duration-500"
              style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}
            >
               <div className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center mb-1">
                  <Zap className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400 fill-blue-400 drop-shadow-md" />
               </div>
               <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                 +{animatedXP}
               </span>
               <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-white/60 uppercase tracking-widest mt-0.5">
                 XP
               </span>
            </div>

            {/* Time Box */}
            <div
              className="relative rounded-3xl p-3 sm:p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col items-center transition-transform hover:-translate-y-1 animate-in zoom-in-75 fade-in duration-500"
              style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}
            >
               <div className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center mb-1">
                  <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400 drop-shadow-md" />
               </div>
               <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                 {formatDuration(durationSeconds)}
               </span>
               <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-white/60 uppercase tracking-widest mt-0.5">
                 {t("completion.time")}
               </span>
            </div>

            {/* Streak Box — ALWAYS visible */}
            <div
              className={cn(
                "relative rounded-3xl p-3 sm:p-4 bg-white dark:bg-slate-800 border-2 shadow-sm flex-1 flex flex-col items-center transition-transform hover:-translate-y-1 animate-in zoom-in-75 fade-in duration-500",
                streakValue > 0
                  ? "border-violet-200 dark:border-violet-500/40"
                  : "border-slate-200 dark:border-slate-700 opacity-60"
              )}
              style={{ animationDelay: '500ms', animationFillMode: 'backwards' }}
            >
               <div className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center mb-1">
                  <Flame className={cn(
                    "w-8 h-8 sm:w-10 sm:h-10 drop-shadow-md",
                    streakValue > 0 ? "text-violet-500 fill-violet-500" : "text-slate-300 dark:text-slate-600"
                  )} />
               </div>
               <span className={cn(
                 "text-xl sm:text-2xl font-black",
                 streakValue > 0 ? "text-violet-500" : "text-gray-400 dark:text-slate-500"
               )}>
                 {animatedStreak}
               </span>
               <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-white/60 uppercase tracking-widest mt-0.5">
                 {t("completion.streak")}
               </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: '650ms', animationFillMode: 'backwards' }}>
           <button
               onClick={onNext}
               disabled={nextLessonCode === undefined}
               className={cn(
                 "w-full h-14 sm:h-16 text-lg sm:text-xl font-bold text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-[4px] flex items-center justify-center gap-2",
                 isPerfect ? "bg-indigo-500 hover:bg-indigo-600 shadow-[0_4px_0_rgb(161,98,7)] hover:shadow-[0_2px_0_rgb(161,98,7)]" : "bg-green-500 hover:bg-green-600"
               )}
           >
                   {nextLessonCode === undefined ? (
                       <Loader2 className="w-5 h-5 animate-spin" />
                   ) : nextLessonCode ? (
                       <ArrowRight className="w-5 h-5" />
                   ) : null}
                   {nextLessonCode === undefined
                       ? t('loading')
                       : nextLessonCode
                           ? t('completion.next_lesson')
                           : t('completion.back_to_map', { defaultValue: 'Back to Map' })}
           </button>
           
           <div className="flex gap-3">
               <button
                   onClick={onExit}
                   className="flex-1 h-12 rounded-xl font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white shadow-[0_4px_0_rgb(148,163,184)] dark:shadow-[0_4px_0_rgb(51,65,85)] hover:shadow-[0_2px_0_rgb(148,163,184)] dark:hover:shadow-[0_2px_0_rgb(51,65,85)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] text-sm sm:text-base transition-all"
               >
                   {t('game_over.exit_button')}
               </button>
               <button
                   onClick={onRetry}
                   className="flex-1 h-12 rounded-xl font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white shadow-[0_4px_0_rgb(148,163,184)] dark:shadow-[0_4px_0_rgb(51,65,85)] hover:shadow-[0_2px_0_rgb(148,163,184)] dark:hover:shadow-[0_2px_0_rgb(51,65,85)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] text-sm sm:text-base transition-all flex items-center justify-center gap-2"
               >
                   🎮 {t('actions.retry')}
               </button>
           </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
