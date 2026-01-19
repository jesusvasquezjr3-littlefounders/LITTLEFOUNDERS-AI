/**
 * LessonRunner - Motor de Lecciones Dinámico
 * 
 * Diseño UI/UX para LittleFounders:
 * - Header minimalista con progress bar y vidas
 * - Personaje centrado con burbuja de diálogo
 * - Opciones grandes y táctiles
 * - Botón de acción con gradiente morado-amarillo (brand colors)
 * - Modo claro/oscuro 100% compatible
 * - Mobile-first responsive
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DinoCharacter, DinoMood } from '@/components/demo/DinoCharacter';
import { DinaCharacter } from '@/components/demo/DinaCharacter';
import DrRhoCharacter, { RhoMood } from '@/components/demo/DrRhoCharacter';
import ZaraVexCharacter, { ZaraMood } from '@/components/demo/ZaraVexCharacter';
import { useLessonData, useLessonState } from './hooks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    X,
    Zap,
    Trophy,
    Star,
    Loader2,
    AlertCircle,
    Check,
    ArrowRight,
    PartyPopper,
    Volume2,
    VolumeX,
    BatteryLow
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';

interface LessonRunnerProps {
    lessonCode?: string;
}

export function LessonRunner({ lessonCode: propLessonCode }: LessonRunnerProps) {
    const params = useParams<{ lessonCode: string }>();
    const navigate = useNavigate();
    const code = propLessonCode || params.lessonCode || '';

    // Audio ref
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [audioMuted, setAudioMuted] = useState(false);

    // Fetch lesson data
    const { data, loading, error } = useLessonData(code);

    // Lesson state machine
    const {
        state,
        currentExerciseIndex,
        currentExercise,
        totalExercises,
        progress,
        results,
        startLesson,
        submitAnswer,
        nextExercise,
        retryExercise
    } = useLessonState(data);

    // Energy system (lives)
    const [lives, setLives] = useState(5);

    // UI states
    const [showSuccess, setShowSuccess] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isChecked, setIsChecked] = useState(false);
    const [localFeedback, setLocalFeedback] = useState<'none' | 'success' | 'error'>('none');

    // Classification exercise state
    const [selectedClassifications, setSelectedClassifications] = useState<Record<string, string>>({});

    // Tap action exercise state
    const [tappedItems, setTappedItems] = useState<Set<string>>(new Set());

    // Shuffle utility function (Fisher-Yates algorithm)
    const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    // Shuffled items for current exercise (memoized per exercise)
    const [shuffledItems, setShuffledItems] = useState<unknown[]>([]);
    const [shuffledOptions, setShuffledOptions] = useState<unknown[]>([]);


    // Get mood based on state (for Liruf)
    const getMood = (): DinoMood => {
        if (localFeedback === 'success') return 'excited';
        if (localFeedback === 'error') return 'thinking';
        return 'happy';
    };

    // Get expression based on state (for Dina)
    const getDinaExpression = (): 'neutral' | 'happy' | 'surprised' | 'wink' => {
        if (localFeedback === 'success') return 'happy';
        if (localFeedback === 'error') return 'surprised';
        return 'neutral';
    };

    // Get mood based on state (for Dr. Rho)
    const getRhoMood = (): RhoMood => {
        if (localFeedback === 'success') return 'wise';
        if (localFeedback === 'error') return 'surprised';
        return 'neutral';
    };

    // Get mood based on state (for Zara Vex)
    const getZaraMood = (): ZaraMood => {
        if (localFeedback === 'success') return 'excited';
        if (localFeedback === 'error') return 'curious';
        return 'happy';
    };

    // Get current character code from exercise
    const getCharacterCode = (): string => {
        return currentExercise?.character_code || 'liruf';
    };

    // Get current text to display
    const getCurrentText = (): string => {
        if (!currentExercise) return '';
        if (localFeedback === 'success' && currentExercise.feedback?.success) {
            return currentExercise.feedback.success;
        }
        if (localFeedback === 'error' && currentExercise.feedback?.error) {
            return currentExercise.feedback.error;
        }
        // Support different content types: question, instruction, transcript
        return currentExercise.content.question
            || currentExercise.content.instruction
            || currentExercise.content.transcript
            || '';
    };

    // Handle audio playback
    useEffect(() => {
        if (currentExercise?.audio?.url && state === 'PLAYING' && !audioMuted) {
            const audio = audioRef.current;
            if (audio) {
                audio.src = currentExercise.audio.url;
                audio.play().catch(console.log);
                setIsAudioPlaying(true);
            }
        }
        // If muted while playing, pause the audio
        if (audioMuted && audioRef.current) {
            audioRef.current.pause();
            setIsAudioPlaying(false);
        }
    }, [currentExercise, state, audioMuted]);

    // Handle audio end
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleEnded = () => {
            setIsAudioPlaying(false);
            if (currentExercise?.type === 'intro_narrative') {
                setTimeout(nextExercise, 500);
            }
        };

        audio.addEventListener('ended', handleEnded);
        return () => audio.removeEventListener('ended', handleEnded);
    }, [currentExercise, nextExercise]);

    // Celebration on complete
    useEffect(() => {
        if (state === 'COMPLETED') {
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 100 });
            setTimeout(() => setShowSuccess(true), 1000);
        }
    }, [state]);

    // Reset states and shuffle items when exercise changes
    useEffect(() => {
        setSelectedOption(null);
        setIsChecked(false);
        setLocalFeedback('none');
        setSelectedClassifications({});
        setTappedItems(new Set());

        // Shuffle items for current exercise to prevent predictable patterns
        if (currentExercise) {
            const items = currentExercise.content?.items || [];
            const options = currentExercise.content?.options || [];
            setShuffledItems(shuffleArray(items));
            setShuffledOptions(shuffleArray(options));
        }
    }, [currentExerciseIndex, currentExercise]);

    // Handle option selection
    const handleSelectOption = (optionId: string) => {
        if (isChecked) return;
        setSelectedOption(optionId);
    };

    // Handle check answer
    const handleCheckAnswer = () => {
        if (!selectedOption || !currentExercise) return;
        const isCorrect = submitAnswer(selectedOption);
        setIsChecked(true);
        setLocalFeedback(isCorrect ? 'success' : 'error');

        if (isCorrect) {
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
        } else {
            const newLives = lives - 1;
            setLives(newLives);
            // Check if game over
            if (newLives <= 0) {
                setTimeout(() => setShowGameOver(true), 1000);
            }
        }
    };

    // Handle classification item click
    const handleClassificationClick = (itemId: string, categoryId: string) => {
        if (isChecked) return;
        setSelectedClassifications(prev => ({
            ...prev,
            [itemId]: categoryId
        }));
    };

    // Handle check classification answer
    const handleCheckClassification = () => {
        if (!currentExercise) return;
        const correctClassifications = currentExercise.correct_answer?.classifications || {};
        const allItems = currentExercise.content.items || [];

        // Check if all items are classified correctly
        const isCorrect = allItems.every((item: { id: string }) =>
            selectedClassifications[item.id] === correctClassifications[item.id]
        );

        setIsChecked(true);
        setLocalFeedback(isCorrect ? 'success' : 'error');
        submitAnswer(selectedClassifications);

        if (isCorrect) {
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
        } else {
            const newLives = lives - 1;
            setLives(newLives);
            if (newLives <= 0) {
                setTimeout(() => setShowGameOver(true), 1000);
            }
        }
    };

    // Handle tap item
    const handleTapItem = (itemId: string) => {
        if (isChecked) return;
        setTappedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            return newSet;
        });
    };

    // Handle check tap answer
    const handleCheckTapAnswer = () => {
        if (!currentExercise) return;

        // Get target IDs from items array (items with isTarget: true)
        const items = (currentExercise.content as { items?: Array<{ id: string; isTarget?: boolean }> }).items || [];
        const targetIds = new Set(items.filter(item => item.isTarget === true).map(item => item.id));

        // Also support legacy correct_answer.targetIds format
        const legacyTargetIds = currentExercise.correct_answer?.targetIds as string[] | undefined;
        if (legacyTargetIds && legacyTargetIds.length > 0) {
            legacyTargetIds.forEach(id => targetIds.add(id));
        }

        const isCorrect =
            tappedItems.size === targetIds.size &&
            [...tappedItems].every(id => targetIds.has(id));

        setIsChecked(true);
        setLocalFeedback(isCorrect ? 'success' : 'error');
        submitAnswer([...tappedItems]);

        if (isCorrect) {
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
        } else {
            const newLives = lives - 1;
            setLives(newLives);
            if (newLives <= 0) {
                setTimeout(() => setShowGameOver(true), 1000);
            }
        }
    };

    // Handle continue after answer
    const handleContinue = () => {
        if (localFeedback === 'error') {
            // Reset para reintentar
            setSelectedOption(null);
            setIsChecked(false);
            setLocalFeedback('none');
            retryExercise(); // Resetear estado del hook también
        } else if (localFeedback === 'success') {
            // Avanzar al siguiente ejercicio
            nextExercise();
        }
    };

    // Close lesson
    const handleClose = () => navigate(-1);

    // ============ LOADING STATE ============
    if (loading) {
        return (
            <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
                <p className="text-lg text-muted-foreground font-medium">Cargando lección...</p>
            </div>
        );
    }

    // ============ ERROR STATE ============
    if (error || !data) {
        return (
            <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 p-6">
                <AlertCircle className="w-16 h-16 text-destructive" />
                <p className="text-lg text-destructive font-medium text-center">
                    {error || 'Error al cargar la lección'}
                </p>
                <Button variant="outline" onClick={handleClose} className="mt-4">
                    Volver
                </Button>
            </div>
        );
    }

    // ============ IDLE STATE - START SCREEN ============
    if (state === 'IDLE') {
        return (
            <div className="fixed inset-0 bg-gradient-to-b from-primary/10 via-background to-background flex flex-col">
                <audio ref={audioRef} preload="auto" />

                {/* Header */}
                <div className="flex items-center justify-between p-4">
                    <button
                        onClick={handleClose}
                        className="w-10 h-10 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <span className="text-sm font-medium text-muted-foreground">
                        {data.lesson.saga}
                    </span>
                    <div className="w-10" /> {/* Spacer */}
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
                    {/* Character - Use first exercise's character_code */}
                    <div className="mb-8 animate-bounce-in">
                        {data.timeline[0]?.character_code === 'dina' ? (
                            <DinaCharacter
                                className="w-full max-w-[280px]"
                                expression="happy"
                            />
                        ) : data.timeline[0]?.character_code === 'dr_rho' ? (
                            <DrRhoCharacter
                                className="w-full max-w-[280px]"
                                mood="wise"
                            />
                        ) : data.timeline[0]?.character_code === 'zara_vex' ? (
                            <ZaraVexCharacter
                                className="w-full max-w-[280px]"
                                mood="happy"
                            />
                        ) : (
                            <DinoCharacter
                                className="w-full max-w-[280px]"
                                showBubble={false}
                                mood="excited"
                            />
                        )}
                    </div>

                    {/* Lesson Info */}
                    <div className="text-center max-w-sm">
                        <h1 className="text-3xl font-bold text-foreground mb-3">
                            {data.lesson.title}
                        </h1>
                        <p className="text-muted-foreground mb-6">
                            {data.lesson.description}
                        </p>

                        {/* Rewards */}
                        <div className="flex justify-center gap-4 mb-8">
                            <div className="flex items-center gap-2 bg-yellow-500/10 dark:bg-yellow-500/20 px-4 py-2 rounded-full">
                                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                                <span className="font-bold text-yellow-600 dark:text-yellow-400">
                                    {data.meta.points_reward} pts
                                </span>
                            </div>
                            <div className="flex items-center gap-2 bg-purple-500/10 dark:bg-purple-500/20 px-4 py-2 rounded-full">
                                <Trophy className="w-5 h-5 text-purple-500" />
                                <span className="font-bold text-purple-600 dark:text-purple-400">
                                    {data.meta.xp_reward} XP
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Start Button - LittleFounders Brand Gradient */}
                    <Button
                        onClick={startLesson}
                        size="lg"
                        className="w-full max-w-sm h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                    >
                        EMPEZAR
                    </Button>
                </div>
            </div>
        );
    }

    // ============ ACTIVE LESSON ============
    const correctId = currentExercise?.correct_answer?.correctOptionId;
    const exerciseNumber = `${currentExerciseIndex + 1}/${totalExercises}`;

    return (
        <div className="fixed inset-0 bg-background flex flex-col">
            <audio ref={audioRef} preload="auto" />

            {/* ===== TOP BAR ===== */}
            <div className="flex items-center gap-3 p-4 pb-2">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="w-9 h-9 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
                >
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Progress Bar */}
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out relative"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                    </div>
                </div>

                {/* Exercise Counter */}
                <span className="text-sm font-bold text-muted-foreground min-w-[40px] text-center">
                    {exerciseNumber}
                </span>

                {/* Energy (formerly Lives) */}
                <div className="flex items-center gap-1 bg-yellow-500/10 dark:bg-yellow-500/20 px-3 py-1.5 rounded-full">
                    <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{lives}</span>
                </div>

                {/* Audio Toggle */}
                <button
                    onClick={() => setAudioMuted(!audioMuted)}
                    className="w-9 h-9 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                >
                    {audioMuted ? (
                        <VolumeX className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <Volume2 className="w-4 h-4 text-muted-foreground" />
                    )}
                </button>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-2 overflow-y-auto min-h-0">

                {/* Speech Bubble - ADAPTIVE */}
                <div className="w-full flex justify-center lesson-mb-sm flex-shrink-0">
                    <div className="relative bg-card rounded-xl shadow-sm border border-border lesson-speech mx-2">
                        <p className="text-center font-medium text-foreground leading-snug">
                            {getCurrentText()}
                        </p>
                        {/* Tail */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                            <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-card" />
                        </div>
                    </div>
                </div>

                {/* Character - ADAPTIVE: scales with viewport height */}
                <div className="lesson-mb-sm flex-shrink-0">
                    {getCharacterCode() === 'dina' ? (
                        <DinaCharacter
                            className="lesson-character mx-auto"
                            expression={getDinaExpression()}
                        />
                    ) : getCharacterCode() === 'dr_rho' ? (
                        <DrRhoCharacter
                            className="lesson-character mx-auto"
                            mood={getRhoMood()}
                        />
                    ) : getCharacterCode() === 'zara_vex' ? (
                        <ZaraVexCharacter
                            className="lesson-character mx-auto"
                            mood={getZaraMood()}
                        />
                    ) : (
                        <DinoCharacter
                            className="lesson-character mx-auto"
                            showBubble={false}
                            mood={getMood()}
                        />
                    )}
                </div>

                {/* ===== INTRO NARRATIVE ===== */}
                {currentExercise?.type === 'intro_narrative' && (
                    <div className="w-full max-w-lg animate-slide-in-bottom">
                        {isAudioPlaying && (
                            <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground">
                                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                <span className="text-sm font-medium">Hablando...</span>
                            </div>
                        )}

                        <Button
                            onClick={nextExercise}
                            disabled={isAudioPlaying}
                            className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                        >
                            CONTINUAR
                        </Button>
                    </div>
                )}

                {/* ===== MULTIPLE CHOICE ===== */}
                {currentExercise?.type === 'multiple_choice' && (
                    <div className="w-full max-w-lg animate-slide-in-bottom">

                        {/* Options - Shuffled for variety */}
                        <div className="space-y-3 mb-6">
                            {(shuffledOptions as Array<{ id: string; text: string }>).map((option, index) => {
                                const isSelected = selectedOption === option.id;
                                const isCorrect = option.id === correctId;
                                const showResult = isChecked;

                                // Vibrant color palette for each option
                                const optionColors = [
                                    { bg: 'bg-sky-50 dark:bg-sky-900/30', border: 'border-sky-400', hover: 'hover:bg-sky-100 dark:hover:bg-sky-800/40', ring: 'ring-sky-400', emoji: '🔵' },
                                    { bg: 'bg-pink-50 dark:bg-pink-900/30', border: 'border-pink-400', hover: 'hover:bg-pink-100 dark:hover:bg-pink-800/40', ring: 'ring-pink-400', emoji: '🩷' },
                                    { bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-400', hover: 'hover:bg-emerald-100 dark:hover:bg-emerald-800/40', ring: 'ring-emerald-400', emoji: '💚' },
                                    { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-400', hover: 'hover:bg-amber-100 dark:hover:bg-amber-800/40', ring: 'ring-amber-400', emoji: '🧡' },
                                ];
                                const color = optionColors[index % optionColors.length];

                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => handleSelectOption(option.id)}
                                        disabled={isChecked}
                                        className={cn(
                                            "w-full p-4 rounded-2xl border-3 text-left transition-all duration-300 transform",
                                            "font-semibold text-base",
                                            "active:scale-[0.97] hover:scale-[1.02]",
                                            // Default state - vibrant colors
                                            !showResult && !isSelected && `${color.bg} ${color.border} ${color.hover}`,
                                            // Selected state - glow effect
                                            !showResult && isSelected && `${color.bg} ${color.border} ring-4 ${color.ring}/50 shadow-lg scale-[1.02]`,

                                            // === SUCCESS FEEDBACK ===
                                            showResult && localFeedback === 'success' && isSelected && isCorrect && "bg-green-100 dark:bg-green-900/50 border-green-500 ring-4 ring-green-400/50",
                                            // Unselected options on success - fade out
                                            showResult && localFeedback === 'success' && !isSelected && "opacity-40",

                                            // === ERROR FEEDBACK ===
                                            // Wrong selection - red
                                            showResult && localFeedback === 'error' && isSelected && "bg-red-100 dark:bg-red-900/50 border-red-500",
                                            // ALL other options turn yellow to encourage retry (don't reveal answer)
                                            showResult && localFeedback === 'error' && !isSelected && "bg-amber-50 dark:bg-amber-900/30 border-amber-400"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Color indicator - only before check */}
                                            {!showResult && (
                                                <span className="text-xl">{color.emoji}</span>
                                            )}
                                            {/* ✅ Checkmark on success */}
                                            {showResult && localFeedback === 'success' && isSelected && isCorrect && (
                                                <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                                                    <Check className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                            {/* ❌ X on error - only on selected wrong */}
                                            {showResult && localFeedback === 'error' && isSelected && (
                                                <div className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
                                                    <X className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                            {/* On error, show question mark for unselected to encourage retry */}
                                            {showResult && localFeedback === 'error' && !isSelected && (
                                                <span className="text-xl">❓</span>
                                            )}
                                            <span className={cn(
                                                "flex-1",
                                                showResult && localFeedback === 'success' && isSelected && isCorrect && "text-green-700 dark:text-green-300 font-bold",
                                                showResult && localFeedback === 'error' && isSelected && "text-red-500 line-through"
                                            )}>
                                                {option.text}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Action Button */}
                        {!isChecked ? (
                            <Button
                                onClick={handleCheckAnswer}
                                disabled={!selectedOption}
                                className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:bg-muted"
                            >
                                VERIFICAR
                            </Button>
                        ) : (
                            <Button
                                onClick={handleContinue}
                                className={cn(
                                    "w-full h-14 text-lg font-bold rounded-2xl transition-all",
                                    localFeedback === 'success'
                                        ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                                        : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                                    "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                                )}
                            >
                                {localFeedback === 'success' ? 'CONTINUAR' : 'INTENTAR DE NUEVO'}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                        )}
                    </div>
                )}

                {/* ===== CLASSIFICATION ===== */}
                {currentExercise?.type === 'classification' && (
                    <div className="w-full max-w-lg animate-slide-in-bottom">
                        {/* Categories Header - ADAPTIVE */}
                        <div className="grid grid-cols-2 lesson-gap-md lesson-mb-sm">
                            {(currentExercise.content as { categories?: Array<{ id: string; label: string }> }).categories?.map((category, idx) => {
                                const categoryColors = [
                                    { bg: 'bg-gradient-to-r from-yellow-400 to-orange-400', text: 'text-white', emoji: '🌟' },
                                    { bg: 'bg-gradient-to-r from-purple-400 to-pink-400', text: 'text-white', emoji: '💎' },
                                ];
                                const catColor = categoryColors[idx % categoryColors.length];

                                return (
                                    <div
                                        key={category.id}
                                        className={`${catColor.bg} lesson-category-header rounded-xl text-center shadow-md`}
                                    >
                                        <span className={`font-bold ${catColor.text}`}>
                                            {catColor.emoji} {category.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Items to classify - Shuffled for variety */}
                        <div className="lesson-gap-sm flex flex-col lesson-mb-md">
                            {(shuffledItems as Array<{ id: string; text: string; category?: string }>).map((item, idx) => {
                                const selectedCategory = selectedClassifications[item.id];
                                const categories = (currentExercise.content as { categories?: Array<{ id: string; label: string }> }).categories || [];

                                // Card colors
                                const cardColors = [
                                    'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700',
                                    'bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700',
                                    'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700',
                                    'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700',
                                ];

                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "lesson-card border-2 transition-all duration-200",
                                            cardColors[idx % cardColors.length],
                                            selectedCategory && "shadow-sm"
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium flex-1">{item.text}</span>
                                            <div className="flex lesson-gap-sm">
                                                {categories.map((cat, catIdx) => {
                                                    const isSelected = selectedCategory === cat.id;
                                                    const buttonColors = [
                                                        { active: 'bg-yellow-500 text-white shadow-md', inactive: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200' },
                                                        { active: 'bg-purple-500 text-white shadow-md', inactive: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200' },
                                                    ];
                                                    const btnColor = buttonColors[catIdx % buttonColors.length];

                                                    return (
                                                        <button
                                                            key={cat.id}
                                                            onClick={() => handleClassificationClick(item.id, cat.id)}
                                                            disabled={isChecked}
                                                            className={cn(
                                                                "lesson-category-btn font-bold transition-all duration-200",
                                                                isSelected ? `${btnColor.active}` : `${btnColor.inactive}`,
                                                                "active:scale-95"
                                                            )}
                                                        >
                                                            {cat.label.split(' ')[0]}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Action Button - ADAPTIVE */}
                        {!isChecked ? (
                            <Button
                                onClick={handleCheckClassification}
                                disabled={Object.keys(selectedClassifications).length < ((currentExercise.content as { items?: Array<unknown> }).items?.length || 0)}
                                className="w-full lesson-action-btn font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-[0_3px_0_rgb(107,33,168)] hover:shadow-[0_1px_0_rgb(107,33,168)] hover:translate-y-[1px] active:shadow-none active:translate-y-0.5 transition-all disabled:opacity-50 disabled:shadow-none disabled:from-gray-400 disabled:to-gray-400"
                            >
                                ✨ VERIFICAR ✨
                            </Button>
                        ) : (
                            <Button
                                onClick={handleContinue}
                                className={cn(
                                    "w-full lesson-action-btn font-bold transition-all",
                                    localFeedback === 'success'
                                        ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-[0_3px_0_rgb(22,101,52)]"
                                        : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-[0_3px_0_rgb(194,65,12)]",
                                    "hover:translate-y-[1px] active:translate-y-0.5 active:shadow-none"
                                )}
                            >
                                {localFeedback === 'success' ? '🎉 CONTINUAR' : '🔄 REINTENTAR'}
                                <ArrowRight className="ml-1 w-4 h-4" />
                            </Button>
                        )}
                    </div>
                )}

                {/* ===== TAP ACTION ===== */}
                {currentExercise?.type === 'tap_action' && (
                    <div className="w-full max-w-lg animate-slide-in-bottom flex flex-col items-center">
                        {/* Items grid - Shuffled for variety, centered */}
                        <div className="grid grid-cols-3 lesson-gap-md lesson-mb-md place-items-center w-full max-w-sm">
                            {(shuffledItems as Array<{ id: string; emoji?: string; shape?: string; color?: string; text?: string; isTarget?: boolean }>).map((item, idx) => {
                                const isTapped = tappedItems.has(item.id);
                                const showResult = isChecked;
                                const isCorrect = item.isTarget === true;

                                // Get display content - emoji, text, or generate based on shape/color
                                const getDisplayContent = () => {
                                    if (item.emoji) return item.emoji;
                                    if (item.text) return item.text;
                                    // Fallback: generate emoji based on shape/color
                                    if (item.shape === 'circle') {
                                        return item.color === 'gold' ? '🪙' : '⭕';
                                    }
                                    if (item.shape === 'rectangle') {
                                        return item.color === 'green' ? '💵' : '📄';
                                    }
                                    return '❓';
                                };

                                // Vibrant background colors
                                const bgColors = [
                                    'bg-sky-100 dark:bg-sky-900/40 border-sky-300',
                                    'bg-rose-100 dark:bg-rose-900/40 border-rose-300',
                                    'bg-amber-100 dark:bg-amber-900/40 border-amber-300',
                                    'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300',
                                    'bg-violet-100 dark:bg-violet-900/40 border-violet-300',
                                    'bg-cyan-100 dark:bg-cyan-900/40 border-cyan-300',
                                ];

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleTapItem(item.id)}
                                        disabled={isChecked}
                                        className={cn(
                                            "lesson-tap-item border-3 flex items-center justify-center transition-all duration-200 transform shadow-md",
                                            "active:scale-90 hover:scale-105",
                                            // Default state - colorful background
                                            !isTapped && !showResult && `${bgColors[idx % bgColors.length]} hover:shadow-lg`,
                                            // Selected state (before checking) - purple glow
                                            isTapped && !showResult && "bg-gradient-to-br from-purple-200 to-pink-200 dark:from-purple-800/50 dark:to-pink-800/50 border-purple-500 ring-4 ring-purple-400/50 scale-105 shadow-xl",

                                            // === SUCCESS FEEDBACK ===
                                            // Correctly selected items - green glow
                                            showResult && localFeedback === 'success' && isTapped && isCorrect && "bg-gradient-to-br from-green-200 to-emerald-200 dark:from-green-800/50 dark:to-emerald-800/50 border-green-500 ring-4 ring-green-400/50",
                                            // Unselected items on success - fade out
                                            showResult && localFeedback === 'success' && !isTapped && "opacity-40",

                                            // === ERROR FEEDBACK ===
                                            // Wrong selections (tapped but not target) - red
                                            showResult && localFeedback === 'error' && isTapped && !isCorrect && "bg-red-100 dark:bg-red-900/50 border-red-500 ring-2 ring-red-400/50",
                                            // Correctly tapped - subtle green (keep visible)
                                            showResult && localFeedback === 'error' && isTapped && isCorrect && "bg-green-100 dark:bg-green-900/40 border-green-400",
                                            // ALL untapped items turn yellow - don't reveal which are correct
                                            showResult && localFeedback === 'error' && !isTapped && "bg-amber-50 dark:bg-amber-900/30 border-amber-400"
                                        )}
                                    >
                                        <span className="relative">
                                            {getDisplayContent()}
                                            {/* Show checkmark only on complete success */}
                                            {showResult && localFeedback === 'success' && isTapped && isCorrect && (
                                                <span className="absolute -top-1 -right-1 text-lg">✓</span>
                                            )}
                                            {/* Show X for wrong selections */}
                                            {showResult && localFeedback === 'error' && isTapped && !isCorrect && (
                                                <span className="absolute -top-1 -right-1 text-lg">✗</span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Action Button - Gradient */}
                        {!isChecked ? (
                            <Button
                                onClick={handleCheckTapAnswer}
                                disabled={tappedItems.size === 0}
                                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:from-gray-400 disabled:to-gray-400"
                            >
                                🎯 VERIFICAR 🎯
                            </Button>
                        ) : (
                            <Button
                                onClick={handleContinue}
                                className={cn(
                                    "w-full h-14 text-lg font-bold rounded-2xl transition-all",
                                    localFeedback === 'success'
                                        ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                                        : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                                    "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                                )}
                            >
                                {localFeedback === 'success' ? '🎉 CONTINUAR' : '🔄 INTENTAR DE NUEVO'}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* ===== SUCCESS DIALOG ===== */}
            {/* Note: We prevent closing on overlay click to avoid inconsistent state */}
            <Dialog
                open={showSuccess}
                onOpenChange={(open) => {
                    // Only allow closing via explicit button actions, not overlay click
                    if (!open) {
                        // If user tries to close by clicking outside, redirect them
                        handleClose();
                    }
                }}
            >
                <DialogContent
                    className="w-[90vw] max-w-sm mx-auto bg-card border-0 shadow-2xl rounded-3xl p-4 sm:p-6"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <div className="text-center py-4">
                        {/* Celebration Icon */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-yellow-400/30 to-orange-400/30 rounded-full flex items-center justify-center mx-auto mb-3 animate-celebrate">
                            <PartyPopper className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500" />
                        </div>

                        <DialogTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent mb-1">
                            ¡Excelente!
                        </DialogTitle>
                        <DialogDescription className="text-base sm:text-lg text-muted-foreground mb-4">
                            Completaste la lección 🌟
                        </DialogDescription>

                        {/* Stats - Responsive grid */}
                        <div className="flex justify-center gap-3 mb-5">
                            <div className="bg-gradient-to-br from-yellow-400/20 to-orange-400/20 px-4 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl min-w-[80px]">
                                <Star className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-500 fill-yellow-500 mx-auto mb-1" />
                                <p className="text-lg sm:text-xl font-bold text-yellow-600 dark:text-yellow-400">
                                    +{data.meta.points_reward}
                                </p>
                                <p className="text-xs text-muted-foreground">puntos</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-400/20 to-pink-400/20 px-4 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl min-w-[80px]">
                                <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-purple-500 mx-auto mb-1" />
                                <p className="text-lg sm:text-xl font-bold text-purple-600 dark:text-purple-400">
                                    +{data.meta.xp_reward}
                                </p>
                                <p className="text-xs text-muted-foreground">XP</p>
                            </div>
                        </div>

                        {/* Action Buttons - Full width, stacked on small mobile */}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="w-full h-11 sm:h-12 rounded-xl font-semibold text-base border-2"
                            >
                                Salir
                            </Button>
                            <Button
                                onClick={() => { setShowSuccess(false); startLesson(); }}
                                className="w-full h-11 sm:h-12 rounded-xl font-semibold text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
                            >
                                🎮 Repetir
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ===== GAME OVER DIALOG (No Energy) ===== */}
            <Dialog
                open={showGameOver}
                onOpenChange={(open) => {
                    if (!open) handleClose();
                }}
            >
                <DialogContent
                    className="sm:max-w-md bg-card border-0 shadow-2xl rounded-3xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <div className="text-center py-6">
                        <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BatteryLow className="w-10 h-10 text-yellow-500" />
                        </div>

                        <DialogTitle className="text-3xl font-bold text-foreground mb-2">
                            ¡Se acabó la energía!
                        </DialogTitle>
                        <DialogDescription className="text-lg text-muted-foreground mb-6">
                            No te preocupes, puedes intentarlo de nuevo. ¡Tú puedes! ⚡
                        </DialogDescription>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="flex-1 h-12 rounded-xl font-semibold"
                            >
                                Salir
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowGameOver(false);
                                    setLives(5);
                                    startLesson();
                                }}
                                className="flex-1 h-12 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 text-white"
                            >
                                <Zap className="w-4 h-4 mr-2 fill-current" />
                                Reintentar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}

export default LessonRunner;
