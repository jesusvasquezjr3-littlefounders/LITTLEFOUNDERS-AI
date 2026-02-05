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
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { DinoCharacter, DinoMood } from '@/components/demo/DinoCharacter';
import { DinaCharacter } from '@/components/demo/DinaCharacter';
import DrRhoCharacter, { RhoMood } from '@/components/demo/DrRhoCharacter';
import ZaraVexCharacter, { ZaraMood } from '@/components/demo/ZaraVexCharacter';
import { useLessonData, useLessonState } from './hooks';
import { useSound } from "@/contexts/SoundContext";
import { MultipleChoice } from './activities/MultipleChoice';
import { TapAction } from './activities/TapAction';
import { Classification } from './activities/Classification';
import { IntroNarrative } from './activities/IntroNarrative';
import { StoryMode } from './activities/StoryMode';
import { Sequencing } from './activities/Sequencing';
import { MatchingPairs } from './activities/MatchingPairs';
import { FillBlank } from './activities/FillBlank';
import { TrueFalse } from './activities/TrueFalse';
import { MathChallenge } from './activities/MathChallenge';
import { RoleplayChat } from './activities/RoleplayChat';
import { WordScramble } from './activities/WordScramble';
import { EstimationSlider } from './activities/EstimationSlider';
import { RiskReward } from './activities/RiskReward';
import { ShopSim } from './activities/ShopSim';
import { CoinCounter } from './activities/CoinCounter';
import { ConceptBuilder } from './activities/ConceptBuilder';
import { PriceDetective } from './activities/PriceDetective';
import { SpotTheTrap } from './activities/SpotTheTrap';
import { ImpactMeter } from './activities/ImpactMeter';
import { MarketReaction } from './activities/MarketReaction';
import { MysteryInvestment } from './activities/MysteryInvestment';
import { BudgetBuilder } from './activities/BudgetBuilder';
import { SavingsRace } from './activities/SavingsRace';
import { ExpenseTimeline } from './activities/ExpenseTimeline';
import { InterestCalculator } from './activities/InterestCalculator';
import { TaxPuzzle } from './activities/TaxPuzzle';
import { SubscriptionTracker } from './activities/SubscriptionTracker';
import { InflationSimulator } from './activities/InflationSimulator';
import { CreditScoreBuilder } from './activities/CreditScoreBuilder';
import { EmergencyFund } from './activities/EmergencyFund';
import { BillSplitter } from './activities/BillSplitter';
import { SalaryComparison } from './activities/SalaryComparison';
import { DebtStrategy } from './activities/DebtStrategy';
import { PortfolioBuilder } from './activities/PortfolioBuilder';
import { OpportunityCost } from './activities/OpportunityCost';
import { GoalRoadmap } from './activities/GoalRoadmap';
import { MindsetComparison } from './activities/MindsetComparison';
import { PassiveIncome } from './activities/PassiveIncome';
import { QuizBattle } from './activities/QuizBattle';

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
    const { t } = useTranslation('lessons');
    const params = useParams<{ lessonCode: string }>();
    const navigate = useNavigate();
    const code = propLessonCode || params.lessonCode || '';

    // Audio ref
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    // Use global sound context
    const { playSound, mute: audioMuted, toggleMute: setAudioMuted, playBGM, stopBGM } = useSound();

    // Start BGM on mount
    useEffect(() => {
        playBGM('/sounds/edu/background.mp3', { volume: 0.3 }); // Increased volume to 0.2 as requested

        return () => {
            stopBGM({ fade: true, fadeDuration: 500 });
        };
    }, [playBGM, stopBGM]);

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
        const content = currentExercise.content as any;

        // Content fallbacks
        if (content.instruction || content.question || content.statement || content.transcript || content.context || content.hint) {
            return content.instruction || content.question || content.statement || content.transcript || content.context || content.hint;
        }

        // Type-based fallbacks (i18n hardcoded for now or use translation keys later)
        switch (currentExercise.type) {
            case 'fill_blank': return "Completa la frase.";
            case 'classification': return "Clasifica los elementos.";
            case 'matching_pairs': return "Une los pares.";
            case 'sequencing': return "Ordena los pasos.";
            case 'sorting_buckets': return "Organiza cada elemento.";
            case 'true_false': return "¿Verdadero o Falso?";
            case 'multiple_choice': return "Elige la opción correcta.";
            case 'tap_action': return "Toca los elementos indicados.";
            case 'math_challenge': return "Resuelve el problema.";
            case 'word_scramble': return "Ordena las letras.";
            case 'estimation_slider': return "Estima el valor.";
            case 'risk_reward': return "Elige tu estrategia.";
            case 'roleplay_chat': return "Selecciona qué responder.";
            case 'shop_sim': return "Compra lo que necesitas.";
            case 'coin_counter': return "Cuenta el dinero.";
            default: return "Completa la actividad.";
        }
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
            stopBGM({ fade: true, fadeDuration: 1500 }); // Fade out BGM
            setTimeout(() => {
                playSound('edu_complete');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 100 });
                setShowSuccess(true);
            }, 1000); // Wait for fade to mostly finish before fanfare
        }
    }, [state, playSound, stopBGM]);

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
        playSound('ui_tap');
        setSelectedOption(optionId);
    };

    // Handle check answer
    const handleCheckAnswer = () => {
        if (!selectedOption || !currentExercise) return;
        const isCorrect = submitAnswer(selectedOption);
        setIsChecked(true);
        setLocalFeedback(isCorrect ? 'success' : 'error');

        if (isCorrect) {
            playSound('edu_success');
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
        } else {
            playSound('edu_error');
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
        playSound('ui_tap');
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
            playSound('edu_success');
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
        } else {
            playSound('edu_error');
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
        playSound('ui_tap');
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
            playSound('edu_success');
            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
        } else {
            playSound('edu_error');
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
                <p className="text-lg text-muted-foreground font-medium">{t('loading')}</p>
            </div>
        );
    }

    // ============ ERROR STATE ============
    if (error || !data) {
        return (
            <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 p-6">
                <AlertCircle className="w-16 h-16 text-destructive" />
                <p className="text-lg text-destructive font-medium text-center">
                    {error || t('error')}
                </p>
                <Button variant="outline" onClick={handleClose} className="mt-4">
                    {t('common:buttons.back')}
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
                        {t('start.button')}
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
                    onClick={() => setAudioMuted()}
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
            <div className="flex-1 flex flex-col items-center justify-start px-4 pb-2 pt-4 overflow-y-auto min-h-0 w-full scrolling-touch">

                {/* Hide default Bubble/Character for StoryMode as it has its own */}
                {currentExercise?.type !== 'story_mode' && (
                    <>
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
                    </>
                )}

                {/* ===== STORY MODE ===== */}
                {currentExercise?.type === 'story_mode' && (
                    <StoryMode
                        exercise={currentExercise}
                        onNext={() => {
                            submitAnswer(true); // Verify/Save progress
                            // Small delay to ensure state update? Or just next.
                            // Since story mode is self-contained "Success", we just move on.
                            nextExercise();
                        }}
                    />
                )}


                {/* ===== INTRO NARRATIVE ===== */}
                {currentExercise?.type === 'intro_narrative' && (
                    <IntroNarrative
                        onNext={() => {
                            // Narrative is just consumption, always "correct"
                            submitAnswer(true);
                            nextExercise();
                        }}
                        isAudioPlaying={isAudioPlaying}
                    />
                )}

                {/* ===== MULTIPLE CHOICE ===== */}
                {currentExercise?.type === 'multiple_choice' && (
                    <MultipleChoice
                        exercise={currentExercise}
                        onSubmit={(answer) => {
                            const isCorrect = submitAnswer(answer);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                            return isCorrect;
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* GLOBAL INSTRUCTION FOOTER */}
                {!isChecked && currentExercise?.content?.instruction && (
                    <div className="w-full max-w-md mx-auto mt-4 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-500">
                        <div className="bg-muted/50 dark:bg-muted/30 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 flex items-center justify-center gap-2">
                            <span className="text-xs font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-md uppercase tracking-wider">
                                {t('common:tip', { defaultValue: 'TIP' })}
                            </span>
                            <p className="text-sm font-medium text-muted-foreground text-center">
                                {currentExercise.content.instruction}
                            </p>
                        </div>
                    </div>
                )}


                {/* ===== SEQUENCING ===== */}
                {currentExercise?.type === 'sequencing' && (
                    <Sequencing
                        exercise={currentExercise}
                        onSubmit={(answer) => {
                            const isCorrect = submitAnswer(answer);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== CLASSIFICATION ===== */}
                {currentExercise?.type === 'classification' && (
                    <Classification
                        exercise={currentExercise}
                        onSubmit={(answer) => {
                            const isCorrect = submitAnswer(answer);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}



                {/* ===== MATCHING PAIRS ===== */}
                {(currentExercise?.type === 'match_pairs' || currentExercise?.type === 'matching_pairs') && (
                    <MatchingPairs
                        exercise={currentExercise}
                        onSubmit={(answer) => {
                            // Logic handled inside component mostly, but good to have
                            submitAnswer(answer);
                            // Feedback handled inside for now or we can do it here
                            playSound('edu_success');
                            setLocalFeedback('success');
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== FILL BLANK ===== */}
                {currentExercise?.type === 'fill_blank' && (
                    <FillBlank
                        exercise={currentExercise}
                        onSubmit={(answer) => {
                            const isCorrect = submitAnswer(answer);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== TRUE / FALSE ===== */}
                {currentExercise?.type === 'true_false' && (
                    <TrueFalse
                        exercise={currentExercise}
                        onSubmit={(isTrue) => {
                            const isCorrect = isTrue === currentExercise.correct_answer?.isTrue;
                            submitAnswer(isTrue);

                            if (isCorrect) {
                                // Component plays its own sound but we can reinforce or do confetti
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== MATH CHALLENGE ===== */}
                {currentExercise?.type === 'math_challenge' && (
                    <MathChallenge
                        exercise={currentExercise}
                        onSubmit={(answer) => {
                            const isCorrect = submitAnswer(answer);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== ROLEPLAY CHAT ===== */}
                {currentExercise?.type === 'roleplay_chat' && (
                    <RoleplayChat
                        exercise={currentExercise}
                        onSubmit={(choiceId) => {
                            const isCorrect = submitAnswer(choiceId);
                            if (isCorrect) {
                                playSound('edu_success');
                                // Confetti might disrupt chat flow, maybe subtle?
                                confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== WORD SCRAMBLE ===== */}
                {currentExercise?.type === 'word_scramble' && (
                    <WordScramble
                        exercise={currentExercise}
                        onSubmit={(word) => {
                            const isCorrect = submitAnswer(word);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== ESTIMATION SLIDER ===== */}
                {currentExercise?.type === 'estimation_slider' && (
                    <EstimationSlider
                        exercise={currentExercise}
                        onSubmit={(value) => {
                            const isCorrect = submitAnswer(value);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}



                {/* ===== RISK REWARD ===== */}
                {currentExercise?.type === 'risk_reward' && (
                    <RiskReward
                        exercise={currentExercise}
                        onSubmit={(choiceId) => {
                            const isCorrect = submitAnswer(choiceId);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== SHOP SIM ===== */}
                {currentExercise?.type === 'shop_sim' && (
                    <ShopSim
                        exercise={currentExercise}
                        onSubmit={(cartIds) => {
                            const isCorrect = submitAnswer(cartIds);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== COIN COUNTER ===== */}
                {currentExercise?.type === 'coin_counter' && (
                    <CoinCounter
                        exercise={currentExercise}
                        onSubmit={(value) => {
                            const isCorrect = submitAnswer(value);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== CONCEPT BUILDER ===== */}
                {currentExercise?.type === 'concept_builder' && (
                    <ConceptBuilder
                        exercise={currentExercise}
                        onSubmit={(sequence) => {
                            const isCorrect = submitAnswer(sequence);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}




                {/* ===== TAP ACTION ===== */}
                {currentExercise?.type === 'tap_action' && (
                    <TapAction
                        exercise={currentExercise}
                        onSubmit={(answer) => {
                            // Calculate corectness (logic duplicated in component for UI, but here for global state)
                            // Ideally component passes isCorrect?
                            // TapAction component determines correctness internally to show feedback. 
                            // It passes the answer items to us. We need to validate to update lives/Global state.
                            // To avoid logic duplication, strict separation would be better, but for now duplicate validation:
                            const items = currentExercise.content.items || [];
                            const targetIds = new Set(items.filter((item: any) => item.isTarget === true).map((item: any) => item.id));
                            if (currentExercise.correct_answer?.targetIds) {
                                (currentExercise.correct_answer.targetIds as string[]).forEach(id => targetIds.add(id));
                            }

                            const isCorrect = answer.length === targetIds.size && answer.every(id => targetIds.has(id));

                            submitAnswer(answer);

                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== PRICE DETECTIVE ===== */}
                {currentExercise?.type === 'price_detective' && (
                    <PriceDetective
                        exercise={currentExercise}
                        onSubmit={(choiceId) => {
                            const isCorrect = submitAnswer(choiceId);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== SPOT THE TRAP ===== */}
                {currentExercise?.type === 'spot_trap' && (
                    <SpotTheTrap
                        exercise={currentExercise}
                        onSubmit={(selectedIds) => {
                            const isCorrect = submitAnswer(selectedIds);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== IMPACT METER ===== */}
                {currentExercise?.type === 'impact_meter' && (
                    <ImpactMeter
                        exercise={currentExercise}
                        onSubmit={(causeId) => {
                            submitAnswer(causeId);
                            playSound('edu_success');
                            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                            setLocalFeedback('success');
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== MARKET REACTION ===== */}
                {currentExercise?.type === 'market_reaction' && (
                    <MarketReaction
                        exercise={currentExercise}
                        onSubmit={(prediction) => {
                            const isCorrect = submitAnswer(prediction);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== MYSTERY INVESTMENT ===== */}
                {currentExercise?.type === 'mystery_investment' && (
                    <MysteryInvestment
                        exercise={currentExercise}
                        onSubmit={(allocation) => {
                            submitAnswer(allocation);
                            playSound('edu_success');
                            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                            setLocalFeedback('success');
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== BUDGET BUILDER ===== */}
                {currentExercise?.type === 'budget_builder' && (
                    <BudgetBuilder
                        exercise={currentExercise}
                        onSubmit={(allocation) => {
                            const isCorrect = submitAnswer(allocation);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== SAVINGS RACE ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'savings_race' && (
                    <SavingsRace
                        exercise={currentExercise}
                        onSubmit={(strategy) => {
                            submitAnswer(strategy);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== EXPENSE TIMELINE ===== */}
                {currentExercise?.type === 'expense_timeline' && (
                    <ExpenseTimeline
                        exercise={currentExercise}
                        onSubmit={(order) => {
                            const isCorrect = submitAnswer(order);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== INTEREST CALCULATOR ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'interest_calculator' && (
                    <InterestCalculator
                        exercise={currentExercise}
                        onSubmit={(values) => {
                            submitAnswer(values);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== TAX PUZZLE ===== */}
                {currentExercise?.type === 'tax_puzzle' && (
                    <TaxPuzzle
                        exercise={currentExercise}
                        onSubmit={(pieces) => {
                            const isCorrect = submitAnswer(pieces);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}



                {/* ===== SUBSCRIPTION TRACKER ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'subscription_tracker' && (
                    <SubscriptionTracker
                        exercise={currentExercise}
                        onSubmit={(active) => {
                            submitAnswer(active);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== INFLATION SIMULATOR ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'inflation_simulator' && (
                    <InflationSimulator
                        exercise={currentExercise}
                        onSubmit={(comparison) => {
                            submitAnswer(comparison);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== CREDIT SCORE BUILDER ===== */}
                {currentExercise?.type === 'credit_score' && (
                    <CreditScoreBuilder
                        exercise={currentExercise}
                        onSubmit={(decisions) => {
                            const isCorrect = submitAnswer(decisions);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== EMERGENCY FUND ===== */}
                {currentExercise?.type === 'emergency_fund' && (
                    <EmergencyFund
                        exercise={currentExercise}
                        onSubmit={(decisions) => {
                            const isCorrect = submitAnswer(decisions);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== BILL SPLITTER ===== */}
                {currentExercise?.type === 'bill_splitter' && (
                    <BillSplitter
                        exercise={currentExercise}
                        onSubmit={(splits) => {
                            const isCorrect = submitAnswer(splits);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== SALARY COMPARISON ===== */}
                {currentExercise?.type === 'salary_comparison' && (
                    <SalaryComparison
                        exercise={currentExercise}
                        onSubmit={(selectedId) => {
                            const isCorrect = submitAnswer(selectedId);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== DEBT STRATEGY ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'debt_strategy' && (
                    <DebtStrategy
                        exercise={currentExercise}
                        onSubmit={(strategy) => {
                            submitAnswer(strategy);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== PORTFOLIO BUILDER ===== */}
                {currentExercise?.type === 'portfolio_builder' && (
                    <PortfolioBuilder
                        exercise={currentExercise}
                        onSubmit={(allocation) => {
                            const isCorrect = submitAnswer(allocation);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== OPPORTUNITY COST ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'opportunity_cost' && (
                    <OpportunityCost
                        exercise={currentExercise}
                        onSubmit={(choice) => {
                            submitAnswer(choice);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== GOAL ROADMAP ===== */}
                {currentExercise?.type === 'goal_roadmap' && (
                    <GoalRoadmap
                        exercise={currentExercise}
                        onSubmit={(order) => {
                            const isCorrect = submitAnswer(order);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== MINDSET COMPARISON ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'mindset_comparison' && (
                    <MindsetComparison
                        exercise={currentExercise}
                        onSubmit={(mindset) => {
                            submitAnswer(mindset);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== PASSIVE INCOME ===== */}
                {currentExercise?.type === 'passive_income' && (
                    <PassiveIncome
                        exercise={currentExercise}
                        onSubmit={(selected) => {
                            const isCorrect = submitAnswer(selected);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
                )}

                {/* ===== QUIZ BATTLE ===== */}
                {currentExercise?.type === 'quiz_battle' && (
                    <QuizBattle
                        exercise={currentExercise}
                        onSubmit={(score) => {
                            const isCorrect = submitAnswer(score);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
                            } else {
                                playSound('edu_error');
                                setLives(l => {
                                    const newLives = l - 1;
                                    if (newLives <= 0) setTimeout(() => setShowGameOver(true), 1000);
                                    return newLives;
                                });
                                setLocalFeedback('error');
                            }
                        }}
                        onNext={() => {
                            setLocalFeedback('none');
                            nextExercise();
                        }}
                        onRetry={() => {
                            setLocalFeedback('none');
                            retryExercise();
                        }}
                    />
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
                            {t('status.great_job')}
                        </DialogTitle>
                        <DialogDescription className="text-base sm:text-lg text-muted-foreground mb-4">
                            {t('completion.subtitle')}
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
                                {t('game_over.exit_button')}
                            </Button>
                            <Button
                                onClick={() => { setShowSuccess(false); startLesson(); }}
                                className="w-full h-11 sm:h-12 rounded-xl font-semibold text-base bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
                            >
                                🎮 {t('actions.retry')}
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
                            {t('game_over.title')}
                        </DialogTitle>
                        <DialogDescription className="text-lg text-muted-foreground mb-6">
                            {t('game_over.subtitle')} ⚡
                        </DialogDescription>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="flex-1 h-12 rounded-xl font-semibold"
                            >
                                {t('game_over.exit_button')}
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
                                {t('game_over.retry_button')}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}

export default LessonRunner;
