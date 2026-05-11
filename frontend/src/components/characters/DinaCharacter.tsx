import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface DinaCharacterProps {
    expression?: 'neutral' | 'happy' | 'surprised' | 'wink';
    className?: string;
    enableMouseTracking?: boolean;
    showBubble?: boolean;
    currentText?: string;
    bubblePosition?: 'top' | 'standard';
    isTalking?: boolean;
}

/**
 * Dina — The friendly orange stegosaurus.
 * Original SVG artwork preserved. Enhanced with Lottie-style animations:
 * smooth blink, spring-physics mouse tracking, idle breathing, tail wag.
 */
export const DinaCharacter: React.FC<DinaCharacterProps> = ({
    expression = 'neutral',
    className = '',
    enableMouseTracking = true,
    showBubble = false,
    currentText = '',
    bubblePosition = 'top',
    isTalking = false
}) => {
    const headRef = useRef<SVGGElement>(null);
    const pupilLRef = useRef<SVGGElement>(null);
    const pupilRRef = useRef<SVGGElement>(null);

    const [currentExpression, setCurrentExpression] = useState(expression);
    const [isBlinking, setIsBlinking] = useState(false);
    const [clickPulse, setClickPulse] = useState(0);

    // ── Smooth mouse tracking (spring-like) ───────────────────────────────
    const targetPupil = useRef({ x: 0, y: 0 });
    const currentPupil = useRef({ x: 0, y: 0 });
    const targetHead = useRef({ rot: 0, x: 0, y: 0 });
    const currentHead = useRef({ rot: 0, x: 0, y: 0 });
    const rafId = useRef<number | null>(null);

    useEffect(() => {
        setCurrentExpression(expression);
    }, [expression]);

    // Expression configuration
    const getExpressionConfig = (expr: string) => {
        const config = {
            eyeOpacity: 1,
            eyeClosedOpacity: 0,
            pupilOpacity: 1,
            lashesTransform: "translate(0,0)",
            eyeRadius: 20,
            eyeClosedPath: "M-18 0 Q 0 6 18 0",
            mouthPath: "M5 25 Q 15 32 25 25",
            browLTransform: "translate(0, 0)",
            browRTransform: "translate(0, 0)",
            surprisedLashes: false
        };
        switch (expr) {
            case 'happy':
                return {
                    ...config,
                    eyeOpacity: 0,
                    eyeClosedOpacity: 1,
                    pupilOpacity: 0,
                    eyeClosedPath: "M-18 0 Q 0 -14 18 0",
                    mouthPath: "M-5 25 Q 15 42 35 25",
                    browLTransform: "translate(0, -6)",
                    browRTransform: "translate(0, -6)",
                    lashesTransform: "translate(-2, 6) rotate(-15)",
                };
            case 'surprised':
                return {
                    ...config,
                    eyeRadius: 24,
                    mouthPath: "M10 38 A 8 8 0 1 0 20 38 A 8 8 0 1 0 10 38",
                    browLTransform: "translate(0, -12) rotate(-10)",
                    browRTransform: "translate(0, -12) rotate(10)",
                    surprisedLashes: true
                };
            case 'wink':
                return {
                    ...config,
                    mouthPath: "M5 25 Q 15 35 20 28",
                    blinkRight: true
                };
            default:
                return config;
        }
    };

    const config = getExpressionConfig(currentExpression);

    // ── Blinking (smooth, React-driven) ───────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            if (currentExpression === 'neutral' || currentExpression === 'surprised') {
                setIsBlinking(true);
                setTimeout(() => setIsBlinking(false), 160);
            }
        }, 4000 + Math.random() * 1000);
        return () => clearInterval(interval);
    }, [currentExpression]);

    // ── Mouse tracking with spring physics ────────────────────────────────
    useEffect(() => {
        if (!enableMouseTracking) return;

        const handleMouseMove = (e: MouseEvent) => {
            const x = (e.clientX / window.innerWidth) - 0.5;
            const y = (e.clientY / window.innerHeight) - 0.5;
            targetPupil.current = { x: x * 14, y: y * 14 };
            targetHead.current = { rot: x * 7, x: x * 4, y: y * 3 };
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [enableMouseTracking]);

    // Animation loop for smooth interpolation
    useEffect(() => {
        if (!enableMouseTracking) return;

        const animate = () => {
            const spring = 0.12;
            currentPupil.current.x += (targetPupil.current.x - currentPupil.current.x) * spring;
            currentPupil.current.y += (targetPupil.current.y - currentPupil.current.y) * spring;
            currentHead.current.rot += (targetHead.current.rot - currentHead.current.rot) * spring;
            currentHead.current.x += (targetHead.current.x - currentHead.current.x) * spring;
            currentHead.current.y += (targetHead.current.y - currentHead.current.y) * spring;

            if (pupilLRef.current) {
                pupilLRef.current.style.transform = `translate(${currentPupil.current.x}px, ${currentPupil.current.y}px)`;
            }
            if (pupilRRef.current) {
                pupilRRef.current.style.transform = `translate(${currentPupil.current.x}px, ${currentPupil.current.y}px)`;
            }
            if (headRef.current) {
                headRef.current.style.transform = `translate(${360 + currentHead.current.x}px, ${110 + currentHead.current.y}px) rotate(${currentHead.current.rot}deg)`;
            }

            rafId.current = requestAnimationFrame(animate);
        };

        rafId.current = requestAnimationFrame(animate);
        return () => {
            if (rafId.current) cancelAnimationFrame(rafId.current);
        };
    }, [enableMouseTracking]);

    // Reset head when tracking disabled
    useEffect(() => {
        if (!enableMouseTracking && headRef.current) {
            headRef.current.style.transform = `translate(360px, 110px) rotate(0deg)`;
        }
    }, [enableMouseTracking]);

    // Lash transforms
    const leftLashTransform = (() => {
        if (isBlinking) return 'translate(0, 10)';
        if (currentExpression === 'happy') return 'translate(-2, 6) rotate(-15)';
        if (currentExpression === 'surprised') return 'scale(1.15) translate(-3, -3)';
        return 'translate(0,0)';
    })();

    const rightLashTransform = (() => {
        if (isBlinking) return 'translate(0, 10)';
        if (currentExpression === 'happy') return 'translate(2, 6) rotate(15)';
        if (currentExpression === 'wink') return 'translate(0, 10)';
        if (currentExpression === 'surprised') return 'scale(1.15) translate(3, -3)';
        return 'translate(0,0)';
    })();

    const rightEyeOpen = isBlinking ? false : (currentExpression === 'wink' ? false : (config.eyeOpacity === 1));
    const rightEyeClosed = isBlinking ? true : (currentExpression === 'wink' ? true : (config.eyeClosedOpacity === 1));
    const rightEyeClosedPath = currentExpression === 'wink' ? 'M-18 0 Q 0 10 18 0' : (isBlinking ? 'M-18 0 Q 0 6 18 0' : config.eyeClosedPath);
    const leftEyeClosedPath = isBlinking ? 'M-18 0 Q 0 6 18 0' : config.eyeClosedPath;
    const leftEyeOpen = isBlinking ? false : (config.eyeOpacity === 1);
    const leftEyeClosed = isBlinking ? true : (config.eyeClosedOpacity === 1);

    const handleClick = useCallback(() => {
        setClickPulse(p => p + 1);
    }, []);

    return (
        <div
            className={cn("scene relative w-full h-full flex flex-col justify-end items-center cursor-pointer select-none", className)}
            style={{ willChange: "transform" }}
            onClick={handleClick}
        >
            {/* Speech Bubble */}
            {showBubble && (
                <div className={cn(
                    "absolute z-20 transition-all duration-300 ease-out",
                    bubblePosition === 'standard' && "bottom-full mb-2 left-1/2 -translate-x-1/2",
                    bubblePosition === 'top' && "bottom-full mb-2 left-1/2 -translate-x-1/2",
                    showBubble ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2 pointer-events-none"
                )}>
                    <div className="relative bg-white rounded-2xl shadow-lg px-4 py-2 border border-slate-100 min-w-[180px] max-w-[240px] w-auto text-center">
                        <p className="text-slate-700 font-bold text-xs leading-snug">
                            {currentText}
                        </p>
                        <svg className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] w-4 h-2.5" viewBox="0 0 20 12" fill="none">
                            <path d="M0 0C3.5 0 7 8 10 12C13 8 16.5 0 20 0H0Z" fill="white" />
                            <path d="M0 0C3.5 0 7 8 10 12C13 8 16.5 0 20 0" stroke="#e2e8f0" strokeWidth="2" />
                        </svg>
                    </div>
                </div>
            )}
            <style>{`
                .dina-breathe { animation: dinaBreatheAnim 4s ease-in-out infinite; transform-origin: center bottom; }
                @keyframes dinaBreatheAnim { 0%, 100% { transform: scale(1) translateY(0); } 50% { transform: scale(1.015) translateY(-2px); } }
                .dina-tail-anim { animation: dinaTailWag 3.5s ease-in-out infinite alternate; transform-origin: 150px 300px; }
                @keyframes dinaTailWag { 0% { transform: rotate(-8deg); } 100% { transform: rotate(12deg); } }
                .dina-neck-sway { animation: dinaNeckSway 5s ease-in-out infinite alternate; transform-origin: 280px 280px; }
                @keyframes dinaNeckSway { 0% { transform: rotate(-2deg); } 100% { transform: rotate(4deg); } }
                .dina-face-element { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
                .dina-mouth-talk { animation: dinaTalkAnim 0.45s ease-in-out infinite; transform-origin: center; }
                @keyframes dinaTalkAnim {
                    0%, 100% { transform: scaleY(1) translateY(0); }
                    30% { transform: scaleY(0.8) translateY(1px); }
                    60% { transform: scaleY(1.15) translateY(-1px); }
                }
                .dina-spring-bounce { animation: dinaSpring 0.6s cubic-bezier(0.34, 1.8, 0.64, 1); transform-origin: center bottom; }
                @keyframes dinaSpring {
                    0% { transform: scale(1) translateY(0); }
                    25% { transform: scale(0.95, 1.05) translateY(3px); }
                    50% { transform: scale(1.06, 0.96) translateY(-10px); }
                    75% { transform: scale(0.98, 1.02) translateY(2px); }
                    100% { transform: scale(1) translateY(0); }
                }
            `}</style>

            <svg
                id="dina-svg"
                viewBox="0 0 550 550"
                xmlns="http://www.w3.org/2000/svg"
                className={cn(
                    "w-full h-full object-contain",
                    clickPulse > 0 && "dina-spring-bounce"
                )}
            >
                <defs>
                    <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: "#fb923c" }} />
                        <stop offset="100%" style={{ stopColor: "#f97316" }} />
                    </linearGradient>
                    <radialGradient id="blushGrad">
                        <stop offset="0%" style={{ stopColor: "#fb7185", stopOpacity: 0.5 }} />
                        <stop offset="100%" style={{ stopColor: "#fb7185", stopOpacity: 0 }} />
                    </radialGradient>
                    <linearGradient id="plateGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{ stopColor: "#fef3c7" }} />
                        <stop offset="100%" style={{ stopColor: "#fde047" }} />
                    </linearGradient>
                    <filter id="dinaShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feOffset in="SourceAlpha" dx="5" dy="7" result="offset" />
                        <feGaussianBlur in="offset" stdDeviation="1.5" result="blur" />
                        <feFlood floodColor="#9A3412" floodOpacity="0.35" result="color" />
                        <feComposite in="color" in2="blur" operator="in" result="shadow" />
                        <feMerge>
                            <feMergeNode in="shadow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <g filter="url(#dinaShadow)">
                <g className="dina-breathe">
                    {/* GRUPO COLA */}
                    <g className="dina-tail-anim">
                        <path d="M40 160 Q 30 130 50 145" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1" />
                        <path d="M65 200 Q 55 170 80 185" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1" />
                        <path d="M95 250 Q 85 220 115 240" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1" />
                        <path d="M140 310 Q 20 290 30 180 Q 35 130 65 130 Q 60 180 85 220 Q 110 280 150 300 Z" fill="#f97316" />
                    </g>

                    {/* PATAS FONDO */}
                    <g transform="translate(150, 315)">
                        <rect x="0" y="0" width="42" height="80" rx="21" fill="#c2410c" />
                        <circle cx="10" cy="74" r="4" fill="#fdba74" opacity="0.6" />
                        <circle cx="21" cy="77" r="4" fill="#fdba74" opacity="0.6" />
                        <circle cx="32" cy="74" r="4" fill="#fdba74" opacity="0.6" />
                    </g>
                    <g transform="translate(290, 315)">
                        <rect x="0" y="0" width="40" height="80" rx="20" fill="#c2410c" />
                        <circle cx="10" cy="74" r="4" fill="#fdba74" opacity="0.6" />
                        <circle cx="20" cy="77" r="4" fill="#fdba74" opacity="0.6" />
                        <circle cx="30" cy="74" r="4" fill="#fdba74" opacity="0.6" />
                    </g>

                    {/* CUERPO PRINCIPAL */}
                    <path d="M175 250 Q 190 210 215 245" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1.5" />
                    <path d="M225 240 Q 245 200 270 235" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1.5" />
                    <ellipse cx="240" cy="320" rx="105" ry="90" fill="url(#skinGrad)" />
                    <circle cx="185" cy="295" r="12" fill="#fdba74" opacity="0.4" />
                    <circle cx="215" cy="275" r="9" fill="#fdba74" opacity="0.4" />
                    <circle cx="170" cy="330" r="7" fill="#fdba74" opacity="0.3" />
                    <circle cx="270" cy="285" r="10" fill="#fdba74" opacity="0.3" />
                    <circle cx="240" cy="265" r="6" fill="#fdba74" opacity="0.4" />

                    {/* PANZA */}
                    <ellipse cx="240" cy="340" rx="80" ry="60" fill="#ffedd5" opacity="0.4" />

                    {/* PATAS FRENTE */}
                    <g transform="translate(170, 335)">
                        <rect x="0" y="0" width="55" height="90" rx="27.5" fill="#fb923c" />
                        <circle cx="13" cy="82" r="6" fill="#ffedd5" />
                        <circle cx="27" cy="85" r="6" fill="#ffedd5" />
                        <circle cx="41" cy="82" r="6" fill="#ffedd5" />
                    </g>
                    <g transform="translate(260, 335)">
                        <rect x="0" y="0" width="52" height="90" rx="26" fill="#fb923c" />
                        <circle cx="13" cy="82" r="6" fill="#ffedd5" />
                        <circle cx="26" cy="85" r="6" fill="#ffedd5" />
                        <circle cx="39" cy="82" r="6" fill="#ffedd5" />
                    </g>

                    {/* CUELLO Y CABEZA */}
                    <g className="dina-neck-sway">
                        <path d="M315 240 Q 335 210 345 235" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1" />
                        <path d="M340 190 Q 365 160 375 195" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1" />
                        <path d="M290 280 Q 350 250 360 140" stroke="#fb923c" strokeWidth="55" fill="none" strokeLinecap="round" />

                        <g id="dina-head-group" ref={headRef} transform="translate(360, 110)">
                            <path d="M-10 -48 Q 15 -75 40 -48" fill="url(#plateGrad)" stroke="#eab308" strokeWidth="1.5" />
                            <ellipse cx="15" cy="0" rx="65" ry="55" fill="#fb923c" />
                            <circle cx="-28" cy="20" r="16" fill="url(#blushGrad)" />
                            <circle cx="58" cy="20" r="16" fill="url(#blushGrad)" />

                            <g id="eyebrows">
                                <path id="eyebrow-l" d="M-30 -35 Q -15 -42 0 -35" stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" className="dina-face-element" transform={config.browLTransform} />
                                <path id="eyebrow-r" d="M30 -35 Q 45 -42 60 -35" stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" className="dina-face-element" transform={config.browRTransform} />
                            </g>

                            <g id="eyes">
                                {/* Ojo Izquierdo */}
                                <g id="eye-l-group" transform="translate(-15, -10)" className="dina-face-element">
                                    <g id="lashes-l" className="dina-face-element" transform={leftLashTransform}>
                                        <path d="M-16 -8 Q-22 -12 -25 -5" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                        <path d="M-14 -12 Q-18 -18 -20 -10" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                        <path d="M-10 -15 Q-12 -22 -10 -15" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                    </g>
                                    <circle id="dina-eye-l-white" cx="0" cy="0" r={config.eyeRadius} fill="white" opacity={leftEyeOpen ? 1 : 0} className="dina-face-element" />
                                    <g id="dina-pupil-l" ref={pupilLRef} className="dina-face-element" opacity={leftEyeOpen ? 1 : 0}>
                                        <circle cx="2" cy="2" r="11" fill="#1e293b" />
                                        <circle cx="-3" cy="-3" r="5" fill="white" />
                                        <circle cx="4" cy="5" r="2" fill="white" opacity="0.6" />
                                    </g>
                                    <path id="dina-eye-l-closed" d={leftEyeClosedPath} stroke="#7c2d12" strokeWidth="4" fill="none" strokeLinecap="round" opacity={leftEyeClosed ? 1 : 0} className="dina-face-element" />
                                </g>

                                {/* Ojo Derecho */}
                                <g id="eye-r-group" transform="translate(45, -10)" className="dina-face-element">
                                    <g id="lashes-r" className="dina-face-element" transform={rightLashTransform}>
                                        <path d="M16 -8 Q22 -12 25 -5" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                        <path d="M14 -12 Q18 -18 20 -10" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                        <path d="M10 -15 Q12 -22 10 -15" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                                    </g>
                                    <circle id="dina-eye-r-white" cx="0" cy="0" r={config.eyeRadius} fill="white" opacity={rightEyeOpen ? 1 : 0} />
                                    <g id="dina-pupil-r" ref={pupilRRef} className="dina-face-element" opacity={rightEyeOpen ? 1 : 0}>
                                        <circle cx="2" cy="2" r="11" fill="#1e293b" />
                                        <circle cx="-3" cy="-3" r="5" fill="white" />
                                        <circle cx="4" cy="5" r="2" fill="white" opacity="0.6" />
                                    </g>
                                    <path id="dina-eye-r-closed" d={rightEyeClosedPath} stroke="#7c2d12" strokeWidth="4" fill="none" strokeLinecap="round" opacity={rightEyeClosed ? 1 : 0} className="dina-face-element" />
                                </g>
                            </g>

                            {/* BOCA */}
                            <path id="mouth-path" d={config.mouthPath} stroke="#7c2d12" strokeWidth="3" fill="none" strokeLinecap="round" className={cn("dina-face-element", isTalking ? "dina-mouth-talk" : "")} />

                            {/* NARIZ */}
                            <circle cx="25" cy="15" r="2" fill="#7c2d12" opacity="0.2" />
                            <circle cx="35" cy="15" r="2" fill="#7c2d12" opacity="0.2" />
                        </g>
                    </g>
                </g>
                </g>
            </svg>
        </div>
    );
};

export default DinaCharacter;
