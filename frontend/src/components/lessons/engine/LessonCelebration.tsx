import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Clock, ArrowRight, Loader2, Sparkles } from "lucide-react";
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

export interface LessonCelebrationProps {
  isVisible: boolean;
  completionResult?: { points_earned: number; xp_earned: number; new_streak: number } | null;
  basePoints: number;
  durationSeconds: number;
  nextLessonCode: string | null | undefined;
  characterCode: string; // 'liruf', 'dina', 'dr_rho', 'zara_vex'
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
  onNext,
  onExit,
  onRetry,
}: LessonCelebrationProps) {
  const { t } = useTranslation("lessons");
  const [phase, setPhase] = useState<"entering" | "visible" | "exiting">("entering");
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!isVisible) {
      setPhase("entering");
      return;
    }
    setPhase("entering");
    const enterTimeout = setTimeout(() => setPhase("visible"), 100);

    const confettiTimeout = setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.4 },
        colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ffffff"],
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
  }, [isVisible]);

  if (!isVisible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "rgba(0,0,0,0)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
    >
      <div className="absolute inset-0 z-0 bg-emerald-50 dark:bg-emerald-950/20 animate-in fade-in duration-1000" />
      
      {/* Drifting Orbs - Premium Liquid Glass Effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none saturate-[120%] dark:saturate-[150%]">
        <div className="absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full blur-[120px] bg-emerald-400 opacity-20 dark:bg-emerald-600 dark:opacity-30 animate-[streak-orb-float-1_8s_ease-in-out_infinite]" />
        <div className="absolute -bottom-40 -right-32 w-[420px] h-[420px] rounded-full blur-[100px] bg-teal-300 opacity-20 dark:bg-teal-500 dark:opacity-25 animate-[streak-orb-float-2_9s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] bg-blue-300 opacity-20 dark:bg-blue-600 dark:opacity-20 animate-[streak-orb-float-3_7s_ease-in-out_infinite]" />
      </div>

      <div className={cn(
        "relative z-10 w-full h-[100dvh] flex flex-col items-center justify-between px-4 pb-8 pt-12 max-w-md mx-auto transition-all duration-700 ease-out",
        phase === "entering" ? "scale-95 opacity-0" : "scale-100 opacity-100"
      )}>
           
        <div className="flex flex-col items-center text-center w-full mt-4">
            
          {/* Character Spotlight */}
          <div className="relative w-full flex justify-center mb-8 pointer-events-none isolate">
             {/* Central glow */}
            <div className="absolute bottom-4 w-56 h-56 rounded-full z-[-1]" style={{ background: "radial-gradient(circle,rgba(16,185,129,0.3) 0%,transparent 70%)", filter: "blur(28px)" }} />
            
            <div className="relative w-56 h-56 drop-shadow-2xl z-10 animate-bounce-in">
              <CelebrationCharacter characterCode={characterCode} />
            </div>

            {/* Sparkle particle */}
            <div className="absolute top-0 right-10 animate-pulse text-yellow-400 z-10"><Sparkles size={32} /></div>
          </div>

          <h2 id="celebration-title" className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 mb-2 drop-shadow-sm">
            {t("status.great_job")}
          </h2>
          <p className="text-gray-600 dark:text-white/80 text-lg font-medium mb-8">
            {t("completion.subtitle")}
          </p>

          {/* Stats Row - Staggered entrance */}
          <div className="flex justify-center gap-2 sm:gap-4 w-full mb-8">
            {/* Points Box */}
            <div
              className="relative rounded-3xl p-3 sm:p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col items-center transition-transform hover:-translate-y-1 animate-in zoom-in-75 fade-in duration-500"
              style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}
            >
               <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mb-1 drop-shadow-md">
                  {/* @ts-ignore */}
                  <dotlottie-wc
                    src="https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie"
                    autoplay
                    loop
                    style={{ width: "100%", height: "100%", pointerEvents: "none" }}
                  />
               </div>
               <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">+{completionResult?.points_earned ?? basePoints}</span>
               <span className="text-[9px] sm:text-[10px] font-black text-gray-500 dark:text-white/60 uppercase tracking-widest mt-0.5">{t("completion.points_earned", { defaultValue: "Points" })}</span>
            </div>

            {/* Time Box */}
            <div
              className="relative rounded-3xl p-3 sm:p-4 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col items-center transition-transform hover:-translate-y-1 animate-in zoom-in-75 fade-in duration-500"
              style={{ animationDelay: '350ms', animationFillMode: 'backwards' }}
            >
               <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mb-1 drop-shadow-md">
                   {/* @ts-ignore */}
                   <dotlottie-wc
                     src="https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie"
                     autoplay
                     loop
                     style={{ width: "100%", height: "100%", pointerEvents: "none" }}
                   />
               </div>
               <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">
                    {durationSeconds >= 60
                        ? `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, '0')}`
                        : `${durationSeconds}s`
                    }
               </span>
               <span className="text-[9px] sm:text-[10px] font-black text-gray-500 dark:text-white/60 uppercase tracking-widest mt-0.5">{t("completion.time")}</span>
            </div>

            {/* Streak Box (Only if streak is updated) */}
            {(completionResult?.new_streak ?? 0) > 0 && (
              <div
                className="relative rounded-3xl p-3 sm:p-4 bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-500/40 shadow-sm flex-1 flex flex-col items-center transition-transform hover:-translate-y-1 animate-in zoom-in-75 fade-in duration-500"
                style={{ animationDelay: '500ms', animationFillMode: 'backwards' }}
              >
                 <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mb-1 drop-shadow-md">
                    {/* @ts-ignore */}
                    <dotlottie-wc
                        src="https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie"
                        autoplay
                        loop
                        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
                    />
                 </div>
                 <span className="text-xl sm:text-2xl font-black text-orange-500">{completionResult.new_streak}</span>
                 <span className="text-[9px] sm:text-[10px] font-black text-gray-500 dark:text-white/60 uppercase tracking-widest mt-0.5">{t("completion.streak")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: '650ms', animationFillMode: 'backwards' }}>
           <button
               onClick={onNext}
               disabled={nextLessonCode === undefined}
               className="w-full h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-[4px] flex items-center justify-center gap-2"
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
