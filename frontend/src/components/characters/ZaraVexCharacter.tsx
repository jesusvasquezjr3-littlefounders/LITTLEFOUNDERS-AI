import React, {useId, useEffect, useRef, useState, useCallback} from "react";
import { cn } from "@/lib/utils";

export type ZaraMood = 'neutral' | 'happy' | 'flirty' | 'curious' | 'excited';

interface ZaraVexCharacterProps {
    className?: string;
    mood?: ZaraMood;
    showBubble?: boolean;
    currentText?: string;
    bubblePosition?: 'top' | 'right';
    isTalking?: boolean;
}

const COLORS = {
    skin: "#F5D0B5",
    skinShadow: "#E8B998",
    hair: "#2A1B15",
    hairHighlight: "#4A3228",
    lips: "#C65E65",
    eyes: "#4E342E",
    blush: "#F0A6A6",
    top: "#8B2E3F",
    pants: "#1A1A1A",
    shoes: "#000000",
    necklace: "#E0E0E0",
    stroke: "#2D1F1D",
    white: "#FFFFFF",
};

/**
 * Zara Vex — The clever, stylish strategist.
 * Original SVG artwork preserved. Enhanced with Lottie-style animations:
 * smooth blink, spring-physics mouse tracking, idle floating, spring bounce.
 * Emoji flower replaced with vector SVG flower.
 */
export const ZaraVexCharacter: React.FC<ZaraVexCharacterProps> = ({
    className,
    mood = 'neutral',
    showBubble = false,
    currentText = "",
    isTalking = false,
    bubblePosition = 'top'
}) => {
    const [isBlinking, setIsBlinking] = useState(false);
    const [clickPulse, setClickPulse] = useState(0);
    const [isSurprised, setIsSurprised] = useState(false);

    // Smooth mouse tracking
    const targetHead = useRef({ x: 0, y: 0, rot: 0 });
    const currentHead = useRef({ x: 0, y: 0, rot: 0 });
    const rafId = useRef<number | null>(null);

    // Blinking — randomized per-blink for natural rhythm
    const uid = useId().replace(/:/g, "");
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

    // Mouse tracking
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const x = (e.clientX / window.innerWidth) - 0.5;
            const y = (e.clientY / window.innerHeight) - 0.5;
            targetHead.current = { x: x * 5, y: y * 3, rot: x * 4 };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Animation loop
    useEffect(() => {
        const animate = () => {
            const spring = 0.08;
            currentHead.current.x += (targetHead.current.x - currentHead.current.x) * spring;
            currentHead.current.y += (targetHead.current.y - currentHead.current.y) * spring;
            currentHead.current.rot += (targetHead.current.rot - currentHead.current.rot) * spring;

            const headGroup = document.getElementById('zara-head-group');
            if (headGroup) {
                headGroup.style.transform = `translate(${currentHead.current.x}px, ${currentHead.current.y}px) rotate(${currentHead.current.rot}deg)`;
            }
            rafId.current = requestAnimationFrame(animate);
        };
        rafId.current = requestAnimationFrame(animate);
        return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
    }, []);

    const moodConfig = {
        neutral: { eyesType: "normal", mouth: "smile", blush: 0.4 },
        happy: { eyesType: "happy", mouth: "big", blush: 0.6 },
        flirty: { eyesType: "wink", mouth: "smirk", blush: 0.7 },
        curious: { eyesType: "wide", mouth: "o", blush: 0.3 },
        excited: { eyesType: "sparkle", mouth: "open", blush: 0.6 }
    };

    const currentMood = isSurprised ? 'curious' : mood;
    const c = moodConfig[currentMood];

    const handleClick = useCallback(() => {
        setClickPulse(p => p + 1);
        setIsSurprised(true);
    }, []);

    useEffect(() => {
        if (!isSurprised) return;
        const timer = setTimeout(() => setIsSurprised(false), 800);
        return () => clearTimeout(timer);
    }, [isSurprised]);

    return (
        <div className={cn("relative w-full h-full flex items-end justify-center cursor-pointer select-none", className)}
            style={{ willChange: "transform" }}
            onClick={handleClick}>

            {/* Burbuja */}
            <div className={cn(
                "absolute z-30 transition-all duration-300 ease-out",
                bubblePosition === 'top' && "-top-4 sm:-top-8 left-1/2 -translate-x-1/2",
                bubblePosition === 'right' && "top-8 -right-2",
                showBubble ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-50 pointer-events-none"
            )}>
                <div className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-2 shadow-lg relative min-w-[180px] max-w-[240px]">
                    <p className="font-bold text-slate-600 text-xs leading-snug text-center">
                        {currentText}
                    </p>
                    <div className="absolute w-3 h-3 bg-white border-b-2 border-r-2 border-slate-200 transform rotate-45 left-1/2 -translate-x-1/2 -bottom-[7px]"></div>
                </div>
            </div>

            <style>{`
                .zara-face-transition { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
                .zara-mouth-talk { animation: zaraTalkAnim 0.3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
                @keyframes zaraTalkAnim {
                    0%, 100% { transform: scaleY(0.65) scaleX(0.92); }
                    50% { transform: scaleY(1.7) scaleX(1.05); }
                }
                @media (prefers-reduced-motion: reduce) { .zara-mouth-talk { animation: none; } }
                .zara-idle-float { animation: zaraFloat 4s ease-in-out infinite; transform-origin: center bottom; }
                @keyframes zaraFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
                .zara-spring-bounce { animation: zaraSpring 0.5s cubic-bezier(0.34, 1.5, 0.64, 1); transform-origin: center bottom; }
                @keyframes zaraSpring {
                    0% { transform: scale(1); }
                    40% { transform: scale(1.08); }
                    100% { transform: scale(1); }
                }
            `}</style>

            <svg
                id={`zara-svg-${uid}`}
                viewBox="-180 -100 500 500"
                className={cn(
                    "w-full h-full object-contain",
                    "zara-idle-float",
                    isSurprised && "zara-spring-bounce"
                )}
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient id={`hairShine-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={COLORS.hair} />
                        <stop offset="20%" stopColor={COLORS.hairHighlight} />
                        <stop offset="60%" stopColor={COLORS.hair} />
                    </linearGradient>
                    {/* Form-shading gradients (light from top-left) */}
                    <radialGradient id={`zaraSkin-${uid}`} cx="40%" cy="34%" r="78%">
                        <stop offset="0%" stopColor="#FCE0CA" />
                        <stop offset="58%" stopColor="#F5D0B5" />
                        <stop offset="100%" stopColor="#E2B190" />
                    </radialGradient>
                    <linearGradient id={`zaraTop-${uid}`} x1="22%" y1="0%" x2="78%" y2="100%">
                        <stop offset="0%" stopColor="#A23A4C" />
                        <stop offset="100%" stopColor="#741F2C" />
                    </linearGradient>
                    <filter id={`zaraShadow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
                        <feOffset in="SourceAlpha" dx="0" dy="16" result="dropOffset" />
                        <feGaussianBlur in="dropOffset" stdDeviation="12" result="dropBlur" />
                        <feFlood floodColor="#3a1218" floodOpacity="0.22" result="dropColor" />
                        <feComposite in="dropColor" in2="dropBlur" operator="in" result="dropShadow" />

                        <feOffset in="SourceAlpha" dx="6" dy="8" result="hlOffset" />
                        <feGaussianBlur in="hlOffset" stdDeviation="7" result="hlBlur" />
                        <feComposite in="SourceAlpha" in2="hlBlur" operator="out" result="hlMask" />
                        <feFlood floodColor="#ffffff" floodOpacity="0.28" result="hlColor" />
                        <feComposite in="hlColor" in2="hlMask" operator="in" result="highlight" />

                        <feOffset in="SourceAlpha" dx="2" dy="2" result="rimOffset" />
                        <feGaussianBlur in="rimOffset" stdDeviation="2" result="rimBlur" />
                        <feComposite in="SourceAlpha" in2="rimBlur" operator="out" result="rimMask" />
                        <feFlood floodColor="#ffffff" floodOpacity="0.32" result="rimColor" />
                        <feComposite in="rimColor" in2="rimMask" operator="in" result="rimLight" />

                        <feOffset in="SourceAlpha" dx="-8" dy="-10" result="isOffset" />
                        <feGaussianBlur in="isOffset" stdDeviation="7" result="isBlur" />
                        <feComposite in="SourceAlpha" in2="isBlur" operator="out" result="isMask" />
                        <feFlood floodColor="#581C24" floodOpacity="0.26" result="isColor" />
                        <feComposite in="isColor" in2="isMask" operator="in" result="innerShadow" />

                        <feOffset in="SourceAlpha" dx="-2" dy="-3" result="edgeShadowOffset" />
                        <feGaussianBlur in="edgeShadowOffset" stdDeviation="3" result="edgeShadowBlur" />
                        <feComposite in="SourceAlpha" in2="edgeShadowBlur" operator="out" result="edgeShadowMask" />
                        <feFlood floodColor="#310f13" floodOpacity="0.20" result="edgeShadowColor" />
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
                    <filter id={`zaraHairHighlights-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feOffset in="SourceAlpha" dx="6" dy="8" result="hlOffset" />
                        <feGaussianBlur in="hlOffset" stdDeviation="5" result="hlBlur" />
                        <feComposite in="SourceAlpha" in2="hlBlur" operator="out" result="hlMask" />
                        <feFlood floodColor="#ffffff" floodOpacity="0.10" result="hlColor" />
                        <feComposite in="hlColor" in2="hlMask" operator="in" result="highlight" />

                        <feOffset in="SourceAlpha" dx="2" dy="2" result="rimOffset" />
                        <feGaussianBlur in="rimOffset" stdDeviation="1" result="rimBlur" />
                        <feComposite in="SourceAlpha" in2="rimBlur" operator="out" result="rimMask" />
                        <feFlood floodColor="#ffffff" floodOpacity="0.15" result="rimColor" />
                        <feComposite in="rimColor" in2="rimMask" operator="in" result="rimLight" />

                        <feMerge>
                            <feMergeNode in="SourceGraphic" />
                            <feMergeNode in="highlight" />
                            <feMergeNode in="rimLight" />
                        </feMerge>
                    </filter>
                    <filter id={`innerDropShadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feOffset in="SourceAlpha" dx="0" dy="4" result="offset" />
                        <feGaussianBlur in="offset" stdDeviation="3" result="blur" />
                        <feFlood floodColor="#581C24" floodOpacity="0.25" result="color" />
                        <feComposite in="color" in2="blur" operator="in" result="shadow" />
                        <feMerge>
                            <feMergeNode in="shadow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <g filter={`url(#zaraShadow-${uid})`}>
                {/* === CABELLO TRASERO === */}
                <path d="M35 50 Q 15 100 20 200 Q 25 240 50 240 L 90 240 Q 115 240 120 200 Q 125 100 105 50 Q 70 30 35 50" fill={COLORS.hair} filter={`url(#zaraHairHighlights-${uid})`} />

                {/* === CUERPO INFERIOR === */}
                <rect x="45" y="190" width="22" height="120" rx="2" fill={COLORS.pants} />
                <rect x="73" y="190" width="22" height="120" rx="2" fill={COLORS.pants} />
                <path d="M45 310 L 45 330 Q 56 335 67 330 L 67 310 Z" fill={COLORS.shoes} />
                <path d="M73 310 L 73 330 Q 84 335 95 330 L 95 310 Z" fill={COLORS.shoes} />

                {/* === CUERPO SUPERIOR === */}
                <g filter={`url(#innerDropShadow-${uid})`}>
                    <path d="M45 130 Q 40 160 42 195 L 42 200 L 98 200 L 98 195 Q 100 160 95 130 Q 90 120 70 120 Q 50 120 45 130" fill={`url(#zaraTop-${uid})`} />

                    {/* Brazos */}
                    <path d="M42 135 Q 30 160 30 190 Q 30 200 32 210" fill="none" stroke="url(#zaraSkin)" strokeWidth="9" strokeLinecap="round" />
                    <circle cx="32" cy="210" r="4.5" fill={`url(#zaraSkin-${uid})`} />
                    <path d="M98 135 Q 110 160 110 190 Q 110 200 108 210" fill="none" stroke="url(#zaraSkin)" strokeWidth="9" strokeLinecap="round" />
                    <circle cx="108" cy="210" r="4.5" fill={`url(#zaraSkin-${uid})`} />

                    {/* Cuello */}
                    <path d="M58 100 L 58 125 Q 70 130 82 125 L 82 100" fill={`url(#zaraSkin-${uid})`} stroke={COLORS.stroke} strokeWidth="2.5" />

                    {/* Collar */}
                    <path d="M60 118 Q 70 135 80 118" fill="none" stroke={COLORS.necklace} strokeWidth="2" />
                    <path d="M70 126 L 70 130" stroke={COLORS.necklace} strokeWidth="2" />
                    <circle cx="70" cy="132" r="2.5" fill={COLORS.necklace} />
                </g>

                {/* === CABEZA === */}
                <g id={`zara-head-group-${uid}`} style={{ transformOrigin: '70px 70px', transition: 'transform 0.1s linear' }} filter={`url(#innerDropShadow-${uid})`}>
                    <path d="M40 50 Q 38 80 50 95 Q 70 110 90 95 Q 102 80 100 50 Q 100 20 70 20 Q 40 20 40 50" fill={`url(#zaraSkin-${uid})`} stroke={COLORS.stroke} strokeWidth="2.5" />

                    {/* Cabello Frontal y Mechones agrupados para el filtro de luz */}
                    <g filter={`url(#zaraHairHighlights-${uid})`}>
                        {/* Cabello Frontal */}
                        <path d="M35 45 Q 45 15 70 15 Q 95 15 105 45" fill={COLORS.hair} />

                        {/* Mechón Izquierdo */}
                        <path d="M40 38 Q 35 50 40 70 Q 50 50 55 40 Z" fill={COLORS.hair} />

                        {/* Mechón Derecho */}
                        <path d="M70 22 Q 95 22 108 55 Q 112 80 95 85 Q 98 60 85 45 Q 80 35 70 22" fill={`url(#hairShine-${uid})`} />
                    </g>

                    {/* Flor SVG (reemplaza emoji) */}
                    <g transform="translate(45, 40) rotate(-15)">
                        <circle cx="0" cy="-5" r="4" fill="#FF6B9D" />
                        <circle cx="5" cy="0" r="4" fill="#FF6B9D" />
                        <circle cx="0" cy="5" r="4" fill="#FF6B9D" />
                        <circle cx="-5" cy="0" r="4" fill="#FF6B9D" />
                        <circle cx="0" cy="0" r="2.5" fill="#FFD93D" />
                    </g>

                    {/* Orejas */}
                    <ellipse cx="38" cy="65" rx="4" ry="6" fill={`url(#zaraSkin-${uid})`} stroke={COLORS.stroke} strokeWidth="2" />
                    <ellipse cx="102" cy="65" rx="4" ry="6" fill={`url(#zaraSkin-${uid})`} stroke={COLORS.stroke} strokeWidth="2" />

                    {/* Rubor */}
                    <ellipse cx="50" cy="75" rx="6" ry="3" fill={COLORS.blush} opacity={c.blush} />
                    <ellipse cx="90" cy="75" rx="6" ry="3" fill={COLORS.blush} opacity={c.blush} />

                    {/* Cejas */}
                    <path d="M45 52 Q 52 48 60 51" fill="none" stroke={COLORS.hair} strokeWidth="2" strokeLinecap="round" />
                    <path d="M80 51 Q 88 48 95 52" fill="none" stroke={COLORS.hair} strokeWidth="2" strokeLinecap="round" />

                    {/* Ojos */}
                    <g transform="translate(0, 2)">
                        {isBlinking ? (
                            <g>
                                <path d="M45 62 Q 52 66 59 62" stroke={COLORS.stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                <path d="M81 62 Q 88 66 95 62" stroke={COLORS.stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                            </g>
                        ) : (
                            <>
                                {c.eyesType === 'normal' && (
                                    <g>
                                        <ellipse cx="52" cy="62" rx="7" ry="8" fill={COLORS.white} stroke={COLORS.stroke} strokeWidth="2" />
                                        <circle cx="53" cy="63" r="3.5" fill={COLORS.eyes} />
                                        <circle cx="55" cy="61" r="1.5" fill={COLORS.white} />
                                        <path d="M45 58 Q 43 55 42 52" stroke={COLORS.stroke} strokeWidth="2" fill="none" />

                                        <ellipse cx="88" cy="62" rx="7" ry="8" fill={COLORS.white} stroke={COLORS.stroke} strokeWidth="2" />
                                        <circle cx="87" cy="63" r="3.5" fill={COLORS.eyes} />
                                        <circle cx="85" cy="61" r="1.5" fill={COLORS.white} />
                                        <path d="M95 58 Q 97 55 98 52" stroke={COLORS.stroke} strokeWidth="2" fill="none" />
                                    </g>
                                )}
                                {c.eyesType === 'happy' && (
                                    <g>
                                        <path d="M45 62 Q 52 56 59 62" stroke={COLORS.stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                        <path d="M81 62 Q 88 56 95 62" stroke={COLORS.stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                    </g>
                                )}
                                {c.eyesType === 'wink' && (
                                    <g>
                                        <path d="M45 62 Q 52 56 59 62" stroke={COLORS.stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                        <ellipse cx="88" cy="62" rx="7" ry="8" fill={COLORS.white} stroke={COLORS.stroke} strokeWidth="2" />
                                        <circle cx="87" cy="63" r="3.5" fill={COLORS.eyes} />
                                    </g>
                                )}
                                {c.eyesType === 'wide' && (
                                    <g>
                                        <ellipse cx="52" cy="62" rx="8" ry="9" fill={COLORS.white} stroke={COLORS.stroke} strokeWidth="2" />
                                        <circle cx="52" cy="62" r="3" fill={COLORS.eyes} />
                                        <ellipse cx="88" cy="62" rx="8" ry="9" fill={COLORS.white} stroke={COLORS.stroke} strokeWidth="2" />
                                        <circle cx="88" cy="62" r="3" fill={COLORS.eyes} />
                                    </g>
                                )}
                                {c.eyesType === 'sparkle' && (
                                    <g>
                                        <ellipse cx="52" cy="62" rx="7" ry="8" fill={COLORS.white} stroke={COLORS.stroke} strokeWidth="2" />
                                        <circle cx="53" cy="63" r="3.5" fill={COLORS.eyes} />
                                        <path d="M43 65 L46 68 L42 67 Z" fill={COLORS.necklace} />
                                        <ellipse cx="88" cy="62" rx="7" ry="8" fill={COLORS.white} stroke={COLORS.stroke} strokeWidth="2" />
                                        <circle cx="87" cy="63" r="3.5" fill={COLORS.eyes} />
                                        <path d="M97 65 L94 68 L98 67 Z" fill={COLORS.necklace} />
                                    </g>
                                )}
                            </>
                        )}
                    </g>

                    {/* Nariz */}
                    <path d="M68 75 Q 70 78 72 75" fill="none" stroke={COLORS.skinShadow} strokeWidth="2" strokeLinecap="round" />

                    {/* Boca — el translate va en el grupo externo y la animación de habla en el interno
                        para que el movimiento de boca NO sobreescriba la posición (la boca ya no desaparece). */}
                    <g transform="translate(70, 85)" className="zara-face-transition">
                        <g className={cn(isTalking ? "zara-mouth-talk" : "")}>
                            {c.mouth === 'smile' && (
                                <path d="M-6 -2 Q 0 4 6 -2" fill="none" stroke={COLORS.lips} strokeWidth="2.5" strokeLinecap="round" />
                            )}
                            {c.mouth === 'big' && (
                                <path d="M-8 -2 Q 0 10 8 -2" fill={COLORS.white} stroke={COLORS.lips} strokeWidth="2" />
                            )}
                            {c.mouth === 'smirk' && (
                                <path d="M-6 0 Q 2 -2 6 -4" fill="none" stroke={COLORS.lips} strokeWidth="2.5" strokeLinecap="round" />
                            )}
                            {c.mouth === 'o' && (
                                <circle cx="0" cy="0" r="3" fill={COLORS.stroke} />
                            )}
                            {c.mouth === 'open' && (
                                <circle cx="0" cy="0" r="5" fill={COLORS.stroke} />
                            )}
                        </g>
                    </g>
                </g>
                </g>

                {/* Pantalón plano — re-pintado por encima del filtro para que no reciba luz clave/rim */}
                <rect x="45" y="200" width="22" height="110" rx="2" fill={COLORS.pants} />
                <rect x="73" y="200" width="22" height="110" rx="2" fill={COLORS.pants} />
            </svg>
        </div>
    );
};

export default ZaraVexCharacter;
