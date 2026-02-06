/**
 * Hook para obtener datos de lección desde el backend
 * Soporte para internacionalización (i18n)
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

export interface AudioData {
    url: string | null;
    characterId?: number;
    characterCode?: string;
    gesture?: string;
    emotion?: string;
    transcript?: string;
    duration_ms?: number;
}

export interface ExerciseData {
    id: number;
    type: 'intro_narrative' | 'multiple_choice' | 'drag_drop' | 'match_pairs' | 'matching_pairs' | 'fill_blank' | 'classification' | 'tap_action' | 'comparison' | 'story_mode' | 'sequencing' | 'sorting_buckets' | 'true_false' | 'math_challenge' | 'roleplay_chat' | 'word_scramble' | 'estimation_slider' | 'image_hotspot' | 'shop_sim' | 'coin_counter' | 'concept_builder' | 'risk_reward' | 'balance_scale' | 'price_detective' | 'spot_trap' | 'impact_meter' | 'market_reaction' | 'mystery_investment' | 'budget_builder' | 'savings_race' | 'expense_timeline' | 'interest_calculator' | 'tax_puzzle' | 'subscription_tracker' | 'inflation_simulator' | 'credit_score' | 'emergency_fund' | 'bill_splitter' | 'salary_comparison' | 'debt_strategy' | 'portfolio_builder' | 'opportunity_cost' | 'goal_roadmap' | 'mindset_comparison' | 'passive_income' | 'quiz_battle';
    order_index: number;
    character_code?: string; // 'liruf' o 'dina'
    start_time_ms: number;
    pause_at_ms?: number;
    content: {
        question?: string;
        characterCode?: string;
        gesture?: string;
        emotion?: string;
        transcript?: string;
        instruction?: string;
        options?: Array<{ id: string; text: string; image?: string | null }>;
        // Classification specific
        items?: Array<{ id: string; text: string; emoji?: string; category?: string; isTarget?: boolean; type?: string }>;
        categories?: Array<{ id: string; label: string }>;
        // Story Mode specific
        pages?: Array<{ id: string; text: string; image?: string; character_mood?: string; choices?: Array<{ id: string; text: string; next_page?: string }> }>;
        // Batch 1: Matching and FillBlank
        pairs?: Array<{ id: string; left: string; right: string }>;
        segments?: Array<{ type: 'text' | 'blank'; text?: string }>;
        statement?: string; // TrueFalse
        blank_ids?: Record<string, string>; // Correct answers for fill blank
        // Batch 2: Math, Roleplay, WordScramble
        word?: string; // WordScramble target
        hint?: string;
        dialogue?: Array<{ id: string; sender: 'system' | 'hero' | 'npc' | 'user'; text: string; name?: string }>; // Roleplay history
        context?: string; // Roleplay context
        choices?: Array<{ id: string; text: string; next_page?: string }>; // General choices (Roleplay, Story)
        // Batch 3: Slider, RiskReward, Hotspot
        min?: number;
        max?: number;
        step?: number;
        unit?: string;
        imageUrl?: string; // Hotspot
        hotspots?: Array<{ id: string; x: number; y: number; radius?: number; label?: string }>;
        risk_options?: Array<{ id: string; type: 'safe' | 'risk'; text: string; reward: string; risk?: string }>;
        // Batch 4: Shop, Coin, Concept
        products?: Array<{ id: string; name: string; price: number; image?: string }>;
        budget?: number;
        targetAmount?: number;
        coins_available?: Array<{ value: number; image?: string }>;
        concepts?: Array<{ id: string; label: string; type: 'node' | 'connector' }>;
        condition?: 'balanced' | 'left_heavy' | 'right_heavy';
        // New Activities (Batch 1)
        initialScore?: number;
        scenarios?: Array<any>;
        initialFund?: number;
        events?: Array<any>;
        // New Activities (Batch 2: 12-20)
        people?: Array<any>; // BillSplitter
        offers?: Array<any>; // SalaryComparison
        factors?: string[]; // SalaryComparison
        debts?: Array<any>; // DebtStrategy
        monthlyPayment?: number; // DebtStrategy
        assets?: Array<any>; // PortfolioBuilder
        goals?: Array<any>; // GoalRoadmap
        scenario?: any; // MindsetComparison
        scarcity?: any; // MindsetComparison
        abundance?: any; // MindsetComparison
        streams?: Array<any>; // PassiveIncome
        targetIncome?: number; // PassiveIncome
        questions?: Array<any>; // QuizBattle
    };
    correct_answer?: {
        correctOptionId?: string;
        classifications?: Record<string, string>;
        targetIds?: string[];
        sequence?: string[];
        blank_ids?: Record<string, string>;
        isTrue?: boolean;
        // Batch 3+ Correct Answers
        correctValue?: number;
        tolerance?: number; // For slider
        hotspotIds?: string[];
        shopItems?: string[]; // IDs to buy
        // New activity types (Batch 1)
        trapIds?: string[]; // For spot_trap
        acceptAny?: boolean; // For impact_meter
        minBoxes?: number; // For mystery_investment
        allocation?: Record<string, string>; // For budget_builder
        order?: string[]; // For expense_timeline, goal_roadmap
        minScore?: number; // For credit_score, quiz_battle
        // New activity types (Batch 2: 12-20)
        splits?: Record<string, number>; // For bill_splitter
        bestOffer?: string; // For salary_comparison
    } | null;
    feedback?: { success: string; error: string } | null;
    points: number;
    audio?: AudioData | null;
}

export interface LessonMeta {
    estimated_duration_seconds: number;
    points_reward: number;
    xp_reward: number;
}

export interface LessonInfo {
    id: number;
    code: string;
    title: string;
    description?: string;
    saga?: string;
    saga_code?: string;
    adventure?: string;
    adventure_code?: string;
    topic?: string;
    topic_code?: string;
    language?: string; // Idioma de la respuesta
}

export interface LessonData {
    lesson: LessonInfo;
    meta: LessonMeta;
    timeline: ExerciseData[];
}

interface UseLessonDataReturn {
    data: LessonData | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

/**
 * Hook para obtener datos de lección con soporte de idioma
 * @param lessonCode - Código de la lección (ej: "1-1-0-1")
 * @param language - Código de idioma opcional (si no se pasa, usa el idioma actual de i18n)
 */
export function useLessonData(lessonCode: string, language?: string): UseLessonDataReturn {
    const { i18n, t } = useTranslation('errors');
    const [data, setData] = useState<LessonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Usar idioma pasado o el idioma actual de i18n
    const currentLanguage = language || i18n.language || 'es';

    const fetchLesson = async () => {
        try {
            setLoading(true);
            setError(null);

            // Agregar parámetro de idioma a la URL
            const url = `${API_BASE}/lesson-engine/lessons/${lessonCode}/play?lang=${currentLanguage}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(t('lesson.not_found_error', { status: response.status }));
            }

            const lessonData = await response.json();
            setData(lessonData);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('lesson.load_error'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (lessonCode) {
            fetchLesson();
        }
    }, [lessonCode, currentLanguage]); // Re-fetch cuando cambie el idioma

    return { data, loading, error, refetch: fetchLesson };
}

/**
 * Calcula el código de la siguiente lección basado en el código actual
 * Formato: adventure-saga-topic-lesson (ej: "1-1-1-1" -> "1-1-1-2")
 */
export function getNextLessonCode(currentCode: string): string {
    const parts = currentCode.split('-').map(Number);
    if (parts.length !== 4) return currentCode;

    // Incrementar el número de lección
    parts[3] += 1;
    return parts.join('-');
}

/**
 * Marca una lección como completada en el backend
 */
export async function completeLesson(
    lessonCode: string,
    userId: number,
    score: number = 100,
    timeSpentSeconds: number = 180
): Promise<{
    success: boolean;
    points_earned: number;
    xp_earned: number;
    new_streak: number;
    streak_extended: boolean;
} | null> {
    try {
        const url = `${API_BASE}/lesson-engine/lessons/${lessonCode}/complete?user_id=${userId}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                score,
                time_spent_seconds: timeSpentSeconds
            })
        });

        if (!response.ok) {
            console.error('Failed to complete lesson:', response.status);
            return null;
        }

        return await response.json();
    } catch (err) {
        console.error('Error completing lesson:', err);
        return null;
    }
}
