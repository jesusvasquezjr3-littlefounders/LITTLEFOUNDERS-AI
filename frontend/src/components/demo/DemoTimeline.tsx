import React, { useEffect, useRef, useState } from "react";
import { TOTAL_FRAMES_SHOWREEL } from "./DemoShowreelComposition";

// Chapter positions match DemoShowreelComposition Main offsets:
// Act1Intro: 0, Act2Lessons: 150, Act3Games: 500, Act4Bank: 800
// Act5AI: 1020, Act6Social: 1240, Act7CTA: 1460
const CHAPTERS = [
    { frame: 0, label: "Intro", icon: "✨" },
    { frame: 150, label: "Lecciones", icon: "📚" },
    { frame: 500, label: "Juegos", icon: "🎮" },
    { frame: 800, label: "Banca", icon: "💰" },
    { frame: 1020, label: "IA", icon: "🤖" },
    { frame: 1240, label: "Social", icon: "🤝" },
    { frame: 1460, label: "¡Empieza!", icon: "🚀" },
];

interface DemoTimelineProps {
    playerRef: React.RefObject<{ getCurrentFrame: () => number } | null>;
    totalFrames?: number;
}

export function DemoTimeline({ playerRef, totalFrames = TOTAL_FRAMES_SHOWREEL }: DemoTimelineProps) {
    const [currentFrame, setCurrentFrame] = useState(0);
    const rafRef = useRef<number>(0);
    const barRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const tick = () => {
            if (playerRef.current) {
                try {
                    const f = (playerRef.current as any).getCurrentFrame?.();
                    if (typeof f === "number") setCurrentFrame(f);
                } catch (_) { }
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [playerRef]);

    const progress = Math.min(currentFrame / totalFrames, 1);

    // Active chapter: the latest one whose frame <= currentFrame
    const activeChapter = [...CHAPTERS]
        .reverse()
        .find((c) => currentFrame >= c.frame);

    return (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-3xl px-6 pointer-events-none select-none top-[76px] md:top-auto md:bottom-6">
            {/* Chapter labels above bar */}
            <div className="relative h-8 mb-1">
                {CHAPTERS.map((ch, i) => {
                    const pct = (ch.frame / totalFrames) * 100;
                    const isActive = activeChapter?.frame === ch.frame;
                    return (
                        <div
                            key={i}
                            className="absolute flex flex-col items-center transition-all duration-300"
                            style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                        >
                            {/* Dot connector */}
                            <div
                                className={`w-2 h-2 rounded-full mb-1 transition-all duration-300 ${isActive
                                    ? "bg-indigo-500 scale-150 shadow-lg shadow-indigo-400/60"
                                    : currentFrame >= ch.frame
                                        ? "bg-indigo-400/80"
                                        : "bg-white/20"
                                    }`}
                            />
                            {/* Label — only show when active or hovered */}
                            <span
                                className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 ${isActive
                                    ? "text-indigo-400 opacity-100"
                                    : "text-white/30 opacity-0 scale-90"
                                    }`}
                            >
                                {ch.icon} {ch.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Progress bar track */}
            <div
                ref={barRef}
                className="relative h-[3px] rounded-full bg-white/10 backdrop-blur-sm overflow-visible"
            >
                {/* Filled portion */}
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-none"
                    style={{ width: `${progress * 100}%` }}
                />

                {/* Scrubber dot */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg shadow-indigo-500/60 border-2 border-indigo-400 transition-none"
                    style={{ left: `${progress * 100}%`, transform: "translate(-50%, -50%)" }}
                />

                {/* Chapter tick marks */}
                {CHAPTERS.map((ch, i) => {
                    const pct = (ch.frame / totalFrames) * 100;
                    return (
                        <div
                            key={i}
                            className={`absolute top-1/2 -translate-y-1/2 w-[2px] h-2 rounded-full transition-colors duration-300 ${currentFrame >= ch.frame ? "bg-white/60" : "bg-white/20"
                                }`}
                            style={{ left: `${pct}%`, transform: "translate(-50%, -50%)" }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
