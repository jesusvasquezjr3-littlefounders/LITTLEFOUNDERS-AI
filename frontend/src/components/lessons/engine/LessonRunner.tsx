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
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { DinoCharacter, DinoMood } from '@/components/demo/DinoCharacter';
import { DinaCharacter } from '@/components/demo/DinaCharacter';
import DrRhoCharacter, { RhoMood } from '@/components/demo/DrRhoCharacter';
import ZaraVexCharacter, { ZaraMood } from '@/components/demo/ZaraVexCharacter';
import { useLessonData, useLessonState, useLessonAudio, completeLesson, fetchNextLessonCode } from './hooks';
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

    // Use global sound context (SFX: chimes, buzzer)
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

    // Narrative audio hook (character voice per exercise sub-elements)
    // Handles on-load audio queue and feedback audio playback.
    // Note: LF Audio Engine is currently off — this operates with pre-existing audio URLs in the DB.
    // Methods are destructured so useCallback deps reference stable function refs, not the object.
    const {
        isNarrativeAudioPlaying,
        playFeedback: playNarrativeFeedback,
        stopAudio: stopNarrativeAudio,
    } = useLessonAudio(currentExercise, audioMuted);

    // Energy system (lives)
    const [lives, setLives] = useState(5);

    // UI states
    const [showSuccess, setShowSuccess] = useState(false);
    const [completionResult, setCompletionResult] = useState<{ points_earned: number; xp_earned: number; new_streak: number } | null>(null);
    const [isCompletingLesson, setIsCompletingLesson] = useState(false);
    // null = last lesson (no next), undefined = still loading, string = ready to navigate
    const [nextLessonCode, setNextLessonCode] = useState<string | null | undefined>(undefined);
    const [showGameOver, setShowGameOver] = useState(false);
    const [localFeedback, setLocalFeedback] = useState<'none' | 'success' | 'error'>('none');

    // ─── Submit/Next/Retry handlers with narrative audio integration ───
    // These helpers encapsulate the common onSubmit/onNext/onRetry pattern
    // and add lessonAudio.playFeedback() for narrative audio segments.

    /** Standard submit handler: validates, plays SFX + narrative audio, manages lives */
    const handleStandardSubmit = useCallback((answer: any): boolean => {
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
        // playFeedback always stops any ongoing load-sequence audio first,
        // then plays feedback voice if a segment exists. If not → no-op.
        playNarrativeFeedback(isCorrect);
        return isCorrect;
    }, [submitAnswer, playSound, playNarrativeFeedback]);

    /** Simulator submit: always succeeds, no life penalty */
    const handleSimulatorSubmit = useCallback((answer: any): boolean => {
        const isCorrect = submitAnswer(answer);
        playSound('edu_success');
        confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
        setLocalFeedback('success');
        playNarrativeFeedback(true);
        return isCorrect;
    }, [submitAnswer, playSound, playNarrativeFeedback]);

    /** Standard next: reset feedback, stop narrative audio, advance */
    const handleNext = useCallback(() => {
        setLocalFeedback('none');
        stopNarrativeAudio();
        nextExercise();
    }, [nextExercise, stopNarrativeAudio]);

    /** Standard retry: reset feedback, stop narrative audio, retry */
    const handleRetry = useCallback(() => {
        setLocalFeedback('none');
        stopNarrativeAudio();
        retryExercise();
    }, [retryExercise, stopNarrativeAudio]);


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

    // Narrative audio is now managed by the useLessonAudio hook.
    // It auto-plays on exercise load and provides playFeedback() for answer responses.
    // The old audioRef/setIsAudioPlaying pattern is replaced by lessonAudio.isNarrativeAudioPlaying.

    // Celebration on complete + API call
    useEffect(() => {
        if (state === 'COMPLETED' && !isCompletingLesson) {
            setIsCompletingLesson(true);
            setNextLessonCode(undefined); // reset to loading state
            stopBGM({ fade: true, fadeDuration: 1500 });

            // Mark lesson complete AND fetch next code concurrently
            const markComplete = async () => {
                try {
                    const userStr = localStorage.getItem('user');
                    const user = userStr ? JSON.parse(userStr) : null;
                    const userId = user?.public_id;

                    const [result, nextCode] = await Promise.all([
                        userId && code ? completeLesson(code, userId, 100, 180) : Promise.resolve(null),
                        fetchNextLessonCode(code),
                    ]);

                    if (result) setCompletionResult(result);
                    // null = last lesson, string = has next
                    setNextLessonCode(nextCode);
                } catch (err) {
                    console.error('Error completing lesson:', err);
                    setNextLessonCode(null); // fall back gracefully
                }
            };

            markComplete();

            setTimeout(() => {
                playSound('edu_complete');
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 100 });
                setShowSuccess(true);
            }, 1000);
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
            <div className="fixed inset-0 bg-gradient-to-b from-primary/10 via-background to-background flex flex-col overflow-hidden">
                {/* Decorative orbs */}
                <div className="absolute -top-20 -left-20 w-72 h-72 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 relative">
                    {/* Character */}
                    <div className="mb-6 animate-bounce-in">
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

                    {/* Lesson Info Card */}
                    <div className="relative liquid-glass-strong rounded-3xl border border-white/20 dark:border-white/10 px-6 py-6 text-center max-w-sm w-full mb-5 overflow-hidden">
                        <div className="absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 relative">
                            {data.lesson.title}
                        </h1>
                        <p className="text-muted-foreground mb-5 relative text-sm leading-relaxed">
                            {data.lesson.description}
                        </p>

                        {/* Rewards */}
                        <div className="flex justify-center gap-3 relative">
                            <div className="flex items-center gap-2 bg-yellow-500/10 dark:bg-yellow-500/20 px-4 py-2 rounded-full border border-yellow-500/20">
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                <span className="font-bold text-yellow-600 dark:text-yellow-400 text-sm">
                                    {data.meta.points_reward} pts
                                </span>
                            </div>
                            <div className="flex items-center gap-2 bg-blue-500/10 dark:bg-blue-500/20 px-4 py-2 rounded-full border border-blue-500/20">
                                <Zap className="w-4 h-4 text-blue-500" />
                                <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                                    {data.meta.estimated_duration_seconds}s
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Start Button */}
                    <Button
                        onClick={startLesson}
                        size="lg"
                        className="relative overflow-hidden w-full max-w-sm h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative">{t('start.button')}</span>
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

            {/* ===== TOP BAR ===== */}
            <div className="flex items-center gap-3 p-4 pb-2">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="w-9 h-9 rounded-full liquid-glass-subtle hover:liquid-glass flex items-center justify-center transition-all flex-shrink-0 border border-white/20 dark:border-white/10"
                >
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Progress Bar */}
                <div className="flex-1 h-4 liquid-glass-subtle rounded-full overflow-hidden border border-white/20 dark:border-white/10">
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
                <div className="flex items-center gap-1 bg-yellow-500/10 dark:bg-yellow-500/20 px-3 py-1.5 rounded-full border border-yellow-500/20">
                    <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{lives}</span>
                </div>

                {/* Audio Toggle */}
                <button
                    onClick={() => setAudioMuted()}
                    className="w-9 h-9 rounded-full liquid-glass-subtle hover:liquid-glass flex items-center justify-center transition-all border border-white/20 dark:border-white/10"
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
                            <div className="relative liquid-glass-subtle rounded-2xl shadow-sm border border-white/20 dark:border-white/10 lesson-speech mx-2">
                                <p className="text-center font-medium text-foreground leading-snug">
                                    {getCurrentText()}
                                </p>
                                {/* Tail */}
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                                    <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white/80 dark:border-t-slate-800/80" />
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
                        onNext={handleNext}
                    />
                )}


                {/* ===== INTRO NARRATIVE ===== */}
                {currentExercise?.type === 'intro_narrative' && (
                    <IntroNarrative
                        exercise={currentExercise}
                        onNext={handleNext}
                        isAudioPlaying={isNarrativeAudioPlaying}
                    />
                )}

                {/* ===== MULTIPLE CHOICE ===== */}
                {currentExercise?.type === 'multiple_choice' && (
                    <MultipleChoice
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
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
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== CLASSIFICATION ===== */}
                {currentExercise?.type === 'classification' && (
                    <Classification
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}



                {/* ===== MATCHING PAIRS ===== */}
                {(currentExercise?.type === 'match_pairs' || currentExercise?.type === 'matching_pairs') && (
                    <MatchingPairs
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== FILL BLANK ===== */}
                {currentExercise?.type === 'fill_blank' && (
                    <FillBlank
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== TRUE / FALSE ===== */}
                {currentExercise?.type === 'true_false' && (
                    <TrueFalse
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== MATH CHALLENGE ===== */}
                {currentExercise?.type === 'math_challenge' && (
                    <MathChallenge
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== ROLEPLAY CHAT ===== */}
                {currentExercise?.type === 'roleplay_chat' && (
                    <RoleplayChat
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== WORD SCRAMBLE ===== */}
                {currentExercise?.type === 'word_scramble' && (
                    <WordScramble
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== ESTIMATION SLIDER ===== */}
                {currentExercise?.type === 'estimation_slider' && (
                    <EstimationSlider
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}



                {/* ===== RISK REWARD ===== */}
                {currentExercise?.type === 'risk_reward' && (
                    <RiskReward
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== SHOP SIM ===== */}
                {currentExercise?.type === 'shop_sim' && (
                    <ShopSim
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== COIN COUNTER ===== */}
                {currentExercise?.type === 'coin_counter' && (
                    <CoinCounter
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== CONCEPT BUILDER ===== */}
                {currentExercise?.type === 'concept_builder' && (
                    <ConceptBuilder
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}




                {/* ===== TAP ACTION ===== */}
                {currentExercise?.type === 'tap_action' && (
                    <TapAction
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== PRICE DETECTIVE ===== */}
                {currentExercise?.type === 'price_detective' && (
                    <PriceDetective
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== SPOT THE TRAP ===== */}
                {currentExercise?.type === 'spot_trap' && (
                    <SpotTheTrap
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== IMPACT METER ===== */}
                {currentExercise?.type === 'impact_meter' && (
                    <ImpactMeter
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== MARKET REACTION ===== */}
                {currentExercise?.type === 'market_reaction' && (
                    <MarketReaction
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== MYSTERY INVESTMENT ===== */}
                {currentExercise?.type === 'mystery_investment' && (
                    <MysteryInvestment
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== BUDGET BUILDER ===== */}
                {currentExercise?.type === 'budget_builder' && (
                    <BudgetBuilder
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== SAVINGS RACE ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'savings_race' && (
                    <SavingsRace
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== EXPENSE TIMELINE ===== */}
                {currentExercise?.type === 'expense_timeline' && (
                    <ExpenseTimeline
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== INTEREST CALCULATOR ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'interest_calculator' && (
                    <InterestCalculator
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== TAX PUZZLE ===== */}
                {currentExercise?.type === 'tax_puzzle' && (
                    <TaxPuzzle
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}



                {/* ===== SUBSCRIPTION TRACKER ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'subscription_tracker' && (
                    <SubscriptionTracker
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== INFLATION SIMULATOR ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'inflation_simulator' && (
                    <InflationSimulator
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== CREDIT SCORE BUILDER ===== */}
                {currentExercise?.type === 'credit_score' && (
                    <CreditScoreBuilder
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== EMERGENCY FUND ===== */}
                {currentExercise?.type === 'emergency_fund' && (
                    <EmergencyFund
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== BILL SPLITTER ===== */}
                {currentExercise?.type === 'bill_splitter' && (
                    <BillSplitter
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== SALARY COMPARISON ===== */}
                {currentExercise?.type === 'salary_comparison' && (
                    <SalaryComparison
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== DEBT STRATEGY ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'debt_strategy' && (
                    <DebtStrategy
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== PORTFOLIO BUILDER ===== */}
                {currentExercise?.type === 'portfolio_builder' && (
                    <PortfolioBuilder
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== OPPORTUNITY COST ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'opportunity_cost' && (
                    <OpportunityCost
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== GOAL ROADMAP ===== */}
                {currentExercise?.type === 'goal_roadmap' && (
                    <GoalRoadmap
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== MINDSET COMPARISON ===== */}
                {/* SIMULATOR: No validation, always succeeds */}
                {currentExercise?.type === 'mindset_comparison' && (
                    <MindsetComparison
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== PASSIVE INCOME ===== */}
                {currentExercise?.type === 'passive_income' && (
                    <PassiveIncome
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== QUIZ BATTLE ===== */}
                {currentExercise?.type === 'quiz_battle' && (
                    <QuizBattle
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
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
                    className="w-[90vw] max-w-sm mx-auto liquid-glass-strong border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl p-4 sm:p-6"
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
                                    <p className="text-xs text-muted-foreground">{t('completion.streak')}</p>
                                </div>
                            ) : (
                                <div className="bg-gradient-to-br from-blue-400/20 to-cyan-400/20 px-4 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl min-w-[80px]">
                                    <Clock className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500 mx-auto mb-1" />
                                    <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                                        {data.meta.estimated_duration_seconds}s
                                    </p>
                                    <p className="text-xs text-muted-foreground">{t('completion.time')}</p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons - Full width, stacked on small mobile */}
                        <div className="flex flex-col gap-2 w-full">
                            {/* Primary CTA: navigate to next lesson (or back to map if last lesson) */}
                            <Button
                                onClick={() => {
                                    if (nextLessonCode) {
                                        setShowSuccess(false);
                                        navigate(`/lesson/${nextLessonCode}`);
                                    } else {
                                        handleClose();
                                    }
                                }}
                                disabled={nextLessonCode === undefined}
                                className="relative overflow-hidden w-full h-12 rounded-xl font-semibold text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/30 disabled:opacity-60"
                            >
                                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                                <span className="relative flex items-center justify-center">
                                    {nextLessonCode === undefined ? (
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    ) : nextLessonCode ? (
                                        <ArrowRight className="w-5 h-5 mr-2" />
                                    ) : null}
                                    {nextLessonCode === undefined
                                        ? t('loading')
                                        : nextLessonCode
                                            ? t('completion.next_lesson')
                                            : t('completion.back_to_map', { defaultValue: '¡Aventura completada! Volver al mapa' })}
                                </span>
                            </Button>
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleClose}
                                    className="flex-1 h-11 rounded-xl font-semibold text-sm liquid-glass-subtle border border-white/20 dark:border-white/10 text-foreground hover:liquid-glass"
                                >
                                    {t('game_over.exit_button')}
                                </Button>
                                <Button
                                    onClick={() => { setShowSuccess(false); setIsCompletingLesson(false); setNextLessonCode(undefined); startLesson(); }}
                                    className="flex-1 h-11 rounded-xl font-semibold text-sm liquid-glass-subtle border border-white/20 dark:border-white/10 text-foreground hover:liquid-glass"
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
                    className="sm:max-w-md liquid-glass-strong border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl"
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
                                onClick={handleClose}
                                className="flex-1 h-12 rounded-xl font-semibold liquid-glass-subtle border border-white/20 dark:border-white/10 text-foreground hover:liquid-glass"
                            >
                                {t('game_over.exit_button')}
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowGameOver(false);
                                    setLives(5);
                                    startLesson();
                                }}
                                className="relative overflow-hidden flex-1 h-12 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                            >
                                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                                <span className="relative flex items-center justify-center">
                                    <Zap className="w-4 h-4 mr-2 fill-current" />
                                    {t('game_over.retry_button')}
                                </span>
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}

export default LessonRunner;
