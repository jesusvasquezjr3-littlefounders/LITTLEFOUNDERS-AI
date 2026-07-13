import {useId, useEffect, useRef, useState, useCallback} from 'react';
import { cn } from "@/lib/utils";
import { useTranslation } from 'react-i18next';

export type DinoMood = 'happy' | 'sad' | 'excited' | 'thinking' | 'shocked';

interface DinoCharacterProps {
    currentText?: string;
    showBubble?: boolean;
    className?: string;
    mood?: DinoMood;
    bubblePosition?: 'demo' | 'tutorial' | 'standard' | 'hero';
    isTalking?: boolean;
}

/**
 * Dino — The cheerful green T-Rex mascot.
 * Original SVG artwork preserved. Enhanced with Lottie-style animations:
 * smooth blink, spring-physics mouse tracking, idle breathing, tail wag,
 * squash-and-stretch bounce on click.
 */
export function DinoCharacter({ currentText, showBubble, className, mood = 'happy', bubblePosition = 'standard', isTalking = false }: DinoCharacterProps) {
    const uid = useId().replace(/:/g, "");
    const headGroupRef = useRef<SVGGElement>(null);
    const bubbleRef = useRef<HTMLDivElement>(null);
    const [isBlinking, setIsBlinking] = useState(false);
    const [_clickPulse, setClickPulse] = useState(0);
    const [isSurprised, setIsSurprised] = useState(false);
    const { t } = useTranslation('common');

    // ── Smooth mouse tracking (spring physics) ────────────────────────────
    const targetPupil = useRef({ x: 0, y: 0 });
    const currentPupil = useRef({ x: 0, y: 0 });
    const targetHead = useRef({ rot: 0, x: 0, y: 0 });
    const currentHead = useRef({ rot: 0, x: 0, y: 0 });
    const rafId = useRef<number | null>(null);

    // Blinking — randomized per-blink for natural rhythm
    const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const doBlink = () => {
            setIsBlinking(true);
            setTimeout(() => {
                setIsBlinking(false);
                blinkTimerRef.current = setTimeout(doBlink, 2000 + Math.random() * 2000);
            }, 160);
        };
        blinkTimerRef.current = setTimeout(doBlink, 800 + Math.random() * 1200);
        return () => { if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current); };
    }, []);

    // Mouse tracking with spring interpolation
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const x = (e.clientX / window.innerWidth) - 0.5;
            const y = (e.clientY / window.innerHeight) - 0.5;
            targetPupil.current = { x: x * 12, y: y * 12 };
            targetHead.current = { rot: x * 15, x: x * 8, y: y * 6 };
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Animation loop
    useEffect(() => {
        const animate = () => {
            const spring = 0.1;
            currentPupil.current.x += (targetPupil.current.x - currentPupil.current.x) * spring;
            currentPupil.current.y += (targetPupil.current.y - currentPupil.current.y) * spring;
            currentHead.current.rot += (targetHead.current.rot - currentHead.current.rot) * spring;
            currentHead.current.x += (targetHead.current.x - currentHead.current.x) * spring;
            currentHead.current.y += (targetHead.current.y - currentHead.current.y) * spring;

            const pupils = document.querySelectorAll('.pupil-group');
            pupils.forEach((pupil) => {
                (pupil as HTMLElement).style.transform = `translate(${currentPupil.current.x}px, ${currentPupil.current.y}px)`;
            });

            if (headGroupRef.current) {
                headGroupRef.current.setAttribute('transform',
                    `translate(${200 + currentHead.current.x}, ${140 + currentHead.current.y}) rotate(${currentHead.current.rot})`
                );
            }

            rafId.current = requestAnimationFrame(animate);
        };

        rafId.current = requestAnimationFrame(animate);
        return () => {
            if (rafId.current) cancelAnimationFrame(rafId.current);
        };
    }, []);

    const handleClick = useCallback(() => {
        setClickPulse(p => p + 1);
        setIsSurprised(true);
    }, []);

    useEffect(() => {
        if (!isSurprised) return;
        const timer = setTimeout(() => setIsSurprised(false), 800);
        return () => clearTimeout(timer);
    }, [isSurprised]);

    const effectiveMood = isSurprised ? 'shocked' : mood;

    return (
        <div className={cn("relative w-full h-full flex flex-col justify-end items-center transition-opacity duration-500 select-none", className)}>
            {/* Speech Bubble */}
            <div
                ref={bubbleRef}
                className={cn(
                    "absolute z-20 transition-all duration-300 ease-out",
                    bubblePosition === 'standard' && "-top-14 sm:-top-10 left-1/2 -translate-x-1/2",
                    bubblePosition === 'demo' && "-top-2 md:-top-4 left-1/2 -translate-x-1/2",
                    bubblePosition === 'tutorial' && "-top-16 right-0 md:right-auto md:left-1/2 md:-translate-x-1/2",
                    bubblePosition === 'hero' && "-top-14 left-1/2 -translate-x-1/2 md:-left-[10%] md:translate-x-0",
                    showBubble ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                )}
            >
                <div className={cn(
                    "relative bg-white rounded-2xl shadow-lg px-4 py-2",
                    "min-w-[180px] max-w-[240px] w-auto text-center"
                )}>
                    <p className="text-slate-700 font-bold text-xs leading-snug">
                        {currentText || t('characters.dino.default_greeting')}
                    </p>
                    <svg className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] w-4 h-2.5" viewBox="0 0 20 12" fill="none">
                        <path d="M0 0C3.5 0 7 8 10 12C13 8 16.5 0 20 0H0Z" fill="white" />
                    </svg>
                </div>
            </div>

            <style>{`
                .dino-breathe { animation: dinoBreatheAnim 3s ease-in-out infinite; transform-origin: bottom center; }
                @keyframes dinoBreatheAnim { 0%, 100% { transform: scaleY(1) translateY(0); } 50% { transform: scaleY(1.02) translateY(-2px); } }
                .dino-tail-anim { animation: dinoTailWag 3s ease-in-out infinite alternate; transform-origin: 150px 350px; }
                @keyframes dinoTailWag { 0% { transform: rotate(0deg); } 100% { transform: rotate(10deg); } }
                .dino-mouth-anim { animation: dinoTalkAnim 1.5s infinite; transform-origin: 20px 20px; }
                @keyframes dinoTalkAnim {
                    0%, 10% { transform: scaleY(1); } 20% { transform: scaleY(0.6); } 35% { transform: scaleY(1); }
                    45% { transform: scaleY(1); } 55% { transform: scaleY(0.7); } 70% { transform: scaleY(1); } 100% { transform: scaleY(1); }
                }
                .dino-face-transition { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
                .dino-spring-bounce { animation: dinoSpring 0.5s cubic-bezier(0.34, 1.5, 0.64, 1); transform-origin: center bottom; }
                @keyframes dinoSpring {
                    0% { transform: scale(1); }
                    40% { transform: scale(1.08); }
                    100% { transform: scale(1); }
                }
            `}</style>

            <svg
                id={`dino-svg-${uid}`}
                viewBox="-50 -50 500 500"
                xmlns="http://www.w3.org/2000/svg"
                className={cn(
                    "w-full h-full object-contain cursor-pointer overflow-visible",
                    "dino-breathe",
                    isSurprised && "dino-spring-bounce"
                )}
                style={{ willChange: "transform" }}
                onClick={handleClick}
            >
                <defs>
                    <linearGradient id={`bodyGradient-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: "#4ADE80", stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: "#22C55E", stopOpacity: 1 }} />
                    </linearGradient>
                    <linearGradient id={`bellyGradient-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: "#dcfce7", stopOpacity: 1 }} />
                        <stop offset="100%" style={{ stopColor: "#bbf7d0", stopOpacity: 1 }} />
                    </linearGradient>
                    <filter id={`dinoShadow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
                        <feOffset in="SourceAlpha" dx="0" dy="15" result="dropOffset" />
                        <feGaussianBlur in="dropOffset" stdDeviation="11" result="dropBlur" />
                        <feFlood floodColor="#0c3d20" floodOpacity="0.22" result="dropColor" />
                        <feComposite in="dropColor" in2="dropBlur" operator="in" result="dropShadow" />

                        <feOffset in="SourceAlpha" dx="6" dy="8" result="hlOffset" />
                        <feGaussianBlur in="hlOffset" stdDeviation="6" result="hlBlur" />
                        <feComposite in="SourceAlpha" in2="hlBlur" operator="out" result="hlMask" />
                        <feFlood floodColor="#ffffff" floodOpacity="0.40" result="hlColor" />
                        <feComposite in="hlColor" in2="hlMask" operator="in" result="highlight" />

                        <feOffset in="SourceAlpha" dx="2" dy="2" result="rimOffset" />
                        <feGaussianBlur in="rimOffset" stdDeviation="2" result="rimBlur" />
                        <feComposite in="SourceAlpha" in2="rimBlur" operator="out" result="rimMask" />
                        <feFlood floodColor="#ffffff" floodOpacity="0.40" result="rimColor" />
                        <feComposite in="rimColor" in2="rimMask" operator="in" result="rimLight" />

                        <feOffset in="SourceAlpha" dx="-8" dy="-10" result="isOffset" />
                        <feGaussianBlur in="isOffset" stdDeviation="6" result="isBlur" />
                        <feComposite in="SourceAlpha" in2="isBlur" operator="out" result="isMask" />
                        <feFlood floodColor="#14532D" floodOpacity="0.30" result="isColor" />
                        <feComposite in="isColor" in2="isMask" operator="in" result="innerShadow" />

                        <feOffset in="SourceAlpha" dx="-2" dy="-3" result="edgeShadowOffset" />
                        <feGaussianBlur in="edgeShadowOffset" stdDeviation="3" result="edgeShadowBlur" />
                        <feComposite in="SourceAlpha" in2="edgeShadowBlur" operator="out" result="edgeShadowMask" />
                        <feFlood floodColor="#064e3b" floodOpacity="0.22" result="edgeShadowColor" />
                        <feComposite in="edgeShadowColor" in2="edgeShadowMask" operator="in" result="edgeShadow" />

                        <feMerge>
                            <feMergeNode in="dropShadow" />
                            <feMergeNode in="SourceGraphic" />
                            <feMergeNode in="innerShadow" />
                            <feMergeNode in="edgeShadow" />
                            <feMergeNode in="highlight" />
                            <feMergeNode in="rimLight" />
                        </feMerge>
                    </filter>
                    <filter id={`innerDropShadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feOffset in="SourceAlpha" dx="0" dy="4" result="offset" />
                        <feGaussianBlur in="offset" stdDeviation="3" result="blur" />
                        <feFlood floodColor="#14532D" floodOpacity="0.25" result="color" />
                        <feComposite in="color" in2="blur" operator="in" result="shadow" />
                        <feMerge>
                            <feMergeNode in="shadow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <g filter={`url(#dinoShadow-${uid})`}>
                    {/* TAIL — lf-rig-tail: Character Control hook (appearance untouched) */}
                    <g className="lf-rig-tail">
                    <path className="dino-tail-anim" d="M120 280 Q 80 280 60 220 Q 50 190 40 180 Q 80 220 110 240 Z" fill="#22C55E" />
                    <g className="dino-tail-anim">
                        <path d="M50 200 L60 190 L70 205 Z" fill="#15803d" />
                        <path d="M70 215 L80 205 L90 220 Z" fill="#15803d" />
                        <path d="M90 230 L100 220 L110 235 Z" fill="#15803d" />
                    </g>
                    </g>

                    {/* BACK LEG (Behind) — lf-rig-leg-b: Character Control hook */}
                    <g className="lf-rig-leg-b">
                    <ellipse cx="230" cy="330" rx="30" ry="20" fill="#16a34a" />
                    <path d="M200 330 Q 200 350 210 350 L 250 350 Q 260 350 260 330" fill="#16a34a" />
                    </g>

                    {/* BODY */}
                    <path d="M130 200 Q 130 150 180 140 L 200 140 Q 250 140 250 200 Q 260 300 220 340 Q 180 360 140 330 Q 110 300 130 200 Z" fill={`url(#bodyGradient-${uid})`} />

                    {/* SPINES (Static) */}
                    <path d="M125 220 L110 210 L128 200 Z" fill="#15803d" />
                    <path d="M135 190 L120 180 L140 170 Z" fill="#15803d" />
                    <path d="M155 160 L145 145 L165 145 Z" fill="#15803d" />

                    {/* BELLY */}
                    <path d="M170 180 Q 240 180 235 320 Q 190 345 155 320 Q 140 250 170 180 Z" fill={`url(#bellyGradient-${uid})`} opacity="0.9" />

                    {/* Belly Lines */}
                    <path d="M170 220 Q 200 230 220 220" stroke="#86efac" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <path d="M165 250 Q 200 260 225 250" stroke="#86efac" strokeWidth="4" strokeLinecap="round" fill="none" />
                    <path d="M170 280 Q 200 290 220 280" stroke="#86efac" strokeWidth="4" strokeLinecap="round" fill="none" />

                    {/* FRONT LEG (Right) — lf-rig-leg-f: Character Control hook */}
                    <g className="lf-rig-leg-f">
                    <g transform="translate(140, 310)" filter={`url(#innerDropShadow-${uid})`}>
                        <ellipse cx="30" cy="10" rx="35" ry="35" fill={`url(#bodyGradient-${uid})`} />
                        <path d="M10 30 Q 10 45 20 45 L 50 45 Q 60 45 60 30" fill="#22C55E" />
                        <circle cx="20" cy="45" r="5" fill="#f0fdf4" />
                        <circle cx="35" cy="45" r="5" fill="#f0fdf4" />
                        <circle cx="50" cy="45" r="5" fill="#f0fdf4" />
                    </g>
                    </g>

                    {/* ARM — lf-rig-arm-f: Character Control hook */}
                    <g className="lf-rig-arm-f">
                    <g transform="translate(180, 220) rotate(-20)" filter={`url(#innerDropShadow-${uid})`}>
                        <path d="M0 0 Q 30 10 40 40 Q 10 40 0 0" fill="#22C55E" />
                        <circle cx="40" cy="40" r="4" fill="#f0fdf4" />
                        <circle cx="32" cy="42" r="4" fill="#f0fdf4" />
                    </g>
                    </g>

                    {/* HEAD GROUP */}
                    <g id={`head-group-${uid}`} ref={headGroupRef} transform="translate(200, 140)" filter={`url(#innerDropShadow-${uid})`}>
                        {/* Neck */}
                        <path d="M-40 20 Q -20 50 10 40 L 10 0 L -40 0 Z" fill="#4ADE80" />

                        {/* Head Base */}
                        <path d="M-60 -60 L 40 -60 Q 90 -60 90 0 Q 90 60 20 60 L -20 60 Q -70 60 -70 0 Q -70 -60 -60 -60 Z" fill="#4ADE80" />

                        {/* Snout */}
                        <ellipse cx="20" cy="-10" rx="60" ry="45" fill="#4ADE80" />

                        {/* MOUTH GROUP */}
                        <g className={cn("dino-face-transition", isTalking ? "dino-mouth-anim" : "")}>
                            {effectiveMood === 'happy' && (
                                <>
                                    <path d="M-30 10 Q 20 10 60 0 Q 60 40 0 40 Q -30 40 -30 10 Z" fill="#374151" />
                                    <path d="M0 40 Q 30 40 40 25 Q 20 20 0 40 Z" fill="#f87171" />
                                    <path d="M40 5 L 45 15 L 50 5 Z" fill="white" />
                                </>
                            )}
                            {effectiveMood === 'sad' && (
                                <path d="M-30 40 Q 20 40 60 30 Q 60 10 0 10 Q -30 10 -30 40 Z" fill="#374151" />
                            )}
                            {effectiveMood === 'excited' && (
                                <>
                                    <ellipse cx="15" cy="20" rx="25" ry="20" fill="#374151" />
                                    <ellipse cx="15" cy="25" rx="15" ry="10" fill="#f87171" />
                                </>
                            )}
                            {effectiveMood === 'thinking' && (
                                <path d="M-20 25 Q 20 25 50 20" stroke="#374151" strokeWidth="4" fill="none" />
                            )}
                            {effectiveMood === 'shocked' && (
                                <circle cx="15" cy="25" r="15" fill="#374151" />
                            )}
                        </g>

                        {/* CHEEK */}
                        <ellipse cx="-40" cy="15" rx="12" ry="8" fill="#fca5a5" opacity="0.6" />

                        {/* LEFT EYE */}
                        <g transform="translate(-10, -50) scale(0.9)">
                            <circle cx="0" cy="0" r="20" fill="white" stroke="#22c55e" strokeWidth="2" />
                            {isBlinking ? (
                                <path d="M-15 0 L 15 0" stroke="#15803d" strokeWidth="4" strokeLinecap="round" />
                            ) : (
                                <g className="pupil-group">
                                    <circle cx="5" cy="0" r="8" fill="#111827" />
                                    <circle cx="8" cy="-3" r="3" fill="white" />
                                </g>
                            )}
                            <path d="M-15 -15 Q 0 -25 15 -15" stroke="#166534" strokeWidth="3" fill="none" />
                        </g>

                        {/* RIGHT EYE */}
                        <g transform="translate(35, -45)">
                            <circle cx="0" cy="0" r="22" fill="white" stroke="#22c55e" strokeWidth="2" />
                            {isBlinking ? (
                                <path d="M-17 0 L 17 0" stroke="#15803d" strokeWidth="4" strokeLinecap="round" />
                            ) : (
                                <g className="pupil-group">
                                    <circle cx="5" cy="0" r="9" fill="#111827" />
                                    <circle cx="8" cy="-3" r="3" fill="white" />
                                </g>
                            )}
                            <path d="M-15 -18 Q 0 -28 15 -18" stroke="#166534" strokeWidth="3" fill="none" />
                        </g>

                        {/* NOSTRILS */}
                        <ellipse cx="50" cy="-15" rx="3" ry="5" fill="#166534" />
                        <ellipse cx="60" cy="-12" rx="3" ry="5" fill="#166534" />
                    </g>
                </g>
            </svg>
        </div>
    );
}

export default DinoCharacter;
