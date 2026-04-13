import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (!isVisible) {
      setPhase("entering");
      return;
    }
    setPhase("entering");
    const enterTimeout = setTimeout(() => setPhase("visible"), 100);
    
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 120,
        origin: { y: 0.4 },
        colors: ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ffffff"],
        startVelocity: 45,
        gravity: 0.6,
      });
    }, 300);

    return () => clearTimeout(enterTimeout);
  }, [isVisible]);

  if (!isVisible) return null;

  const RenderCharacter = () => {
    switch (characterCode) {
        case "dina": return <DinaCharacter expression="happy" />;
        case "dr_rho": return <DrRhoCharacter mood="explaining" />;
        case "zara_vex": return <ZaraVexCharacter mood="excited" />;
        case "liruf":
        default: return <DinoCharacter mood="excited" showBubble={false} />;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "rgba(0,0,0,0)" }}
    >
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-emerald-100 via-teal-50 to-blue-100 dark:from-[#032b1a] dark:via-[#073b28] dark:to-[#0d1b4b] animate-in fade-in duration-1000" />
      
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
              <RenderCharacter />
            </div>

            {/* Sparkle particle */}
            <div className="absolute top-0 right-10 animate-pulse text-yellow-400 z-10"><Sparkles size={32} /></div>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 drop-shadow-sm">
            {t("status.great_job")}
          </h2>
          <p className="text-gray-600 dark:text-white/80 text-lg font-medium mb-8">
            {t("completion.subtitle")}
          </p>

          {/* Stats Glass Row */}
          <div className="flex justify-center gap-2 sm:gap-4 w-full mb-8">
            {/* Points Box */}
            <div className="relative rounded-3xl p-3 sm:p-4 bg-white/60 dark:bg-white/10 backdrop-blur-xl border border-white/60 dark:border-white/20 shadow-xl dark:shadow-2xl flex-1 flex flex-col items-center transition-transform hover:scale-105 saturate-[150%]">
               <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mb-1 drop-shadow-md">
                  {/* @ts-ignore */}
                  <dotlottie-wc
                    src="https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie"
                    autoplay
                    loop
                    style={{ width: "100%", height: "100%", pointerEvents: "none" }}
                  />
               </div>
               <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">+{completionResult?.points_earned || basePoints}</span>
               <span className="text-[9px] sm:text-[10px] font-black text-gray-500 dark:text-white/60 uppercase tracking-widest mt-0.5">{t("completion.points_earned", { defaultValue: "Points" })}</span>
            </div>

            {/* Time Box */}
            <div className="relative rounded-3xl p-3 sm:p-4 bg-white/60 dark:bg-white/10 backdrop-blur-xl border border-white/60 dark:border-white/20 shadow-xl dark:shadow-2xl flex-1 flex flex-col items-center transition-transform hover:scale-105 saturate-[150%]">
               <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mb-1 drop-shadow-md">
                   {/* @ts-ignore */}
                   <dotlottie-wc
                     src="https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie"
                     autoplay
                     loop
                     style={{ width: "100%", height: "100%", pointerEvents: "none" }}
                   />
               </div>
               <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white">{durationSeconds}s</span>
               <span className="text-[9px] sm:text-[10px] font-black text-gray-500 dark:text-white/60 uppercase tracking-widest mt-0.5">{t("completion.time")}</span>
            </div>

            {/* Streak Box (Only if streak is updated) */}
            {completionResult?.new_streak && (
              <div className="relative rounded-3xl p-3 sm:p-4 bg-white/60 dark:bg-white/10 backdrop-blur-xl border border-white/60 dark:border-white/20 shadow-xl dark:shadow-2xl flex-1 flex flex-col items-center transition-transform hover:scale-105 saturate-[150%]">
                 <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center mb-1 drop-shadow-md">
                    {/* @ts-ignore */}
                    <dotlottie-wc
                        src="https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie"
                        autoplay
                        loop
                        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
                    />
                 </div>
                 <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-br from-[#FFD060] to-[#FF8C00]">{completionResult.new_streak}</span>
                 <span className="text-[9px] sm:text-[10px] font-black text-gray-500 dark:text-white/60 uppercase tracking-widest mt-0.5">{t("completion.streak")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 w-full animate-in slide-in-from-bottom-8 duration-700 delay-150">
           <button
               onClick={onNext}
               disabled={nextLessonCode === undefined}
               className="relative group w-full py-4 rounded-2xl font-black text-white text-lg transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden"
               style={{
                   background: "linear-gradient(135deg,#10b981 0%,#0891b2 100%)",
                   boxShadow: "0 12px 32px rgba(16,185,129,0.42)",
                   border: "1px solid rgba(255,255,255,0.15)",
               }}
           >
               <span className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)" }} />
               <span className="relative flex items-center justify-center drop-shadow-sm gap-2">
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
               </span>
           </button>
           
           <div className="flex gap-3">
               <button
                   onClick={onExit}
                   className="flex-1 py-3.5 rounded-xl font-bold text-gray-700 dark:text-white bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 backdrop-blur-lg border border-white/70 dark:border-white/10 shadow-lg text-sm transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
               >
                   {t('game_over.exit_button')}
               </button>
               <button
                   onClick={onRetry}
                   className="flex-1 py-3.5 rounded-xl font-bold text-gray-700 dark:text-white bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 backdrop-blur-lg border border-white/70 dark:border-white/10 shadow-lg text-sm transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
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
