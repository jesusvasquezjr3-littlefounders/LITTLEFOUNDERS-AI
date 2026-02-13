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
import { useLessonData, useLessonState, completeLesson, getNextLessonCode } from './hooks';
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
    Clock,
    Star,
    Loader2,
    AlertCircle,
    ArrowRight,
    PartyPopper,
    Volume2,
    VolumeX,
    BatteryLow
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';
import { normalizeGesture } from '@/utils/gestureMapper';


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
    const [completionResult, setCompletionResult] = useState<{ points_earned: number; xp_earned: number; new_streak: number } | null>(null);
    const [isCompletingLesson, setIsCompletingLesson] = useState(false);
    const [showGameOver, setShowGameOver] = useState(false);
    const [localFeedback, setLocalFeedback] = useState<'none' | 'success' | 'error'>('none');


    // Get mood based on state (for Liruf)
    // Always returns valid DinoMood values
    const getMood = (): DinoMood => {
        if (localFeedback === 'success') return 'excited';
        if (localFeedback === 'error') return 'thinking';
        return 'happy'; // Friendly default
    };

    // Get expression based on state (for Dina)
    // Always returns valid expression values
    const getDinaExpression = (): 'neutral' | 'happy' | 'surprised' | 'wink' => {
        if (localFeedback === 'success') return 'happy';
        if (localFeedback === 'error') return 'surprised';
        return 'happy'; // Friendly default (changed from 'neutral')
    };

    // Get mood based on state (for Dr. Rho)
    // Always returns valid RhoMood values
    const getRhoMood = (): RhoMood => {
        if (localFeedback === 'success') return 'wise';
        if (localFeedback === 'error') return 'surprised';
        return 'wise'; // Friendly default (changed from 'neutral')
    };

    // Get mood based on state (for Zara Vex)
    // Always returns valid ZaraMood values
    const getZaraMood = (): ZaraMood => {
        if (localFeedback === 'success') return 'excited';
        if (localFeedback === 'error') return 'curious';
        return 'happy'; // Friendly default
    };

    // Character code mapping - normalize all variations to canonical codes
    const CHARACTER_CODE_MAP: Record<string, string> = {
        // Canonical codes
        'liruf': 'liruf',
        'dina': 'dina',
        'dr_rho': 'dr_rho',
        'zara_vex': 'zara_vex',

        // Variations without underscores (from DB)
        'drrho': 'dr_rho',
        'zaravex': 'zara_vex',

        // Camel case variations
        'DrRho': 'dr_rho',
        'ZaraVex': 'zara_vex',

        // Lowercase variations
        'dr rho': 'dr_rho',
        'zara vex': 'zara_vex'
    };

    // Get current character code from exercise with normalization
    const getCharacterCode = (): string => {
        const rawCode = currentExercise?.character_code || 'liruf';
        // Normalize the code using the mapping dictionary
        return CHARACTER_CODE_MAP[rawCode.toLowerCase().trim()] || CHARACTER_CODE_MAP[rawCode] || 'liruf';
    };

    // Get current text to display
    // Prioridad de contenido:
    // 1. Mensajes de feedback (success/error) cuando aplica
    // 2. Contenido específico del ejercicio (question, instruction, statement, etc.)
    // 3. Fallback por tipo de ejercicio con traducciones
    const getCurrentText = (): string => {
        if (!currentExercise) return '';

        // Mostrar feedback si está disponible
        if (localFeedback === 'success' && currentExercise.feedback?.success) {
            return currentExercise.feedback.success;
        }
        if (localFeedback === 'error' && currentExercise.feedback?.error) {
            return currentExercise.feedback.error;
        }

        // Support different content types: question, instruction, transcript
        const content = currentExercise.content as any;

        // CRITICAL: Check ALL possible text fields in order of priority
        // Based on actual JSON structure from lesson files
        if (content) {
            // Primary fields (most common)
            if (content.question) return content.question;
            if (content.statement) return content.statement;
            if (content.instruction) return content.instruction;

            // Secondary fields (narrative/context)
            if (content.transcript) return content.transcript;
            if (content.context) return content.context;
            if (content.prompt) return content.prompt;

            // Tertiary fields (descriptive)
            if (content.description) return content.description;
            if (content.text) return content.text;
            if (content.hint) return content.hint;
            if (content.scenario) return content.scenario;
            if (content.challenge) return content.challenge;
        }

        // Type-based fallbacks using i18n translation keys
        switch (currentExercise.type) {
            case 'fill_blank': return t('instructions.fill_blank');
            case 'classification': return t('instructions.classification');
            case 'matching_pairs':
            case 'match_pairs': return t('instructions.matching_pairs');
            case 'sequencing': return t('instructions.sequencing');
            case 'sorting_buckets': return t('instructions.sorting_buckets');
            case 'true_false': return t('instructions.true_false');
            case 'multiple_choice': return t('instructions.multiple_choice');
            case 'tap_action': return t('instructions.tap_action');
            case 'math_challenge': return t('instructions.math_challenge');
            case 'word_scramble': return t('instructions.word_scramble');
            case 'estimation_slider': return t('instructions.estimation_slider');
            case 'risk_reward': return t('instructions.risk_reward');
            case 'roleplay_chat': return t('instructions.roleplay_chat');
            case 'shop_sim': return t('instructions.shop_sim');
            case 'coin_counter': return t('instructions.coin_counter');
            case 'concept_builder': return t('instructions.concept_builder');
            case 'price_detective': return t('instructions.price_detective');
            case 'spot_trap': return t('instructions.spot_trap');
            case 'impact_meter': return t('instructions.impact_meter');
            case 'market_reaction': return t('instructions.market_reaction');
            case 'mystery_investment': return t('instructions.mystery_investment');
            case 'budget_builder': return t('instructions.budget_builder');
            case 'savings_race': return t('instructions.savings_race');
            case 'expense_timeline': return t('instructions.expense_timeline');
            case 'interest_calculator': return t('instructions.interest_calculator');
            case 'tax_puzzle': return t('instructions.tax_puzzle');
            case 'subscription_tracker': return t('instructions.subscription_tracker');
            case 'inflation_simulator': return t('instructions.inflation_simulator');
            case 'credit_score': return t('instructions.credit_score');
            case 'emergency_fund': return t('instructions.emergency_fund');
            case 'bill_splitter': return t('instructions.bill_splitter');
            case 'salary_comparison': return t('instructions.salary_comparison');
            case 'debt_strategy': return t('instructions.debt_strategy');
            case 'portfolio_builder': return t('instructions.portfolio_builder');
            case 'opportunity_cost': return t('instructions.opportunity_cost');
            case 'goal_roadmap': return t('instructions.goal_roadmap');
            case 'mindset_comparison': return t('instructions.mindset_comparison');
            case 'passive_income': return t('instructions.passive_income');
            case 'quiz_battle': return t('instructions.quiz_battle');
            default: return t('instructions.default');
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

    // Celebration on complete + API call
    useEffect(() => {
        if (state === 'COMPLETED' && !isCompletingLesson) {
            setIsCompletingLesson(true);
            stopBGM({ fade: true, fadeDuration: 1500 }); // Fade out BGM

            // Call backend to mark lesson as completed
            const markComplete = async () => {
                try {
                    const userStr = localStorage.getItem('user');
                    const user = userStr ? JSON.parse(userStr) : null;
                    const userId = user?.id;

                    if (userId && code) {
                        const result = await completeLesson(code, userId, 100, 180);
                        if (result) {
                            setCompletionResult(result);
                        }
                    }
                } catch (err) {
                    console.error('Error completing lesson:', err);
                }
            };

            markComplete();

            setTimeout(() => {
                playSound('edu_complete');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 100 });
                setShowSuccess(true);
            }, 1000); // Wait for fade to mostly finish before fanfare
        }
    }, [state, playSound, stopBGM, isCompletingLesson, code]);

    // Reset local feedback when exercise changes
    useEffect(() => {
        setLocalFeedback('none');
    }, [currentExerciseIndex]);

    // Close lesson
    const handleClose = () => navigate(-1);

    // ============ LOADING STATE ============
    if (loading) {
        return (
            <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4">
                <dotlottie-wc
                    src="https://lottie.host/eac96c27-cdf7-40fa-a2b9-f709f50501de/RKfFgQWDLf.lottie"
                    style={{ width: '300px', height: '300px' }}
                    autoplay
                    loop
                />
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

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
                    {/* Character - Use first exercise's character_code */}
                    <div className="mb-8 animate-bounce-in">
                        {(() => {
                            const rawCode = data.timeline[0]?.character_code || 'liruf';
                            const normalizedCode = CHARACTER_CODE_MAP[rawCode.toLowerCase().trim()] || CHARACTER_CODE_MAP[rawCode] || 'liruf';

                            switch (normalizedCode) {
                                case 'dina':
                                    return <DinaCharacter className="w-full max-w-[280px]" expression="happy" />;
                                case 'dr_rho':
                                    return <DrRhoCharacter className="w-full max-w-[280px]" mood="wise" />;
                                case 'zara_vex':
                                    return <ZaraVexCharacter className="w-full max-w-[280px]" mood="happy" />;
                                default:
                                    return <DinoCharacter className="w-full max-w-[280px]" showBubble={false} mood="excited" />;
                            }
                        })()}
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
                            <div className="flex items-center gap-2 bg-blue-500/10 dark:bg-blue-500/20 px-4 py-2 rounded-full">
                                <Zap className="w-5 h-5 text-blue-500" />
                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                    {data.meta.estimated_duration_seconds}s
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

                {/* Hide default Bubble/Character for StoryMode and IntroNarrative as they have their own */}
                {currentExercise?.type !== 'story_mode' && currentExercise?.type !== 'intro_narrative' && (
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
                            // Story mode es contenido de consumo, no necesita validación.
                            // Solo avanzar al siguiente ejercicio.
                            nextExercise();
                        }}
                    />
                )}


                {/* ===== INTRO NARRATIVE ===== */}
                {currentExercise?.type === 'intro_narrative' && (
                    <IntroNarrative
                        exercise={currentExercise}
                        onNext={() => {
                            // Narrative es contenido de consumo, no necesita validación.
                            // Solo avanzar al siguiente ejercicio.
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
                {localFeedback === 'none' && currentExercise?.content?.instruction && (
                    <div className="w-full max-w-md mx-auto mt-4 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-500">
                        <div className="bg-muted/50 dark:bg-muted/30 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 flex items-center justify-center gap-2">
                            <span className="text-xs font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-md uppercase tracking-wider">
                                {t('tip')}
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



                {/* ===== MATCHING PAIRS ===== */}
                {(currentExercise?.type === 'match_pairs' || currentExercise?.type === 'matching_pairs') && (
                    <MatchingPairs
                        exercise={currentExercise}
                        onSubmit={(answer) => {
                            const isCorrect = submitAnswer(answer);
                            if (isCorrect) {
                                playSound('edu_success');
                                confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                                setLocalFeedback('success');
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

                {/* ===== TRUE / FALSE ===== */}
                {currentExercise?.type === 'true_false' && (
                    <TrueFalse
                        exercise={currentExercise}
                        onSubmit={(isTrue) => {
                            const isCorrect = submitAnswer(isTrue);
                            if (isCorrect) {
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




                {/* ===== TAP ACTION ===== */}
                {currentExercise?.type === 'tap_action' && (
                    <TapAction
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

                {/* ===== IMPACT METER ===== */}
                {currentExercise?.type === 'impact_meter' && (
                    <ImpactMeter
                        exercise={currentExercise}
                        onSubmit={(causeId) => {
                            const isCorrect = submitAnswer(causeId);
                            playSound('edu_success');
                            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                            setLocalFeedback('success');
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

                {/* ===== MYSTERY INVESTMENT ===== */}
                {currentExercise?.type === 'mystery_investment' && (
                    <MysteryInvestment
                        exercise={currentExercise}
                        onSubmit={(allocation) => {
                            const isCorrect = submitAnswer(allocation);
                            playSound('edu_success');
                            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                            setLocalFeedback('success');
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

                {/* ===== SAVINGS RACE ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'savings_race' && (
                    <SavingsRace
                        exercise={currentExercise}
                        onSubmit={(strategy) => {
                            const isCorrect = submitAnswer(strategy);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
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

                {/* ===== INTEREST CALCULATOR ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'interest_calculator' && (
                    <InterestCalculator
                        exercise={currentExercise}
                        onSubmit={(values) => {
                            const isCorrect = submitAnswer(values);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
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



                {/* ===== SUBSCRIPTION TRACKER ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'subscription_tracker' && (
                    <SubscriptionTracker
                        exercise={currentExercise}
                        onSubmit={(active) => {
                            const isCorrect = submitAnswer(active);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
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

                {/* ===== INFLATION SIMULATOR ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'inflation_simulator' && (
                    <InflationSimulator
                        exercise={currentExercise}
                        onSubmit={(comparison) => {
                            const isCorrect = submitAnswer(comparison);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
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

                {/* ===== DEBT STRATEGY ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'debt_strategy' && (
                    <DebtStrategy
                        exercise={currentExercise}
                        onSubmit={(strategy) => {
                            const isCorrect = submitAnswer(strategy);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
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

                {/* ===== OPPORTUNITY COST ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'opportunity_cost' && (
                    <OpportunityCost
                        exercise={currentExercise}
                        onSubmit={(choice) => {
                            const isCorrect = submitAnswer(choice);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
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

                {/* ===== MINDSET COMPARISON ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'mindset_comparison' && (
                    <MindsetComparison
                        exercise={currentExercise}
                        onSubmit={(mindset) => {
                            const isCorrect = submitAnswer(mindset);
                            playSound('edu_success');
                            confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
                            setLocalFeedback('success');
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
                                    +{completionResult?.points_earned || data.meta.points_reward}
                                </p>
                                <p className="text-xs text-muted-foreground">{t('common:dashboard.stats.points')}</p>
                            </div>
                            {completionResult?.new_streak ? (
                                <div className="bg-gradient-to-br from-orange-400/20 to-red-400/20 px-4 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl min-w-[80px]">
                                    <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-orange-500 mx-auto mb-1" />
                                    <p className="text-lg sm:text-xl font-bold text-orange-600 dark:text-orange-400">
                                        🔥 {completionResult.new_streak}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Racha</p>
                                </div>
                            ) : (
                                <div className="bg-gradient-to-br from-blue-400/20 to-cyan-400/20 px-4 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl min-w-[80px]">
                                    <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500 mx-auto mb-1" />
                                    <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                                        {data.meta.estimated_duration_seconds}s
                                    </p>
                                    <p className="text-xs text-muted-foreground">Tiempo</p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons - Full width, stacked on small mobile */}
                        <div className="flex flex-col gap-2 w-full">
                            <Button
                                onClick={() => {
                                    const nextCode = getNextLessonCode(code);
                                    setShowSuccess(false);
                                    setIsCompletingLesson(false);
                                    navigate(`/lesson/${nextCode}`);
                                }}
                                className="w-full h-12 rounded-xl font-semibold text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg"
                            >
                                <ArrowRight className="w-5 h-5 mr-2" />
                                {t('completion.next_lesson')}
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                    className="flex-1 h-11 rounded-xl font-semibold text-sm border-2"
                                >
                                    {t('game_over.exit_button')}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => { setShowSuccess(false); setIsCompletingLesson(false); startLesson(); }}
                                    className="flex-1 h-11 rounded-xl font-semibold text-sm border-2"
                                >
                                    🎮 {t('actions.retry')}
                                </Button>
                            </div>
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
