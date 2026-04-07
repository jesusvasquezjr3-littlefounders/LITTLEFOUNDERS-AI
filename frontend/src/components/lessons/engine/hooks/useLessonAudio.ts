/**
 * useLessonAudio - Hook para gestionar audio narrativo granular en lecciones
 *
 * Maneja la reproduccion de audio por sub-elementos del ejercicio:
 * - Al cargar un ejercicio: reproduce main/statement/question/instruction en secuencia
 * - Al responder: reproduce feedback_success o feedback_error
 *
 * Diseño de resiliencia:
 * - Si un segmento no existe en la DB → se omite silenciosamente, la lección continúa
 * - Si el URL del audio da error 404/red → se omite silenciosamente, continúa la cola
 * - Si el navegador bloquea autoplay → se omite silenciosamente
 * - Si el componente se desmonta durante la reproducción → limpieza sin warnings
 * - Si audioMuted cambia durante la reproducción → se detiene correctamente
 *
 * Nota: Este hook NO reemplaza los SFX del SoundContext (edu_success, edu_error).
 * Los SFX son efectos cortos; este hook gestiona narración de personaje (voz).
 *
 * Nota: El LF Audio Engine está apagado en este momento. Este hook opera
 * con los URLs de audio que ya existan en la base de datos.
 */
import { useRef, useCallback, useEffect, useState } from 'react';
import type { ExerciseData, AudioSegment, AudioSegmentMap } from './useLessonData';

// ─── Target field priority per exercise type ───
// Defines the ORDER in which audio segments play when an exercise loads.
// Only segments that actually exist in the AudioSegmentMap will play.
// Missing segments are skipped gracefully — the lesson runs normally regardless.
const LOAD_SEQUENCE: Record<string, string[]> = {
    // Narrative/consumo types — solo reproducen main
    intro_narrative: ['main'],
    story_mode: ['main'],

    // Question-based exercises
    multiple_choice: ['main', 'question', 'instruction'],
    math_challenge: ['main', 'question', 'instruction'],
    roleplay_chat: ['main', 'question', 'instruction'],

    // Statement-based exercises
    true_false: ['main', 'statement', 'instruction'],
    tap_action: ['main', 'statement', 'instruction'],

    // Instruction-first exercises
    classification: ['main', 'instruction'],
    sequencing: ['main', 'instruction'],
    matching_pairs: ['main', 'instruction'],
    match_pairs: ['main', 'instruction'],
    fill_blank: ['main', 'instruction'],
    drag_drop: ['main', 'instruction'],
    word_scramble: ['main', 'instruction'],
    estimation_slider: ['main', 'instruction'],
    risk_reward: ['main', 'instruction'],
    shop_sim: ['main', 'instruction'],
    coin_counter: ['main', 'instruction'],
    concept_builder: ['main', 'instruction'],
    price_detective: ['main', 'instruction'],
    spot_trap: ['main', 'instruction'],
    impact_meter: ['main', 'instruction'],
    market_reaction: ['main', 'instruction'],
    mystery_investment: ['main', 'instruction'],
    budget_builder: ['main', 'instruction'],
    savings_race: ['main', 'instruction'],
    expense_timeline: ['main', 'instruction'],
    interest_calculator: ['main', 'instruction'],
    tax_puzzle: ['main', 'instruction'],
    subscription_tracker: ['main', 'instruction'],
    inflation_simulator: ['main', 'instruction'],
    credit_score: ['main', 'instruction'],
    emergency_fund: ['main', 'instruction'],
    bill_splitter: ['main', 'instruction'],
    salary_comparison: ['main', 'instruction'],
    debt_strategy: ['main', 'instruction'],
    portfolio_builder: ['main', 'instruction'],
    opportunity_cost: ['main', 'instruction'],
    goal_roadmap: ['main', 'instruction'],
    mindset_comparison: ['main', 'instruction'],
    passive_income: ['main', 'instruction'],
    quiz_battle: ['main', 'instruction'],
    comparison: ['main', 'instruction'],
    sorting_buckets: ['main', 'instruction'],
    image_hotspot: ['main', 'instruction'],
    balance_scale: ['main', 'instruction'],
};

// Fallback sequence for unknown/future exercise types
const DEFAULT_LOAD_SEQUENCE = ['main', 'question', 'statement', 'instruction'];

export interface UseLessonAudioReturn {
    /** Whether any narrative audio is currently playing */
    isNarrativeAudioPlaying: boolean;

    /**
     * Play the "on load" audio sequence for the current exercise.
     * Automatically determines which segments to play based on exercise type.
     * Segments play in sequence: one finishes, then the next starts.
     * If no segments exist for this exercise, this is a no-op.
     */
    playOnLoad: () => void;

    /**
     * Stop ongoing audio and play feedback audio (feedback_success or feedback_error).
     * Always stops any ongoing load-sequence audio first, regardless of whether
     * a feedback segment exists. If no feedback audio exists, simply stops.
     * Does NOT replace SFX — this plays narrative audio (character voice).
     */
    playFeedback: (isCorrect: boolean) => void;

    /**
     * Stop any currently playing narrative audio immediately.
     */
    stopAudio: () => void;

    /**
     * Whether the current exercise has any audio segments at all.
     */
    hasAudio: boolean;
}

export function useLessonAudio(
    currentExercise: ExerciseData | null,
    audioMuted: boolean
): UseLessonAudioReturn {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    // Signal ref: set to true by stopAudio to cancel any in-progress queue
    const cancelledRef = useRef(false);
    // Ref for audioMuted to avoid stale closures in async queue loops
    const audioMutedRef = useRef(audioMuted);
    // Ref to track mount state and prevent setState after unmount
    const mountedRef = useRef(true);

    const [isPlaying, setIsPlaying] = useState(false);

    // Keep audioMutedRef in sync with the prop
    useEffect(() => {
        audioMutedRef.current = audioMuted;
    }, [audioMuted]);

    // Create the audio element once on mount; cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;
        const audio = new Audio();
        audio.preload = 'auto';
        audioRef.current = audio;

        return () => {
            mountedRef.current = false;
            audio.pause();
            audio.src = '';
            audioRef.current = null;
        };
    }, []);

    // Get the audio map from current exercise — null when no audio in DB for this exercise
    const audioMap: AudioSegmentMap | null = currentExercise?.audio || null;
    const hasAudio = audioMap !== null && Object.values(audioMap).some(seg => seg?.url);

    // ─── Internal: Play a single segment, resolves when done or on error ───
    // Never throws — always resolves to allow the queue to continue.
    const playSingle = useCallback((segment: AudioSegment): Promise<void> => {
        return new Promise((resolve) => {
            const audio = audioRef.current;

            // Guard: no audio element, no URL, or muted — skip silently
            if (!audio || !segment.url || audioMutedRef.current) {
                resolve();
                return;
            }

            const cleanup = () => {
                audio.removeEventListener('ended', handleEnded);
                audio.removeEventListener('error', handleError);
            };
            const handleEnded = () => { cleanup(); resolve(); };
            const handleError = () => {
                cleanup();
                // Log but do NOT rethrow — lesson must continue without audio
                console.warn('[LessonAudio] Could not play audio segment (skipping):', segment.url);
                resolve();
            };

            audio.addEventListener('ended', handleEnded);
            audio.addEventListener('error', handleError);

            try {
                audio.src = segment.url;
                audio.play().catch(() => {
                    // Browser blocked autoplay or network error — skip gracefully
                    cleanup();
                    resolve();
                });
            } catch {
                // Unexpected error — skip gracefully
                cleanup();
                resolve();
            }
        });
    }, []); // No deps — reads audioMutedRef dynamically

    // ─── Internal: Play a queue of segments sequentially ───
    // Cancellable via cancelledRef. Always sets isPlaying correctly on exit.
    const playQueue = useCallback(async (segments: AudioSegment[]) => {
        cancelledRef.current = false;
        if (mountedRef.current) setIsPlaying(true);

        for (const seg of segments) {
            // Abort if stopAudio was called or component unmounted
            if (cancelledRef.current || !mountedRef.current) break;
            // Abort if muted (checked via ref to avoid stale closure)
            if (audioMutedRef.current) break;

            await playSingle(seg);
        }

        // Only update state if still mounted
        if (mountedRef.current) setIsPlaying(false);
    }, [playSingle]); // Removed audioMuted dep — uses ref instead

    // ─── stopAudio: Stop any currently playing audio immediately ───
    const stopAudio = useCallback(() => {
        cancelledRef.current = true; // Signals playQueue loop to break
        const audio = audioRef.current;
        if (audio) {
            try {
                audio.pause();
                audio.src = '';
            } catch {
                // Ignore — audio element may already be gone
            }
        }
        if (mountedRef.current) setIsPlaying(false);
    }, []);

    // ─── playOnLoad: Play the intro sequence for the current exercise ───
    // No-op if no audio exists for this exercise.
    const playOnLoad = useCallback(() => {
        if (!currentExercise || !audioMap) return;

        const type = currentExercise.type;
        const sequence = LOAD_SEQUENCE[type] || DEFAULT_LOAD_SEQUENCE;

        // Filter to only segments that exist and have a non-empty URL
        const availableSegments: AudioSegment[] = [];
        for (const targetField of sequence) {
            const seg = audioMap[targetField as keyof AudioSegmentMap];
            if (seg?.url) {
                availableSegments.push(seg);
            }
        }

        // No audio for this exercise — skip completely
        if (availableSegments.length === 0) return;

        playQueue(availableSegments);
    }, [currentExercise, audioMap, playQueue]);

    // ─── playFeedback: Play feedback audio after user answers ───
    // ALWAYS stops any in-progress load-sequence audio first.
    // If no feedback segment exists, simply stops (correct behavior: no narration over feedback UI).
    const playFeedback = useCallback((isCorrect: boolean) => {
        // Always stop any ongoing audio when user answers, regardless of feedback audio existence
        stopAudio();

        if (!audioMap) return;

        const targetField = isCorrect ? 'feedback_success' : 'feedback_error';
        const seg = audioMap[targetField];
        if (seg?.url) {
            playQueue([seg]);
        }
        // If no feedback segment → audio is stopped, UI feedback shows without audio narration.
        // This is correct: the lesson works normally, just without voice feedback.
    }, [audioMap, playQueue, stopAudio]);

    // ─── Auto-pause when muted ───
    useEffect(() => {
        if (audioMuted) {
            stopAudio();
        }
    }, [audioMuted, stopAudio]);

    // ─── Auto-play on exercise change ───
    // Fires when the exercise changes (by id). The 300ms delay lets the UI render
    // the exercise before audio starts. The cleanup cancels the timeout if the
    // exercise changes again before it fires (e.g., user clicks next very fast).
    useEffect(() => {
        if (!currentExercise || !hasAudio || audioMuted) return;

        const timer = setTimeout(() => {
            // Guard: check again at fire time in case state changed in the 300ms window
            if (mountedRef.current && !audioMutedRef.current) {
                playOnLoad();
            }
        }, 300);

        return () => clearTimeout(timer);
    // Depend on exercise id so this fires on each new exercise.
    // playOnLoad is excluded intentionally — it's always fresh via its own memo chain,
    // and including it would cause an infinite loop since playOnLoad changes with audioMap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentExercise?.id]);

    return {
        isNarrativeAudioPlaying: isPlaying,
        playOnLoad,
        playFeedback,
        stopAudio,
        hasAudio,
    };
}
