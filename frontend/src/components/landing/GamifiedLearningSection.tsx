import React, { useCallback, useEffect, useRef, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import {
    GamifiedLearningComposition,
    type GamifiedLearningProps,
    TOTAL_FRAMES,
} from "./GamifiedLearningComposition";

// Composition canvas dimensions (internal reference for Remotion scaling)
const COMP_W = 1000;
const COMP_H = 750;
const FPS = 30;

// ─── Animated player wrapper ──────────────────────────────────────────────────
function AnimPlayer({ inputProps }: { inputProps: GamifiedLearningProps }) {
    const playerRef = useRef<PlayerRef>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Auto-play when scrolled into view (IntersectionObserver)
    useEffect(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    try {
                        playerRef.current?.play();
                    } catch (_) { }
                    obs.disconnect();
                }
            },
            { threshold: 0.2 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <div
            ref={wrapperRef}
            style={{
                position: "relative",
                width: "100%",
                aspectRatio: `${COMP_W} / ${COMP_H}`,
            }}
        >
            <Player
                ref={playerRef}
                component={GamifiedLearningComposition}
                durationInFrames={TOTAL_FRAMES}
                fps={FPS}
                compositionWidth={COMP_W}
                compositionHeight={COMP_H}
                inputProps={inputProps}
                loop
                controls={false}
                clickToPlay={false}
                allowFullscreen={false}
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    background: "transparent",
                }}
                acknowledgeRemotionLicense
            />
        </div>
    );
}

// ─── Section (drop-in replacement for the old solution section) ───────────────
export function GamifiedLearningSection() {
    const { t } = useTranslation("landing");

    // We need to know if we are in dark mode to pass it down to the Remotion composition
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Initial check
        setIsDark(document.documentElement.classList.contains("dark"));

        // Setup an observer to watch for class changes on the html element
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === "class") {
                    setIsDark(document.documentElement.classList.contains("dark"));
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });
        return () => observer.disconnect();
    }, []);

    const benefits = [
        t("solution.benefit1"),
        t("solution.benefit2"),
        t("solution.benefit3"),
    ];

    const inputProps: GamifiedLearningProps = {
        step1_label: t("solution.animation.step1_label"),
        step2_label: t("solution.animation.step2_label"),
        step3_label: t("solution.animation.step3_label"),
        step4_label: t("solution.animation.step4_label"),
        step5_label: t("solution.animation.step5_label"),
        challenge: t("solution.animation.challenge"),
        option_a: t("solution.animation.option_a"),
        option_b: t("solution.animation.option_b"),
        option_c: t("solution.animation.option_c"),
        xp_label: t("solution.animation.xp_label"),
        level_label: t("solution.animation.level_label"),
        coins_label: t("solution.animation.coins_label"),
        games_title: t("solution.animation.games_title"),
        sim_title: t("solution.animation.sim_title"),
        ai_title: t("solution.animation.ai_title"),
        bank_title: t("solution.animation.bank_title"),
        ui_timeline: t("solution.animation.ui_timeline"),
        ui_preview: t("solution.animation.ui_preview"),
        ui_engine: t("solution.animation.ui_engine"),
        isDarkMode: isDark,
    };

    return (
        <section className="relative py-16 md:py-24 bg-gray-50 dark:bg-black text-gray-900 dark:text-white overflow-hidden transition-colors duration-500">

            {/* Ambient glows */}
            <div className="absolute top-0 right-0 w-[480px] h-[480px] rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[360px] h-[360px] rounded-full bg-pink-600/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Mobile: stacked | md+: side-by-side */}
                <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">

                    {/* ── Copy ── */}
                    <div className="flex-1 space-y-6 text-center md:text-left order-1">

                        <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-sm tracking-widest uppercase border border-blue-200 dark:border-blue-500/30">
                            {t("solution.badge")}
                        </div>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
                            {t("solution.title_part1")}
                            <br />
                            {t("solution.title_part2")}{" "}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                                {t("solution.title_highlight")}
                            </span>
                            .
                        </h2>

                        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl mx-auto md:mx-0">
                            {t("solution.subtitle")}
                        </p>

                        <ul className="space-y-3 text-left max-w-xl mx-auto md:mx-0">
                            {benefits.map((item, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm sm:text-base">
                                    <CheckCircle2 className="text-green-500 dark:text-green-400 w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <span className="text-gray-700 dark:text-gray-300">{item}</span>
                                </li>
                            ))}
                        </ul>

                        {/* Module pills */}
                        <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-2">
                            <span className="px-3 py-1.5 bg-blue-100/50 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 rounded-full text-xs font-bold border border-blue-300 dark:border-blue-500/25">
                                📚 {t("solution.animation.step1_label")}
                            </span>
                            <span className="px-3 py-1.5 bg-emerald-100/50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-bold border border-emerald-300 dark:border-emerald-500/25">
                                🎮 {t("solution.animation.games_title")}
                            </span>
                            <span className="px-3 py-1.5 bg-green-100/50 dark:bg-green-500/15 text-green-800 dark:text-green-300 rounded-full text-xs font-bold border border-green-300 dark:border-green-500/25">
                                🚀 {t("solution.animation.sim_title")}
                            </span>
                            <span className="px-3 py-1.5 bg-purple-100/50 dark:bg-purple-500/15 text-purple-800 dark:text-purple-300 rounded-full text-xs font-bold border border-purple-300 dark:border-purple-500/25">
                                🤖 {t("solution.animation.ai_title")}
                            </span>
                            <span className="px-3 py-1.5 bg-yellow-100/50 dark:bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 rounded-full text-xs font-bold border border-yellow-300 dark:border-yellow-500/25">
                                🏦 {t("solution.animation.bank_title")}
                            </span>
                        </div>
                    </div>

                    {/* ── Remotion Player ── */}
                    <div className="flex-1 w-full order-2 relative min-h-[400px] md:min-h-[600px] pointer-events-none">
                        {/* We use an absolutely positioned wrapper that deliberately overflows its parent container 
                            so the isometric canvas can be large enough that no 3D elements hit the edge and look "cropped" */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] sm:w-[130%] md:w-[180%] lg:w-[160%]">
                            <AnimPlayer inputProps={inputProps} />
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}

export default GamifiedLearningSection;
