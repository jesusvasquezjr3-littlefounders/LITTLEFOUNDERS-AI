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
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { DinoCharacter, DinoMood } from '@/components/characters/DinoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import DrRhoCharacter, { RhoMood } from '@/components/characters/DrRhoCharacter';
import ZaraVexCharacter, { ZaraMood } from '@/components/characters/ZaraVexCharacter';
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
import { LessonCelebration } from './LessonCelebration';
import { StreakCelebration } from '@/components/ui/StreakCelebration';
import { getGuestProfile, updateGuestProfile } from '@/lib/guestProfile';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    X,
    Zap,
    Clock,
    Star,
    Loader2,
    AlertCircle,
    Flame,
    Volume2,
    VolumeX,
    BatteryLow
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '@/lib/utils';


interface LessonRunnerProps {
    lessonCode?: string;
}

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

/** Resolve a raw character code (from DB) to a canonical one */
function normalizeCharacterCode(rawCode: unknown): string {
    const normalized = String(rawCode ?? '').toLowerCase().trim();
    return CHARACTER_CODE_MAP[normalized] || CHARACTER_CODE_MAP[String(rawCode)] || 'liruf';
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
    //
    // isLessonActive: false during IDLE/COMPLETED so the hook doesn't attempt autoplay
    // before the user has interacted (browser autoplay policy would block it silently,
    // and then the first exercise would never replay because its id doesn't change).
    const isLessonActive = state !== 'IDLE' && state !== 'COMPLETED';
    const {
        isNarrativeAudioPlaying,
        playFeedback: playNarrativeFeedback,
        stopAudio: stopNarrativeAudio,
    } = useLessonAudio(currentExercise, audioMuted, isLessonActive);

    // Energy system (lives)
    const [lives, setLives] = useState(5);

    // In-lesson combo: consecutive correct answers (resets on error / new lesson)
    const [combo, setCombo] = useState(0);

    // Bumps every time a life is lost — used to replay the energy chip shake animation
    const [lifeLossTick, setLifeLossTick] = useState(0);

    // Track lesson start time to calculate real duration
    // Starts as null — only set when user presses "Start" (not on mount)
    const lessonStartTimeRef = useRef<number | null>(null);

    // Prevents duplicate API calls on retry — only call completeLesson() once per lesson code
    const hasCompletedOnceRef = useRef(false);

    // Prevents celebration from re-firing during the same completion cycle
    // Reset on: code change (new lesson), retry (allow re-celebration)
    const celebrationShownRef = useRef(false);

    // Game over timeout ref — cleaned up on lesson change / retry
    const gameOverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // UI states
    const [showSuccess, setShowSuccess] = useState(false);
    const [showStreakCelebration, setShowStreakCelebration] = useState(false);
    const [completionResult, setCompletionResult] = useState<{
        points_earned: number;
        xp_earned: number;
        new_streak: number;
        max_streak?: number;
        streak_extended: boolean;
        lessons_completed?: number;
        minutes_studied?: number;
        total_points?: number;
        was_first_today?: boolean;
        last_activity_date?: string;
        is_fallback?: boolean;
    } | null>(null);
    // null = last lesson (no next), undefined = still loading, string = ready to navigate
    const [nextLessonCode, setNextLessonCode] = useState<string | null | undefined>(undefined);
    const [realDurationSeconds, setRealDurationSeconds] = useState(0);
    const [showGameOver, setShowGameOver] = useState(false);
    const [localFeedback, setLocalFeedback] = useState<'none' | 'success' | 'error'>('none');

    // ─── Show the lesson celebration screen ───────────────────────────────────
    // Called either directly (no streak activation) or from StreakCelebration.onComplete
    // (streak animation played first). Extracted here so both the effect and the
    // StreakCelebration JSX callback share the same stable reference.
    const showCelebrationScreen = useCallback(() => {
        playSound('edu_complete');
        setShowSuccess(true);
    }, [playSound]);

    // ─── Submit/Next/Retry handlers with narrative audio integration ───
    // These helpers encapsulate the common onSubmit/onNext/onRetry pattern
    // and add lessonAudio.playFeedback() for narrative audio segments.

    /** Double-submit protection ref */
    const isSubmittingRef = useRef(false);

    /** Standard submit handler: validates, plays SFX + narrative audio, manages lives */
    const handleStandardSubmit = useCallback((answer: any): boolean => {
        if (isSubmittingRef.current) return false;
        isSubmittingRef.current = true;
        const isCorrect = submitAnswer(answer);
        if (isCorrect) {
            playSound('edu_success');
            setCombo(c => {
                const newCombo = c + 1;
                // Escalating celebration: bigger burst the longer the combo
                confetti({
                    particleCount: Math.min(50 + newCombo * 15, 140),
                    spread: Math.min(50 + newCombo * 8, 100),
                    origin: { y: 0.7 },
                    disableForReducedMotion: true
                });
                return newCombo;
            });
            setLocalFeedback('success');
        } else {
            playSound('edu_error');
            setCombo(0);
            setLifeLossTick(t => t + 1);
            setLives(l => {
                const newLives = Math.max(0, l - 1);
                if (newLives <= 0 && !gameOverTimerRef.current) {
                    gameOverTimerRef.current = setTimeout(() => setShowGameOver(true), 1000);
                }
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
        confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 }, disableForReducedMotion: true });
        setLocalFeedback('success');
        playNarrativeFeedback(true);
        return isCorrect;
    }, [submitAnswer, playSound, playNarrativeFeedback]);

    /** Standard next: reset feedback, stop narrative audio, advance */
    const handleNext = useCallback(() => {
        isSubmittingRef.current = false;
        setLocalFeedback('none');
        stopNarrativeAudio();
        nextExercise();
    }, [nextExercise, stopNarrativeAudio]);

    /** Standard retry: reset feedback, stop narrative audio, retry */
    const handleRetry = useCallback(() => {
        isSubmittingRef.current = false;
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

    // Get current character code from exercise with normalization
    const getCharacterCode = (): string =>
        normalizeCharacterCode(currentExercise?.character_code || 'liruf');

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

    // ─── COMPLETION EFFECT ───────────────────────────────────────────────────
    //
    // CRITICAL RULES:
    //  • deps = [state] ONLY — never add showSuccess or code (causes re-fire on
    //    navigation between lessons while state is still stale 'COMPLETED')
    //  • celebrationShownRef: prevents double-fire within the same cycle
    //  • hasCompletedOnceRef: prevents duplicate API calls on retry
    //
    // SEQUENCE (as required by product spec):
    //  1. Lesson completes → stop BGM, call API
    //  2a. If THIS IS THE FIRST LESSON OF THE DAY (was_first_today=true):
    //      → show StreakCelebration (cinematic flame) FIRST
    //      → StreakCelebration.onComplete → THEN show LessonCelebration (summary)
    //  2b. If streak already active today (2nd+ lesson) or API failed:
    //      → show LessonCelebration directly
    //  3. On retry (no API call): show LessonCelebration directly
    //
    // This guarantees:
    //  • The summary (completionResult) is ALWAYS fully populated when it appears
    //  • The streak animation always plays BEFORE the summary
    //  • No double API calls
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (state !== 'COMPLETED' || celebrationShownRef.current) return;
        celebrationShownRef.current = true;

        stopBGM({ fade: true, fadeDuration: 1500 });
        // Compute real duration from lesson start (set when user pressed "Start")
        // If null (shouldn't happen), fallback to 0 — NEVER show estimated as real
        const startTime = lessonStartTimeRef.current;
        const realTimeSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
        setRealDurationSeconds(realTimeSeconds);

        // Compute real score from exercise results
        const correctCount = results.filter(r => r.status === 'correct').length;
        const totalAnswered = results.length;
        const realScore = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 100;

        if (hasCompletedOnceRef.current) {
            // ── RETRY path: no API call, just show celebration after a short pause ──
            const t = setTimeout(showCelebrationScreen, 800);
            return () => clearTimeout(t);
        }

        // ── FIRST COMPLETION path ─────────────────────────────────────────────
        hasCompletedOnceRef.current = true;
        setNextLessonCode(undefined); // show loading spinner on "Next" button

        // 'sv' locale gives YYYY-MM-DD in the user's LOCAL timezone (not UTC)
        const localDate = new Date().toLocaleDateString('sv');

        const markComplete = async () => {
            let pendingShowCelebration: ReturnType<typeof setTimeout> | null = null;
            try {
                let user = null;
                try {
                    const userStr = localStorage.getItem('user');
                    user = userStr ? JSON.parse(userStr) : null;
                } catch {
                    user = null;
                }
                const userId = user?.public_id;
                const guestProfile = getGuestProfile();
                const isAuth = !!(user && userId);

                // ── Step 1: Record completion in DB (auth only) ───────────────
                let result: Awaited<ReturnType<typeof completeLesson>> = null;
                if (isAuth && code) {
                    result = await completeLesson(code, userId, realScore, realTimeSeconds, localDate);
                }

                // ── Step 2: Fetch next lesson code (independent of step 1) ───
                const nextCode = await fetchNextLessonCode(code);

                // ── Step 3: Process result and decide presentation sequence ───
                let wasFirstToday = false;
                let newStreakValue = 0;

                if (isAuth && result) {
                    setCompletionResult(result);

                    const updatedUser = {
                        ...user,
                        current_streak: result.new_streak,
                        max_streak: result.max_streak ?? Math.max(user.max_streak || 0, result.new_streak),
                        lessons_completed: result.lessons_completed ?? user.lessons_completed,
                        minutes_studied: result.minutes_studied ?? user.minutes_studied,
                        points_earned: result.total_points ?? user.points_earned,
                        // last_activity_date used by TopNav to derive streak state
                        last_activity_date: result.last_activity_date ?? localDate,
                    };
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    window.dispatchEvent(new CustomEvent('lf:user-updated'));

                    // was_first_today: explicit flag from backend (preferred).
                    // Fallback: streak_extended covers older backend versions
                    // (streak_extended = current_streak > old_streak, true on first activation of day).
                    wasFirstToday = result.was_first_today ?? result.streak_extended ?? false;
                    newStreakValue = result.new_streak ?? 0;

                } else if (isAuth && !result) {
                    // API failed — show summary with computed fallback
                    const fallbackPoints = data?.meta?.points_reward
                        ? Math.round(data.meta.points_reward * (realScore / 100))
                        : realScore;
                    setCompletionResult({
                        points_earned: fallbackPoints,
                        xp_earned: Math.round(fallbackPoints * 0.5),
                        new_streak: 0,
                        streak_extended: false,
                        is_fallback: true,
                    });

                } else if (guestProfile) {
                    const today = localDate;
                    const lastStudied = guestProfile.last_activity_date ?? null;
                    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString('sv');
                    const oldStreak = guestProfile.current_streak || 0;
                    let newStreak = oldStreak;

                    wasFirstToday = lastStudied !== today; // first lesson of this calendar day
                    if (wasFirstToday) {
                        newStreak = (lastStudied === yesterday) ? oldStreak + 1 : 1;
                    }
                    newStreakValue = newStreak;

                    const guestPoints = data?.meta?.points_reward
                        ? Math.round(data.meta.points_reward * (realScore / 100))
                        : Math.max(realScore, 10);
                    setCompletionResult({
                        points_earned: guestPoints,
                        xp_earned: Math.round(guestPoints * 0.5),
                        new_streak: newStreak,
                        streak_extended: newStreak > oldStreak,
                        is_fallback: true,
                    });

                    const existingCodes = guestProfile.completed_lesson_codes || [];
                    const updatedCodes = code
                        ? Array.from(new Set([...existingCodes, code]))
                        : existingCodes;

                    updateGuestProfile({
                        lessons_completed: (guestProfile.lessons_completed || 0) + 1,
                        xp: (guestProfile.xp || 0) + 25,
                        current_streak: newStreak,
                        max_streak: Math.max(guestProfile.max_streak || 0, newStreak),
                        completed_lesson_codes: updatedCodes,
                        last_activity_date: today,
                    });
                }

                setNextLessonCode(nextCode);
                if (!isAuth && nextCode) {
                    updateGuestProfile({ next_lesson_code: nextCode });
                }

                // ── Step 4: Show screens in correct order ─────────────────────
                // Brief pause after API resolves so BGM fade + lesson-end animation settles.
                pendingShowCelebration = setTimeout(() => {
                    if (wasFirstToday && newStreakValue > 0) {
                        // First activation of the day:
                        // StreakCelebration fires FIRST.
                        // LessonCelebration fires from StreakCelebration.onComplete (see JSX below).
                        setShowStreakCelebration(true);
                    } else {
                        // Streak already active today, or API failed, or new_streak = 0:
                        // Go straight to the lesson summary.
                        showCelebrationScreen();
                    }
                }, 500);

            } catch (err) {
                console.error('Error completing lesson:', err);
                setNextLessonCode(null);
                // Always show celebration even if everything fails
                pendingShowCelebration = setTimeout(showCelebrationScreen, 500);
            }
            return pendingShowCelebration;
        };

        markComplete();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state]);

    // Reset local feedback when exercise changes
    useEffect(() => {
        setLocalFeedback('none');
    }, [currentExerciseIndex]);

    // ─── CRITICAL: Reset ALL state when lesson code changes ───
    // When navigating to the next lesson via navigate(`/lesson/${nextCode}`),
    // React reuses the same LessonRunner component instance. Without this reset,
    // the component keeps stale state (showSuccess=true, state='COMPLETED', etc.)
    // which causes the next lesson to appear at the bottom / completion screen.
    useEffect(() => {
        setShowSuccess(false);
        setShowStreakCelebration(false);
        setCompletionResult(null);
        setNextLessonCode(undefined);
        setShowGameOver(false);
        setLocalFeedback('none');
        setLives(5);
        setCombo(0);
        setLifeLossTick(0);
        isSubmittingRef.current = false;
        hasCompletedOnceRef.current = false;
        celebrationShownRef.current = false;
        lessonStartTimeRef.current = null;
        if (gameOverTimerRef.current) {
            clearTimeout(gameOverTimerRef.current);
            gameOverTimerRef.current = null;
        }
        window.scrollTo(0, 0);
    }, [code]);

    // Close lesson — always go to /learn (not navigate(-1) which could go to a previous lesson)
    const handleClose = () => navigate('/learn');

    // ─── Full restart of the lesson run (celebration retry / game-over retry) ───
    // Resets everything a fresh attempt needs: lives, combo, feedback, submit lock
    // and any pending game-over timer. Without these resets, a retry that starts on
    // the same exercise index left isSubmittingRef=true and localFeedback='error',
    // blocking all further submissions.
    const restartLessonRun = useCallback(() => {
        if (gameOverTimerRef.current) {
            clearTimeout(gameOverTimerRef.current);
            gameOverTimerRef.current = null;
        }
        isSubmittingRef.current = false;
        setLocalFeedback('none');
        setLives(5);
        setCombo(0);
        setShowGameOver(false);
        stopNarrativeAudio();
        lessonStartTimeRef.current = Date.now();
        startLesson();
        playBGM('/sounds/edu/background.mp3', { volume: 0.3 });
    }, [startLesson, playBGM, stopNarrativeAudio]);

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
        const startCharacterCode = normalizeCharacterCode(data.timeline[0]?.character_code || 'liruf');

        return (
            <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
                {/* Decorative orbs - subtle */}
                <div className="absolute -top-20 -left-20 w-72 h-72 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-[streak-orb-float-1_12s_ease-in-out_infinite]" />
                <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-[streak-orb-float-2_14s_ease-in-out_infinite]" />

                {/* Main Content */}
                <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 relative">
                    {/* Character - with staggered entrance */}
                    <div className="mb-6 animate-in fade-in zoom-in-95 duration-700" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
                        <div className="animate-float">
                            <div className="animate-breathe">
                                {startCharacterCode === 'dina' ? (
                                    <DinaCharacter className="w-full max-w-[260px] sm:max-w-[280px]" expression="happy" />
                                ) : startCharacterCode === 'dr_rho' ? (
                                    <DrRhoCharacter className="w-full max-w-[260px] sm:max-w-[280px]" mood="wise" />
                                ) : startCharacterCode === 'zara_vex' ? (
                                    <ZaraVexCharacter className="w-full max-w-[260px] sm:max-w-[280px]" mood="happy" />
                                ) : (
                                    <DinoCharacter className="w-full max-w-[260px] sm:max-w-[280px]" showBubble={false} mood="excited" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Lesson Info Card - staggered entrance */}
                    <div
                        className="relative bg-card rounded-3xl border-2 border-border px-6 py-6 text-center max-w-sm w-full mb-5 shadow-sm animate-in fade-in slide-in-from-bottom-6 duration-700"
                        style={{ animationDelay: '250ms', animationFillMode: 'backwards' }}
                    >
                        <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2 relative tracking-tight">
                            {data.lesson.title}
                        </h1>
                        <p className="text-muted-foreground mb-5 relative text-base font-medium leading-relaxed">
                            {data.lesson.description}
                        </p>

                        {/* Rewards */}
                        <div className="flex justify-center gap-4 relative">
                            <div className="flex items-center gap-2 bg-indigo-100 dark:bg-indigo-500/20 px-4 py-2 rounded-2xl border-2 border-indigo-400 dark:border-indigo-500/30 shadow-sm animate-in fade-in zoom-in duration-500" style={{ animationDelay: '450ms', animationFillMode: 'backwards' }}>
                                <Star className="w-5 h-5 text-indigo-500 fill-indigo-500" />
                                <span className="font-bold text-indigo-700 dark:text-indigo-400 text-base">
                                    {data.meta.points_reward} pts
                                </span>
                            </div>
                            <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-500/20 px-4 py-2 rounded-2xl border-2 border-blue-400 dark:border-blue-500/30 shadow-sm animate-in fade-in zoom-in duration-500" style={{ animationDelay: '550ms', animationFillMode: 'backwards' }}>
                                <Clock className="w-5 h-5 text-blue-500" />
                                <span className="font-bold text-blue-700 dark:text-blue-400 text-base">
                                    {data.meta.estimated_duration_seconds >= 60
                                        ? `${Math.round(data.meta.estimated_duration_seconds / 60)} min`
                                        : `${data.meta.estimated_duration_seconds}s`
                                    }
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Start Button - with shimmer */}
                    <div
                        className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-700"
                        style={{ animationDelay: '700ms', animationFillMode: 'backwards' }}
                    >
                        <Button
                            onClick={() => {
                                lessonStartTimeRef.current = Date.now();
                                startLesson();
                            }}
                            size="lg"
                            className="relative w-full h-14 sm:h-16 text-lg sm:text-xl rounded-2xl bg-purple-500 hover:bg-purple-600 text-white shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all overflow-hidden"
                        >
                            <span className="relative z-10">{t('start.button')}</span>
                            <div className="absolute inset-0 animate-shimmer-sweep pointer-events-none" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ============ ACTIVE LESSON ============
    // Duolingo-style progress: the bar reflects COMPLETED exercises, and fills the
    // current segment the moment the user answers correctly (instant reward signal).
    const completedUnits = currentExerciseIndex + (localFeedback === 'success' || state === 'COMPLETED' ? 1 : 0);
    const displayProgress = totalExercises > 0
        ? Math.min(100, Math.round((completedUnits / totalExercises) * 100))
        : progress;

    return (
        <div className="fixed inset-0 bg-background flex flex-col">

            {/* ===== TOP BAR ===== */}
            <div className="flex items-center gap-3 p-4 pb-2">
                {/* Close Button */}
                <button
                    onClick={handleClose}
                    aria-label={t('actions.close', { defaultValue: 'Close lesson' })}
                    className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all flex-shrink-0 border-2 border-slate-200 dark:border-slate-700 shadow-sm hover:scale-105 active:scale-95 active:translate-y-1 active:shadow-none"
                >
                    <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>

                {/* Progress Bar */}
                <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 relative shadow-inner">
                    <div
                        className="h-full bg-green-500 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                        style={{ width: `${displayProgress}%` }}
                    >
                        <div className="absolute top-1 left-2 right-2 h-1.5 bg-white/30 rounded-full" />
                        <div className="animate-shimmer-sweep" />
                    </div>
                </div>

                {/* Combo streak (2+ consecutive correct answers) */}
                {combo >= 2 && (
                    <div
                        key={`combo-${combo}`}
                        className="flex items-center gap-1 bg-amber-100 dark:bg-amber-500/20 px-2.5 py-1.5 rounded-2xl border-2 border-amber-300 dark:border-amber-500/30 shadow-sm animate-bounce-in-scale"
                        aria-label={t('combo', { count: combo, defaultValue: '¡Racha x{{count}}!' })}
                    >
                        <Flame className="w-5 h-5 text-amber-500 fill-amber-500" />
                        <span className="text-base font-bold text-amber-600 dark:text-amber-400">x{combo}</span>
                    </div>
                )}

                {/* Energy (formerly Lives) — shakes on each life lost */}
                <div
                    key={`energy-${lifeLossTick}`}
                    className={cn(
                        "flex items-center gap-1.5 bg-red-100 dark:bg-red-500/20 px-3 py-1.5 rounded-2xl border-2 border-red-200 dark:border-red-500/30 shadow-sm",
                        lifeLossTick > 0 && "animate-shake"
                    )}
                >
                    <Zap className="w-5 h-5 text-red-500 fill-red-500" />
                    <span className="text-base font-bold text-red-600 dark:text-red-400">{lives}</span>
                </div>

                {/* Audio Toggle */}
                <button
                    onClick={() => setAudioMuted()}
                    aria-label={audioMuted ? t('actions.unmute', { defaultValue: 'Unmute audio' }) : t('actions.mute', { defaultValue: 'Mute audio' })}
                    aria-pressed={audioMuted}
                    className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-all border-2 border-slate-200 dark:border-slate-700 shadow-sm hover:scale-105 active:scale-95 active:translate-y-1 active:shadow-none"
                >
                    {audioMuted ? (
                        <VolumeX className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    ) : (
                        <Volume2 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    )}
                </button>
            </div>

            {/* ===== MAIN CONTENT ===== */}
            {/* CRITICAL: When lesson is completed, hide the exercise content completely
                to prevent the "double vision" bug where the last exercise shows
                underneath the celebration screen. Show a "finishing" state instead. */}
            {state === 'COMPLETED' && !showSuccess && !showStreakCelebration ? (
                <div className="flex-1 flex flex-col items-center justify-center px-4 pb-2 pt-4 min-h-0 w-full">
                    <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
                        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                        <p className="text-lg font-bold text-muted-foreground">
                            {t('completion.finishing', { defaultValue: 'Guardando progreso...' })}
                        </p>
                    </div>
                </div>
            ) : (
                <div
                    key={`exercise-${currentExerciseIndex}`}
                    className={cn(
                        "flex-1 flex flex-col items-center justify-start px-4 pb-2 pt-4 overflow-y-auto min-h-0 w-full scrolling-touch",
                        state === 'COMPLETED' ? "opacity-0 pointer-events-none" : "animate-in fade-in slide-in-from-bottom-4 duration-500"
                    )}
                >

                {/* Hide default Bubble/Character for StoryMode and IntroNarrative as they have their own */}
                {currentExercise?.type !== 'story_mode' && currentExercise?.type !== 'intro_narrative' && (
                    <>
                        {/* Speech Bubble - ADAPTIVE */}
                        <div className="w-full flex justify-center lesson-mb-sm flex-shrink-0 animate-bounce-in" style={{ animationDelay: '150ms', animationFillMode: 'backwards' }}>
                            <div
                                className="relative bg-card rounded-2xl shadow-sm border-2 border-border lesson-speech mx-2 px-5 py-3"
                                role="status"
                                aria-live="polite"
                                aria-atomic="true"
                            >
                                <p className="text-center font-bold text-lg text-foreground leading-snug">
                                    {getCurrentText()}
                                </p>
                                {/* Tail */}
                                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                                    <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-border" />
                                    <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-card absolute -top-[12px] -left-[8px]" />
                                </div>
                            </div>
                        </div>

                        {/* Character - ADAPTIVE: scales with viewport height */}
                        <div className="lesson-mb-sm flex-shrink-0">
                            {getCharacterCode() === 'dina' ? (
                                <DinaCharacter
                                    className="lesson-character mx-auto"
                                    expression={getDinaExpression()}
                                    isTalking={isNarrativeAudioPlaying}
                                />
                            ) : getCharacterCode() === 'dr_rho' ? (
                                <DrRhoCharacter
                                    className="lesson-character mx-auto"
                                    mood={getRhoMood()}
                                    isTalking={isNarrativeAudioPlaying}
                                />
                            ) : getCharacterCode() === 'zara_vex' ? (
                                <ZaraVexCharacter
                                    className="lesson-character mx-auto"
                                    mood={getZaraMood()}
                                    isTalking={isNarrativeAudioPlaying}
                                />
                            ) : (
                                <DinoCharacter
                                    className="lesson-character mx-auto"
                                    showBubble={false}
                                    mood={getMood()}
                                    isTalking={isNarrativeAudioPlaying}
                                />
                            )}
                        </div>
                    </>
                )}

                {/* ===== STORY MODE ===== */}
                {currentExercise?.type === 'story_mode' && (
                    <StoryMode
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onNext={handleNext}
                        isAudioPlaying={isNarrativeAudioPlaying}
                    />
                )}


                {/* ===== INTRO NARRATIVE ===== */}
                {currentExercise?.type === 'intro_narrative' && (
                    <IntroNarrative
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onNext={handleNext}
                        isAudioPlaying={isNarrativeAudioPlaying}
                    />
                )}

                {/* ===== MULTIPLE CHOICE ===== */}
                {currentExercise?.type === 'multiple_choice' && (
                    <MultipleChoice
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== SEQUENCING ===== */}
                {currentExercise?.type === 'sequencing' && (
                    <Sequencing
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== CLASSIFICATION ===== */}
                {currentExercise?.type === 'classification' && (
                    <Classification
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}



                {/* ===== MATCHING PAIRS ===== */}
                {(currentExercise?.type === 'match_pairs' || currentExercise?.type === 'matching_pairs') && (
                    <MatchingPairs
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== FILL BLANK ===== */}
                {currentExercise?.type === 'fill_blank' && (
                    <FillBlank
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== TRUE / FALSE ===== */}
                {currentExercise?.type === 'true_false' && (
                    <TrueFalse
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== MATH CHALLENGE ===== */}
                {currentExercise?.type === 'math_challenge' && (
                    <MathChallenge
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== ROLEPLAY CHAT ===== */}
                {currentExercise?.type === 'roleplay_chat' && (
                    <RoleplayChat
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== WORD SCRAMBLE ===== */}
                {currentExercise?.type === 'word_scramble' && (
                    <WordScramble
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== ESTIMATION SLIDER ===== */}
                {currentExercise?.type === 'estimation_slider' && (
                    <EstimationSlider
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}



                {/* ===== RISK REWARD ===== */}
                {currentExercise?.type === 'risk_reward' && (
                    <RiskReward
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== SHOP SIM ===== */}
                {currentExercise?.type === 'shop_sim' && (
                    <ShopSim
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== COIN COUNTER ===== */}
                {currentExercise?.type === 'coin_counter' && (
                    <CoinCounter
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== CONCEPT BUILDER ===== */}
                {currentExercise?.type === 'concept_builder' && (
                    <ConceptBuilder
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}




                {/* ===== TAP ACTION ===== */}
                {currentExercise?.type === 'tap_action' && (
                    <TapAction
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== PRICE DETECTIVE ===== */}
                {currentExercise?.type === 'price_detective' && (
                    <PriceDetective
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== SPOT THE TRAP ===== */}
                {currentExercise?.type === 'spot_trap' && (
                    <SpotTheTrap
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== IMPACT METER ===== */}
                {currentExercise?.type === 'impact_meter' && (
                    <ImpactMeter
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== MARKET REACTION ===== */}
                {currentExercise?.type === 'market_reaction' && (
                    <MarketReaction
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== MYSTERY INVESTMENT ===== */}
                {currentExercise?.type === 'mystery_investment' && (
                    <MysteryInvestment
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== BUDGET BUILDER ===== */}
                {currentExercise?.type === 'budget_builder' && (
                    <BudgetBuilder
                        key={currentExerciseIndex}
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
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== EXPENSE TIMELINE ===== */}
                {currentExercise?.type === 'expense_timeline' && (
                    <ExpenseTimeline
                        key={currentExerciseIndex}
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
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== TAX PUZZLE ===== */}
                {currentExercise?.type === 'tax_puzzle' && (
                    <TaxPuzzle
                        key={currentExerciseIndex}
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
                        key={currentExerciseIndex}
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
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== CREDIT SCORE BUILDER ===== */}
                {currentExercise?.type === 'credit_score' && (
                    <CreditScoreBuilder
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== EMERGENCY FUND ===== */}
                {currentExercise?.type === 'emergency_fund' && (
                    <EmergencyFund
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== BILL SPLITTER ===== */}
                {currentExercise?.type === 'bill_splitter' && (
                    <BillSplitter
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== SALARY COMPARISON ===== */}
                {currentExercise?.type === 'salary_comparison' && (
                    <SalaryComparison
                        key={currentExerciseIndex}
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
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== PORTFOLIO BUILDER ===== */}
                {currentExercise?.type === 'portfolio_builder' && (
                    <PortfolioBuilder
                        key={currentExerciseIndex}
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
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== GOAL ROADMAP ===== */}
                {currentExercise?.type === 'goal_roadmap' && (
                    <GoalRoadmap
                        key={currentExerciseIndex}
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
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleSimulatorSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== PASSIVE INCOME ===== */}
                {currentExercise?.type === 'passive_income' && (
                    <PassiveIncome
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== QUIZ BATTLE ===== */}
                {currentExercise?.type === 'quiz_battle' && (
                    <QuizBattle
                        key={currentExerciseIndex}
                        exercise={currentExercise}
                        onSubmit={handleStandardSubmit}
                        onNext={handleNext}
                        onRetry={handleRetry}
                    />
                )}

                {/* ===== FALLBACK: Unsupported / Unmapped Exercise Type ===== */}
                {currentExercise && ![
                    'story_mode', 'intro_narrative', 'multiple_choice', 'true_false',
                    'fill_blank', 'classification', 'matching_pairs', 'match_pairs', 'sequencing',
                    'tap_action', 'math_challenge', 'word_scramble', 'roleplay_chat',
                    'estimation_slider', 'risk_reward', 'concept_builder', 'quiz_battle',
                    'shop_sim', 'coin_counter', 'price_detective', 'bill_splitter',
                    'budget_builder', 'expense_timeline', 'subscription_tracker',
                    'savings_race', 'emergency_fund', 'goal_roadmap', 'interest_calculator',
                    'portfolio_builder', 'mystery_investment', 'passive_income',
                    'opportunity_cost', 'market_reaction', 'inflation_simulator',
                    'credit_score', 'debt_strategy', 'tax_puzzle', 'salary_comparison',
                    'spot_trap', 'impact_meter', 'mindset_comparison'
                ].includes(currentExercise.type) && (
                    <div className="w-full max-w-md mx-auto animate-slide-in-bottom">
                        <div className="bg-card rounded-3xl p-8 text-center space-y-4 border-2 border-border shadow-sm">
                            <div className="text-4xl">🛠️</div>
                            <h3 className="text-lg font-bold text-foreground">
                                {t('errors.unsupported_exercise', { defaultValue: 'Ejercicio en desarrollo' })}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {t('errors.unsupported_exercise_desc', { defaultValue: 'Este tipo de ejercicio aún no está disponible. Puedes saltarlo para continuar.' })}
                            </p>
                            <button
                                onClick={handleNext}
                                className="w-full h-14 sm:h-16 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-bold shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                            >
                                {t('actions.skip', { defaultValue: 'Saltar ejercicio' })} →
                            </button>
                        </div>
                    </div>
                )}

                {/* GLOBAL INSTRUCTION FOOTER — moved to end so it appears below ALL exercise types */}
                {localFeedback === 'none' && currentExercise?.content?.instruction && (
                    <div className="w-full max-w-md mx-auto mt-4 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-500">
                        <div className="bg-muted/50 dark:bg-muted/30 backdrop-blur-sm border border-border/50 rounded-full px-4 py-2 flex items-center justify-center gap-2">
                            <span className="text-xs font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-md uppercase tracking-wider">
                                {t('tip', { defaultValue: 'Tip' })}
                            </span>
                            <p className="text-sm font-medium text-muted-foreground text-center">
                                {currentExercise.content.instruction}
                            </p>
                        </div>
                    </div>
                )}

            </div>
            )}

            {/* ===== STREAK CELEBRATION ==============================================
              Shows BEFORE the lesson summary when the user activates their streak
              for the first time today (State 1→3 or State 2→3 transition).
              onComplete: dismiss streak animation THEN show the lesson summary.
            ===================================================================== */}
            <StreakCelebration
                isVisible={showStreakCelebration}
                streakCount={completionResult?.new_streak ?? 0}
                xpGained={completionResult?.xp_earned ?? 25}
                onComplete={() => {
                    setShowStreakCelebration(false);
                    // Show lesson summary immediately after streak animation finishes
                    showCelebrationScreen();
                }}
            />

            {/* ===== SUCCESS SCREEN ===== */}
            <LessonCelebration
                isVisible={showSuccess}
                completionResult={completionResult}
                basePoints={data.meta.points_reward}
                durationSeconds={realDurationSeconds}
                nextLessonCode={nextLessonCode}
                characterCode={getCharacterCode()}
                exerciseStats={{
                    correct: results.filter(r => r.status === 'correct').length,
                    total: results.length
                }}
                onNext={() => {
                    if (nextLessonCode) {
                        setShowSuccess(false);
                        window.scrollTo(0, 0);
                        navigate(`/lesson/${nextLessonCode}`);
                    } else {
                        handleClose();
                    }
                }}
                onExit={handleClose}
                onRetry={() => {
                    setShowSuccess(false);
                    setShowStreakCelebration(false);
                    celebrationShownRef.current = false;
                    restartLessonRun();
                }}
            />

            {/* ===== GAME OVER DIALOG (No Energy) ===== */}
            <Dialog
                open={showGameOver}
                onOpenChange={(open) => {
                    if (!open) handleClose();
                }}
            >
                <DialogContent
                    className="sm:max-w-md bg-card border-2 border-border shadow-sm rounded-3xl"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <div className="text-center py-6">
                        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BatteryLow className="w-10 h-10 text-indigo-500" />
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
                                className="flex-1 h-14 sm:h-16 rounded-2xl font-bold bg-muted text-muted-foreground border-2 border-border shadow-[0_4px_0_hsl(var(--border))] hover:shadow-[0_2px_0_hsl(var(--border))] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                            >
                                {t('game_over.exit_button')}
                            </Button>
                            <Button
                                onClick={restartLessonRun}
                                className="flex-1 h-14 sm:h-16 rounded-2xl font-bold bg-purple-500 hover:bg-purple-600 text-white shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                            >
                                <Zap className="w-4 h-4 fill-current" />
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
