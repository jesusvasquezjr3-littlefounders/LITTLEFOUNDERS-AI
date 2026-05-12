import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, AlertCircle, Coins, ShieldAlert, Award, Star, PiggyBank, Target, Zap, CreditCard, Flame, XCircle } from 'lucide-react';

interface GameObject {
    id: number;
    x: number;
    y: number;
    speed: number;
    type: 'obstacle' | 'powerup';
    subtype: number; // to select between different labels
}

export function CompoundInterestRunner() {
    const { t } = useTranslation('landing');
    
    // Game State
    const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
    const [score, setScore] = useState(1000); // Capital inicial
    const [timeElapsed, setTimeElapsed] = useState(60);

    // Refs for animation
    const requestRef = useRef<number>();
    const lastTimeRef = useRef<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Game objects refs
    const objectsRef = useRef<GameObject[]>([]);
    const playerXRef = useRef<number>(50); // % width
    const playerYRef = useRef<number>(85); // % height
    const scoreRef = useRef<number>(1000);
    
    // Spawn timers
    const nextSpawnRef = useRef<number>(0);

    // Floating texts for feedback
    const [floatingTexts, setFloatingTexts] = useState<{id: number, x: number, y: number, text: string, type: 'positive' | 'negative'}[]>([]);
    const textIdRef = useRef(0);

    const startGame = () => {
        setGameState('playing');
        setScore(1000);
        scoreRef.current = 1000;
        setTimeElapsed(60);
        objectsRef.current = [];
        lastTimeRef.current = performance.now();
        requestRef.current = requestAnimationFrame(gameLoop);
        setFloatingTexts([]);
    };

    const addFloatingText = (x: number, y: number, text: string, type: 'positive' | 'negative') => {
        const id = textIdRef.current++;
        setFloatingTexts(prev => [...prev, { id, x, y, text, type }]);
        setTimeout(() => {
            setFloatingTexts(prev => prev.filter(ft => ft.id !== id));
        }, 800);
    };

    const gameLoop = useCallback((time: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = time;
        const deltaTime = (time - lastTimeRef.current) / 1000; // in seconds
        lastTimeRef.current = time;

        const containerW = containerRef.current?.offsetWidth || 300;
        const containerH = containerRef.current?.offsetHeight || 600;
        
        // Base speed increases over time
        const difficultyMultiplier = 1 + ((60 - timeElapsed) / 60); // Takes 1 minute to double speed
        const baseSpeed = 180 * difficultyMultiplier; // pixels per second, much slower for readability

        // Spawn logic
        if (time > nextSpawnRef.current) {
            const isPowerup = Math.random() > 0.6; // 40% chance of powerup
            objectsRef.current.push({
                id: Math.random(),
                x: 10 + Math.random() * 80, // 10% to 90%
                y: -10, // above screen
                speed: baseSpeed * (0.8 + Math.random() * 0.4), // slight speed variation
                type: isPowerup ? 'powerup' : 'obstacle',
                subtype: Math.floor(Math.random() * 6) + 1
            });
            nextSpawnRef.current = time + (1000 / difficultyMultiplier); // Spawn faster over time
        }

        // Update objects & Check collisions
        const playerX_px = (playerXRef.current / 100) * containerW;
        const playerY_px = (playerYRef.current / 100) * containerH; 
        const playerRadius = 25; // Hitbox

        for (let i = objectsRef.current.length - 1; i >= 0; i--) {
            const obj = objectsRef.current[i];
            obj.y += obj.speed * deltaTime;

            // Collision check
            const objX_px = (obj.x / 100) * containerW;
            const objY_px = obj.y;
            const objRadius = 30; // Hitbox

            const dx = objX_px - playerX_px;
            const dy = objY_px - playerY_px;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < playerRadius + objRadius) {
                // Collision Hit!
                if (obj.type === 'powerup') {
                    const gain = Math.floor(scoreRef.current * 0.05) + 100; // Compounding gain
                    scoreRef.current += gain;
                    addFloatingText(obj.x, (obj.y / containerH) * 100, t('minigame.gain', { amount: gain.toLocaleString() }), 'positive');
                } else {
                    const loss = Math.floor(scoreRef.current * 0.1) + 50; // Penalty
                    scoreRef.current -= loss;
                    addFloatingText(obj.x, (obj.y / containerH) * 100, t('minigame.loss', { amount: loss.toLocaleString() }), 'negative');
                }
                
                objectsRef.current.splice(i, 1);
                
                if (scoreRef.current <= 0) {
                    scoreRef.current = 0;
                    setGameState('gameover');
                }
                setScore(scoreRef.current);
                continue;
            }

            // Remove out of bounds
            if (obj.y > containerH + 50) {
                objectsRef.current.splice(i, 1);
            }
        }

        // Auto-increment capital slightly over time (passive interest)
        setTimeElapsed(prev => {
            const newTime = Math.max(0, prev - deltaTime);
            if (Math.floor(prev) > Math.floor(newTime) && newTime > 0) {
                scoreRef.current += 10;
                setScore(scoreRef.current);
            }
            if (newTime <= 0) { // Time's up!
                 setGameState('gameover');
            }
            return newTime;
        });

        if (gameState === 'playing' && scoreRef.current > 0) {
            // Re-render
            setScore(scoreRef.current); // Force re-render for positions
            requestRef.current = requestAnimationFrame(gameLoop);
        }
    }, [gameState]);

    useEffect(() => {
        if (gameState === 'playing') {
            requestRef.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [gameState, gameLoop]);

    // Handle interaction
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
        if (gameState !== 'playing' || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as React.MouseEvent).clientY;
        const xPos = ((clientX - rect.left) / rect.width) * 100;
        const yPos = ((clientY - rect.top) / rect.height) * 100;
        playerXRef.current = Math.max(5, Math.min(95, xPos));
        playerYRef.current = Math.max(5, Math.min(95, yPos));
    };

    return (
        <div 
            ref={containerRef}
            className="relative w-full h-[500px] md:h-[600px] overflow-hidden cursor-crosshair touch-none select-none"
            onPointerMove={handlePointerMove}
            onMouseMove={handlePointerMove}
        >
            {/* Organic Background Gradient */}
            <div className="absolute inset-0 z-0 pointer-events-none"
                 style={{ 
                     background: 'radial-gradient(ellipse at center, rgba(236,72,153,0.08) 0%, rgba(168,85,247,0.08) 30%, transparent 70%)' 
                 }} 
            />
            
            {/* Grid Pattern */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
                 style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0, 0, 0, .3) 25%, rgba(0, 0, 0, .3) 26%, transparent 27%, transparent 74%, rgba(0, 0, 0, .3) 75%, rgba(0, 0, 0, .3) 76%, transparent 77%, transparent)', backgroundSize: '50px 50px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)' }} />

            {/* HUD */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
                <div className="liquid-glass px-4 py-2 rounded-xl border border-white/20 flex flex-col justify-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">{t('minigame.time_label')}</span>
                    <span className="text-lg font-black text-gray-900 dark:text-white">{t('minigame.seconds_unit', { time: Math.floor(timeElapsed) })}</span>
                </div>
                <div className="liquid-glass px-4 py-2 rounded-xl border border-pink-500/30 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-yellow-500" />
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">{t('minigame.score_label')}</span>
                        <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">
                            {t('minigame.currency', { amount: Math.floor(score).toLocaleString() })}
                        </span>
                    </div>
                </div>
            </div>

            {/* In-Game Objects */}
            {gameState === 'playing' && objectsRef.current.map(obj => (
                <div 
                    key={obj.id}
                    className={`absolute flex flex-col items-center justify-center transform -translate-x-1/2 -translate-y-1/2 transition-none`}
                    style={{ left: `${obj.x}%`, top: `${obj.y}px` }}
                >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md border ${
                        obj.type === 'powerup' 
                        ? 'bg-green-500/20 border-green-500/40 text-green-600 dark:text-green-400 shadow-green-500/20' 
                        : 'bg-red-500/20 border-red-500/40 text-red-600 dark:text-red-400 shadow-red-500/20'
                    }`}>
                        {obj.type === 'powerup' && obj.subtype === 1 && <TrendingUp className="w-7 h-7" />}
                        {obj.type === 'powerup' && obj.subtype === 2 && <Award className="w-7 h-7" />}
                        {obj.type === 'powerup' && obj.subtype === 3 && <Star className="w-7 h-7" />}
                        {obj.type === 'powerup' && obj.subtype === 4 && <PiggyBank className="w-7 h-7" />}
                        {obj.type === 'powerup' && obj.subtype === 5 && <Target className="w-7 h-7" />}
                        {obj.type === 'powerup' && obj.subtype === 6 && <Zap className="w-7 h-7" />}
                        
                        {obj.type === 'obstacle' && obj.subtype === 1 && <AlertCircle className="w-7 h-7" />}
                        {obj.type === 'obstacle' && obj.subtype === 2 && <ShieldAlert className="w-7 h-7" />}
                        {obj.type === 'obstacle' && obj.subtype === 3 && <CreditCard className="w-7 h-7" />}
                        {obj.type === 'obstacle' && obj.subtype === 4 && <Flame className="w-7 h-7" />}
                        {obj.type === 'obstacle' && obj.subtype === 5 && <TrendingUp className="w-7 h-7 rotate-180" />}
                        {obj.type === 'obstacle' && obj.subtype === 6 && <XCircle className="w-7 h-7" />}
                    </div>
                    <span className={`text-[12px] font-extrabold mt-2 px-3 py-1 rounded-full whitespace-nowrap bg-white/95 dark:bg-slate-800/95 shadow-lg border border-white/20 ${
                        obj.type === 'powerup' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                    }`}>
                        {obj.type === 'powerup' ? t(`minigame.powerup_${obj.subtype}`) : t(`minigame.obstacle_${obj.subtype}`)}
                    </span>
                </div>
            ))}

            {/* Player Character */}
            {(gameState === 'playing' || gameState === 'gameover') && (
                <div 
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-none z-10 pointer-events-none"
                    style={{ left: `${playerXRef.current}%`, top: `${playerYRef.current}%` }}
                >
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl flex items-center justify-center border-2 border-pink-500 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-pink-500/20 to-transparent" />
                        <span className="text-2xl animate-bounce">🏃</span>
                    </div>
                </div>
            )}

            {/* Floating Combat Text */}
            {floatingTexts.map(ft => (
                <div 
                    key={ft.id} 
                    className={`absolute text-xl font-black transform -translate-x-1/2 -translate-y-1/2 animate-slide-up pointer-events-none z-30 ${
                        ft.type === 'positive' ? 'text-green-500 drop-shadow-[0_2px_4px_rgba(34,197,94,0.3)]' : 'text-red-500 drop-shadow-[0_2px_4px_rgba(239,68,68,0.3)]'
                    }`}
                    style={{ left: `${ft.x}%`, top: `${ft.y - 10}%` }}
                >
                    {ft.text}
                </div>
            ))}

            {/* Idle Area Overlay */}
            {gameState === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-40 bg-white/5 dark:bg-black/5 backdrop-blur-[2px]">
                    <div className="liquid-glass p-8 rounded-3xl text-center max-w-sm mx-4 transform transition-all duration-500 hover:scale-105">
                        <div className="w-16 h-16 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-pink-500/30 mb-6">
                            <TrendingUp className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-black mb-2 text-gray-900 dark:text-white">
                            {t('minigame.title')}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-8 text-sm">
                            {t('minigame.instruction')}
                        </p>
                        <button 
                            onClick={startGame}
                            className="w-full py-4 px-6 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-orange-500/25 transition-all transform hover:-translate-y-1"
                        >
                            {t('minigame.start')}
                        </button>
                    </div>
                </div>
            )}

            {/* Game Over Screen */}
            {gameState === 'gameover' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-40 animate-fade-in bg-white/5 dark:bg-black/5 backdrop-blur-[4px]">
                    <div className="liquid-glass p-10 rounded-3xl text-center max-w-md mx-4 animate-bounce-in border border-gray-200/50 dark:border-white/20 shadow-2xl">
                        <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl ${
                            score > 1500 ? 'bg-gradient-to-tr from-green-400 to-emerald-600 shadow-green-500/30' : 'bg-gradient-to-tr from-red-400 to-rose-600 shadow-red-500/30'
                        }`}>
                            <span className="text-4xl">{score > 1500 ? '🚀' : '💥'}</span>
                        </div>
                        
                        <h3 className="text-3xl font-black mb-1 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                            {t('minigame.game_over')}
                        </h3>
                        
                        <div className="my-8 space-y-2">
                            <p className="text-gray-500 dark:text-gray-300 font-medium uppercase tracking-widest text-sm">
                                {t('minigame.final_capital')}
                            </p>
                            <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-400 dark:from-green-400 dark:to-emerald-300">
                                {t('minigame.currency', { amount: Math.floor(score).toLocaleString() })}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-medium">
                                {t('minigame.time_label')} {t('minigame.seconds_unit', { time: Math.floor(timeElapsed) })}
                            </p>
                        </div>
                        
                        <button 
                            onClick={startGame}
                            className="w-full py-4 px-6 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-pink-500/25 transition-all transform hover:scale-105"
                        >
                            {t('minigame.play_again')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CompoundInterestRunner;
